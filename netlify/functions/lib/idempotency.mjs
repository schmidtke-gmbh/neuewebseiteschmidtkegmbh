import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

export class DurableIdempotency {
  constructor({
    store = getStore('crm-automation-idempotency'),
    now = Date.now,
    staleAfterMs = 5 * 60 * 1000,
    ownerFactory = crypto.randomUUID,
  } = {}) {
    this.store = store;
    this.now = now;
    this.staleAfterMs = staleAfterMs;
    this.ownerFactory = ownerFactory;
  }

  storageKey(eventKey, step) {
    const digest = crypto.createHash('sha256').update(`${eventKey}\0${step}`).digest('hex');
    return `v1/${step}/${digest}`;
  }

  isStale(state) {
    const startedAt = Date.parse(state?.startedAt ?? '');
    return !Number.isFinite(startedAt) || this.now() - startedAt >= this.staleAfterMs;
  }

  async claim(key, owner) {
    const processing = {
      status: 'processing',
      owner,
      startedAt: new Date(this.now()).toISOString(),
    };
    const created = await this.store.setJSON(key, processing, { onlyIfNew: true });
    if (created.modified) return { claimed: true, etag: created.etag, state: processing };

    const current = await this.store.getWithMetadata(key, { type: 'json' });
    if (!current) return { claimed: false };
    if (current.data?.status === 'done') {
      return { claimed: false, done: true, value: current.data.value };
    }
    if (current.data?.status === 'processing' && !this.isStale(current.data)) {
      return { claimed: false };
    }
    if (!current.etag) return { claimed: false };

    const replaced = await this.store.setJSON(key, processing, { onlyIfMatch: current.etag });
    return replaced.modified
      ? { claimed: true, etag: replaced.etag, state: processing }
      : { claimed: false };
  }

  async runStep(eventKey, step, operation) {
    const key = this.storageKey(eventKey, step);
    const owner = this.ownerFactory();
    const claim = await this.claim(key, owner);
    if (claim.done) return { status: 'done', value: claim.value };
    if (!claim.claimed) return { status: 'in-progress' };

    try {
      const value = await operation();
      const completed = await this.store.setJSON(key, {
        ...claim.state,
        status: 'done',
        completedAt: new Date(this.now()).toISOString(),
        value: value ?? null,
      }, { onlyIfMatch: claim.etag });
      if (!completed.modified) throw new Error('Idempotency lock was lost before completion');
      return { status: 'executed', value };
    } catch (error) {
      await this.store.setJSON(key, {
        ...claim.state,
        status: 'failed',
        failedAt: new Date(this.now()).toISOString(),
      }, { onlyIfMatch: claim.etag });
      throw error;
    }
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function eventDigest(event) {
  return crypto.createHash('sha256').update(JSON.stringify([
    event.triggerEvent, event.bookingUid, event.rescheduleUid ?? '',
    event.startTime ?? '', event.occurredAt ?? '',
  ])).digest('hex');
}

function olderThanCurrent(event, state) {
  const incoming = Date.parse(event.occurredAt ?? '');
  const current = Date.parse(state.eventOccurredAt ?? '');
  return Number.isFinite(incoming) && Number.isFinite(current) && incoming < current;
}

function newerThanCurrent(event, state) {
  const incoming = Date.parse(event.occurredAt ?? '');
  const current = Date.parse(state.eventOccurredAt ?? '');
  return Number.isFinite(incoming) && Number.isFinite(current) && incoming > current;
}

function transitionBookingState(current, event) {
  const state = {
    activeBookingUid: current?.activeBookingUid ?? null,
    appointmentStart: current?.appointmentStart ?? null,
    status: current?.status ?? 'none',
    eventOccurredAt: current?.eventOccurredAt ?? null,
    supersededUids: unique(current?.supersededUids ?? []),
    cancelledUids: unique(current?.cancelledUids ?? []),
    recentEvents: current?.recentEvents ?? {},
    revision: current?.revision ?? 0,
  };
  const digest = eventDigest(event);
  if (state.recentEvents[digest]?.revision === state.revision) {
    return { state, decision: { stale: state.recentEvents[digest].stale } };
  }

  let stale = olderThanCurrent(event, state);
  if (event.triggerEvent === 'BOOKING_CREATED') {
    stale ||= state.cancelledUids.includes(event.bookingUid)
      || state.supersededUids.includes(event.bookingUid)
      || (state.status === 'cancelled' && !event.occurredAt)
      || (Boolean(state.activeBookingUid) && state.activeBookingUid !== event.bookingUid
        && !(event.occurredAt && state.eventOccurredAt));
    if (!stale) {
      if (state.activeBookingUid && state.activeBookingUid !== event.bookingUid) {
        state.supersededUids = unique([...state.supersededUids, state.activeBookingUid]);
      }
      state.activeBookingUid = event.bookingUid;
      state.appointmentStart = event.startTime;
      state.status = 'scheduled';
      state.eventOccurredAt = event.occurredAt || state.eventOccurredAt;
    }
  } else if (event.triggerEvent === 'BOOKING_RESCHEDULED') {
    const oldUid = event.rescheduleUid;
    stale ||= state.cancelledUids.includes(event.bookingUid)
      || (state.cancelledUids.includes(oldUid) && !newerThanCurrent(event, state))
      || (state.status === 'cancelled' && !event.occurredAt)
      || (Boolean(state.activeBookingUid) && state.activeBookingUid !== event.bookingUid
        && state.activeBookingUid !== oldUid
        && !(event.occurredAt && state.eventOccurredAt));
    if (!stale) {
      state.supersededUids = unique([...state.supersededUids, oldUid]);
      state.activeBookingUid = event.bookingUid;
      state.appointmentStart = event.startTime;
      state.status = 'scheduled';
      state.eventOccurredAt = event.occurredAt || state.eventOccurredAt;
    }
  } else if (event.triggerEvent === 'BOOKING_CANCELLED') {
    state.cancelledUids = unique([...state.cancelledUids, event.bookingUid]);
    stale ||= Boolean(state.activeBookingUid) && state.activeBookingUid !== event.bookingUid;
    if (!stale) {
      state.activeBookingUid = null;
      state.appointmentStart = null;
      state.status = 'cancelled';
      state.eventOccurredAt = event.occurredAt || state.eventOccurredAt;
    }
  }

  state.revision += 1;
  const decision = { stale };
  const recentEntries = Object.entries({
    ...state.recentEvents,
    [digest]: { stale, revision: state.revision },
  }).slice(-20);
  state.recentEvents = Object.fromEntries(recentEntries);
  return { state, decision };
}

export class DurableBookingState {
  constructor({ store = getStore('crm-automation-bookings'), maxAttempts = 8 } = {}) {
    this.store = store;
    this.maxAttempts = maxAttempts;
  }

  storageKey({ email, dealId }) {
    const digest = crypto.createHash('sha256').update(`${email}\0${dealId}`).digest('hex');
    return `v1/lead-deal/${digest}`;
  }

  async apply(identity, event) {
    const key = this.storageKey(identity);
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const current = await this.store.getWithMetadata(key, { type: 'json' });
      const { state, decision } = transitionBookingState(current?.data, event);
      const saved = await this.store.setJSON(key, state, current
        ? { onlyIfMatch: current.etag }
        : { onlyIfNew: true });
      if (saved.modified) return { ...decision, state };
    }
    throw new Error('Booking state update conflicted too many times');
  }
}
