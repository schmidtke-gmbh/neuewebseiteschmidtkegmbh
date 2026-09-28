import assert from 'node:assert/strict';
import test from 'node:test';

import { DurableBookingState, DurableIdempotency } from '../netlify/functions/lib/idempotency.mjs';

class MemoryBlobStore {
  constructor() {
    this.entries = new Map();
    this.version = 0;
  }

  async getWithMetadata(key) {
    const entry = this.entries.get(key);
    return entry ? structuredClone(entry) : null;
  }

  async setJSON(key, data, options = {}) {
    const current = this.entries.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch !== undefined && current?.etag !== options.onlyIfMatch) return { modified: false };
    const etag = `etag-${++this.version}`;
    this.entries.set(key, { data: structuredClone(data), etag, metadata: {} });
    return { modified: true, etag };
  }
}

class EdgeCompatibleMemoryBlobStore extends MemoryBlobStore {
  async getWithMetadata(key, options = {}) {
    if (options.consistency === 'strong') {
      throw new Error('Lambda Blobs context has no uncachedEdgeURL');
    }
    return super.getWithMetadata(key, options);
  }
}

test('Lambda edge stores work without requesting unavailable strong consistency', async () => {
  const store = new EdgeCompatibleMemoryBlobStore();
  const idempotency = new DurableIdempotency({ store, ownerFactory: () => 'edge-owner' });

  await assert.rejects(idempotency.runStep('edge-retry', 'crm', async () => {
    throw new Error('first attempt fails');
  }));
  const retry = await idempotency.runStep('edge-retry', 'crm', async () => ({ recovered: true }));

  const bookings = new DurableBookingState({ store });
  const booking = await bookings.apply({ email: 'edge@example.com', dealId: 'deal-edge' }, {
    triggerEvent: 'BOOKING_CREATED', bookingUid: 'edge-booking',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '2026-09-28T14:00:00.000Z',
  });

  assert.deepEqual(retry, { status: 'executed', value: { recovered: true } });
  assert.equal(booking.stale, false);
  assert.equal(booking.state.activeBookingUid, 'edge-booking');
});

test('concurrent duplicate claims execute a step only once', async () => {
  const store = new MemoryBlobStore();
  const idempotency = new DurableIdempotency({ store, ownerFactory: () => crypto.randomUUID() });
  let executions = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const operation = async () => {
    executions += 1;
    await gate;
    return { dealId: 'deal-1' };
  };

  const first = idempotency.runStep('form:submission-1', 'crm', operation);
  await new Promise((resolve) => setImmediate(resolve));
  const second = await idempotency.runStep('form:submission-1', 'crm', operation);
  release();
  const firstResult = await first;

  assert.equal(executions, 1);
  assert.equal(second.status, 'in-progress');
  assert.deepEqual(firstResult, { status: 'executed', value: { dealId: 'deal-1' } });
});

test('completed CRM and failed Slack are tracked independently for retry', async () => {
  const store = new MemoryBlobStore();
  const idempotency = new DurableIdempotency({ store, ownerFactory: () => crypto.randomUUID() });
  let crmExecutions = 0;
  let slackExecutions = 0;

  await idempotency.runStep('cal:booking-1', 'crm', async () => {
    crmExecutions += 1;
    return { dealId: 'deal-1' };
  });
  await assert.rejects(idempotency.runStep('cal:booking-1', 'slack', async () => {
    slackExecutions += 1;
    throw new Error('temporary failure');
  }));

  const crmRetry = await idempotency.runStep('cal:booking-1', 'crm', async () => {
    crmExecutions += 1;
  });
  const slackRetry = await idempotency.runStep('cal:booking-1', 'slack', async () => {
    slackExecutions += 1;
    return { sent: true };
  });

  assert.equal(crmExecutions, 1);
  assert.equal(slackExecutions, 2);
  assert.equal(crmRetry.status, 'done');
  assert.equal(slackRetry.status, 'executed');
});

test('stale processing locks are reclaimed with an ETag conditional write', async () => {
  const store = new MemoryBlobStore();
  let now = Date.parse('2026-09-28T10:00:00.000Z');
  const idempotency = new DurableIdempotency({
    store,
    now: () => now,
    staleAfterMs: 60_000,
    ownerFactory: () => 'owner-new',
  });
  const key = idempotency.storageKey('form:submission-stale', 'crm');
  await store.setJSON(key, {
    status: 'processing', owner: 'owner-old', startedAt: '2026-09-28T09:00:00.000Z',
  }, { onlyIfNew: true });

  let executions = 0;
  const result = await idempotency.runStep('form:submission-stale', 'crm', async () => {
    executions += 1;
    return { recovered: true };
  });

  assert.equal(executions, 1);
  assert.deepEqual(result, { status: 'executed', value: { recovered: true } });
  const saved = await store.getWithMetadata(key, { type: 'json' });
  assert.equal(saved.data.status, 'done');
  assert.equal(saved.data.owner, 'owner-new');
});

test('booking state keeps a cancellation authoritative over a delayed create', async () => {
  const store = new MemoryBlobStore();
  const bookings = new DurableBookingState({ store });
  const identity = { email: 'max@example.com', dealId: 'deal-1' };

  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CREATED', bookingUid: 'booking-1',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '2026-09-28T08:00:00.000Z',
  });
  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CANCELLED', bookingUid: 'booking-1',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '2026-09-28T10:00:00.000Z',
  });
  const delayed = await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CREATED', bookingUid: 'booking-1',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '2026-09-28T08:00:00.000Z',
  });

  assert.equal(delayed.stale, true);
  assert.equal(delayed.state.activeBookingUid, null);
  assert.equal(delayed.state.appointmentStart, null);
  assert.deepEqual(delayed.state.cancelledUids, ['booking-1']);
});

test('booking state ignores cancellation for an old UID after rescheduling', async () => {
  const store = new MemoryBlobStore();
  const bookings = new DurableBookingState({ store });
  const identity = { email: 'max@example.com', dealId: 'deal-1' };

  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CREATED', bookingUid: 'booking-old',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '',
  });
  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_RESCHEDULED', bookingUid: 'booking-new', rescheduleUid: 'booking-old',
    startTime: '2026-10-03T09:00:00.000Z', occurredAt: '',
  });
  const oldCancellation = await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CANCELLED', bookingUid: 'booking-old',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '',
  });

  assert.equal(oldCancellation.stale, true);
  assert.equal(oldCancellation.state.activeBookingUid, 'booking-new');
  assert.equal(oldCancellation.state.appointmentStart, '2026-10-03T09:00:00.000Z');
  assert.deepEqual(oldCancellation.state.supersededUids, ['booking-old']);
});

test('booking state does not restore a cancelled appointment from a delayed reschedule without timestamps', async () => {
  const store = new MemoryBlobStore();
  const bookings = new DurableBookingState({ store });
  const identity = { email: 'max@example.com', dealId: 'deal-1' };

  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CREATED', bookingUid: 'booking-old',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '',
  });
  await bookings.apply(identity, {
    triggerEvent: 'BOOKING_CANCELLED', bookingUid: 'booking-old',
    startTime: '2026-10-02T08:00:00.000Z', occurredAt: '',
  });
  const delayed = await bookings.apply(identity, {
    triggerEvent: 'BOOKING_RESCHEDULED', bookingUid: 'booking-new', rescheduleUid: 'booking-old',
    startTime: '2026-10-03T09:00:00.000Z', occurredAt: '',
  });

  assert.equal(delayed.stale, true);
  assert.equal(delayed.state.activeBookingUid, null);
  assert.equal(delayed.state.appointmentStart, null);
});
