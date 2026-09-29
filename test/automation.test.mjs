import assert from 'node:assert/strict';
import test from 'node:test';

import {
  processCalEvent,
  processWebsiteLead,
} from '../netlify/functions/lib/automation.mjs';
import { DurableBookingState, DurableIdempotency } from '../netlify/functions/lib/idempotency.mjs';

const config = {
  pipelineId: 'pipeline-setter',
  phases: {
    inquiry: 'phase-inquiry',
    firstCall: 'phase-first-call',
    followup: 'phase-followup',
    qualified: 'phase-qualified',
    strategy: 'phase-strategy',
    sold: 'phase-sold',
    lost: 'phase-lost',
    unqualified: 'phase-unqualified',
  },
  websiteEventTypeId: 7242881,
};

function immediateIdempotency() {
  return {
    async runStep(_eventKey, _step, operation) {
      return { status: 'executed', value: await operation() };
    },
  };
}

function makeDeps({
  deals = [], duplicate = false, idempotency = immediateIdempotency(),
  bookingState = new DurableBookingState({ store: new MemoryBlobStore() }),
} = {}) {
  const calls = [];
  const client = {
    async upsertContact(input) {
      calls.push(['upsertContact', input]);
      return { contact: { id: 'contact-1' } };
    },
    async findDealsByEmail(email) {
      calls.push(['findDealsByEmail', email]);
      return deals;
    },
    async createDeal(input) {
      calls.push(['createDeal', input]);
      return { deal: { id: 'deal-created', phaseId: input.phaseId } };
    },
    async updateDeal(id, input) {
      calls.push(['updateDeal', id, input]);
      return { deal: { id, ...input } };
    },
    async hasEventMarker(dealId, marker) {
      calls.push(['hasEventMarker', dealId, marker]);
      return duplicate;
    },
    async createDealNote(dealId, text) {
      calls.push(['createDealNote', dealId, text]);
      return { id: 'note-1' };
    },
  };
  const slack = {
    async send(message) {
      calls.push(['slack', message]);
    },
  };
  return { calls, client, slack, config, idempotency, bookingState };
}

test('new website form sends the complete lead information to Slack', async () => {
  const deps = makeDeps();
  const result = await processWebsiteLead({
    eventId: 'submission-1',
    data: {
      email: ' Max@Example.com ',
      vorname: 'Max',
      nachname: 'Mustermann',
      firma: 'Beispiel GmbH',
      telefon: '+49 123',
      website: 'https://example.com',
      branche: 'Beratung',
      dienstleistung: 'SEO',
      budget: 'Bis 1.000 € / Monat',
      utm_source: 'google',
    },
  }, deps);

  assert.equal(result.status, 'processed');
  assert.ok(deps.calls.some(([callName, input]) => callName === 'createDeal'
    && input.phaseId === config.phases.inquiry
    && input.name === 'Max Mustermann'));
  assert.ok(deps.calls.some(([name, , text]) => name === 'createDealNote' && text.includes('Automation-ID: form:submission-1')));
  const slackMessage = deps.calls.find(([name]) => name === 'slack')[1];
  assert.deepEqual(slackMessage, {
    title: '🔔 Neue Anfrage über die Webseite!',
    status: 'SalesSuite: Anfrage erfasst',
    name: 'Max Mustermann',
    company: 'Beispiel GmbH',
    email: 'max@example.com',
    phone: '+49 123',
    industry: 'Beratung',
    service: 'SEO',
    website: 'https://example.com',
    budget: 'Bis 1.000 € / Monat',
  });
});

test('repeat website form does not downgrade an existing first-call deal', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.firstCall, archived: false }] });
  await processWebsiteLead({ eventId: 'submission-2', data: { email: 'max@example.com', vorname: 'Max' } }, deps);

  assert.equal(deps.calls.filter(([name]) => name === 'createDeal').length, 0);
  assert.equal(deps.calls.filter(([name]) => name === 'updateDeal').length, 0);
  assert.ok(deps.calls.some(([name]) => name === 'createDealNote'));
});

test('CRM marker duplicate suppresses CRM mutation but Slack remains independently idempotent', async () => {
  const idempotency = new DurableIdempotency({ store: new MemoryBlobStore(), ownerFactory: () => crypto.randomUUID() });
  const deps = makeDeps({
    deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.inquiry, archived: false }],
    duplicate: true,
    idempotency,
  });
  const event = { eventId: 'submission-3', data: { email: 'max@example.com' } };
  const first = await processWebsiteLead(event, deps);
  const second = await processWebsiteLead(event, deps);

  assert.equal(first.status, 'processed');
  assert.equal(second.status, 'duplicate');
  assert.equal(deps.calls.filter(([name]) => name === 'createDealNote').length, 0);
  assert.equal(deps.calls.filter(([name]) => name === 'slack').length, 1);
});

test('new booking moves an inquiry deal to first call and stores appointment', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.inquiry, archived: false }] });
  await processCalEvent({
    triggerEvent: 'BOOKING_CREATED',
    eventTypeId: 7242881,
    bookingUid: 'booking-1',
    email: 'max@example.com',
    name: 'Max Mustermann',
    startTime: '2026-10-02T08:00:00.000Z',
  }, deps);

  assert.ok(deps.calls.some(([name, input]) => name === 'upsertContact' && input.firstName === 'Max' && input.lastName === 'Mustermann'));
  assert.ok(deps.calls.some(([name, id, input]) => name === 'updateDeal' && id === 'deal-1' && input.phaseId === config.phases.firstCall && input.fields.x_termin === '2026-10-02T08:00:00.000Z'));
  assert.ok(deps.calls.some(([name, message]) => name === 'slack' && message.title === 'Erstgespräch gebucht'));
});

test('Cal Slack alerts never use attendee email as a fallback name', async () => {
  const deps = makeDeps();
  await processCalEvent({
    triggerEvent: 'BOOKING_CREATED', eventTypeId: 7242881, bookingUid: 'booking-no-name',
    email: 'private@example.com', name: '', startTime: '2026-10-02T08:00:00.000Z',
  }, deps);

  const slackMessage = deps.calls.find(([name]) => name === 'slack')[1];
  assert.equal(slackMessage.name, 'Unbekannt');
  assert.doesNotMatch(JSON.stringify(slackMessage), /private@example\.com/i);
});

test('cancelled first call moves the deal to follow-up and clears appointment', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.firstCall, archived: false }] });
  await processCalEvent({
    triggerEvent: 'BOOKING_CANCELLED',
    eventTypeId: 7242881,
    bookingUid: 'booking-2',
    email: 'max@example.com',
    name: 'Max Mustermann',
    startTime: '2026-10-02T08:00:00.000Z',
    cancellationReason: 'Private cancellation details',
  }, deps);

  assert.ok(deps.calls.some(([name, , input]) => name === 'updateDeal' && input.phaseId === config.phases.followup && input.fields.x_termin === null));
  const slackMessage = deps.calls.find(([name]) => name === 'slack')[1];
  assert.equal(slackMessage.title, 'Erstgespräch abgesagt');
  assert.doesNotMatch(JSON.stringify(slackMessage), /max@example\.com|Private cancellation details|Termin/i);
});

test('cancellation never downgrades a sold deal', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.sold, archived: false }] });
  await processCalEvent({
    triggerEvent: 'BOOKING_CANCELLED', eventTypeId: 7242881, bookingUid: 'booking-3', email: 'max@example.com', startTime: '2026-10-02T08:00:00.000Z',
  }, deps);

  assert.equal(deps.calls.filter(([name]) => name === 'updateDeal').length, 0);
  assert.ok(deps.calls.some(([name]) => name === 'createDealNote'));
  assert.equal(deps.calls.find(([name]) => name === 'slack')[1].status, 'SalesSuite: Keine Phasenänderung');
});

test('cancellation clears a strategy appointment without changing its phase', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.strategy, archived: false }] });
  await processCalEvent({
    triggerEvent: 'BOOKING_CANCELLED', eventTypeId: 7242881, bookingUid: 'booking-strategy',
    email: 'max@example.com', startTime: '2026-10-02T08:00:00.000Z',
  }, deps);

  assert.ok(deps.calls.some(([name, , input]) => name === 'updateDeal'
    && input.phaseId === undefined && input.fields.x_termin === null));
  assert.equal(deps.calls.find(([name]) => name === 'slack')[1].status, 'SalesSuite: Keine Phasenänderung');
});

test('created then cancelled then delayed created does not restore the appointment', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.firstCall, archived: false }] });
  const base = { eventTypeId: 7242881, bookingUid: 'booking-delayed', email: 'max@example.com', startTime: '2026-10-02T08:00:00.000Z' };
  await processCalEvent({ ...base, triggerEvent: 'BOOKING_CREATED', occurredAt: '2026-09-28T08:00:00.000Z' }, deps);
  await processCalEvent({ ...base, triggerEvent: 'BOOKING_CANCELLED', occurredAt: '2026-09-28T10:00:00.000Z' }, deps);
  await processCalEvent({ ...base, triggerEvent: 'BOOKING_CREATED', occurredAt: '2026-09-28T08:00:00.000Z' }, deps);

  assert.equal(deps.calls.filter(([name]) => name === 'updateDeal').length, 2);
  const slackMessages = deps.calls.filter(([name]) => name === 'slack').map(([, message]) => message);
  assert.equal(slackMessages.at(-1).status, 'SalesSuite: Veraltetes Ereignis ignoriert');
});

test('cancellation for an old UID does not clear a newer rescheduled appointment', async () => {
  const deps = makeDeps({ deals: [{ id: 'deal-1', pipelineId: config.pipelineId, phaseId: config.phases.firstCall, archived: false }] });
  await processCalEvent({
    triggerEvent: 'BOOKING_CREATED', eventTypeId: 7242881, bookingUid: 'booking-old',
    email: 'max@example.com', startTime: '2026-10-02T08:00:00.000Z',
  }, deps);
  await processCalEvent({
    triggerEvent: 'BOOKING_RESCHEDULED', eventTypeId: 7242881, bookingUid: 'booking-new', rescheduleUid: 'booking-old',
    email: 'max@example.com', startTime: '2026-10-03T09:00:00.000Z',
  }, deps);
  await processCalEvent({
    triggerEvent: 'BOOKING_CANCELLED', eventTypeId: 7242881, bookingUid: 'booking-old',
    email: 'max@example.com', startTime: '2026-10-02T08:00:00.000Z',
  }, deps);

  assert.equal(deps.calls.filter(([name]) => name === 'updateDeal').length, 2);
  const latestUpdate = deps.calls.filter(([name]) => name === 'updateDeal').at(-1)[2];
  assert.equal(latestUpdate.fields.x_termin, '2026-10-03T09:00:00.000Z');
  assert.equal(deps.calls.filter(([name]) => name === 'slack').at(-1)[1].status, 'SalesSuite: Veraltetes Ereignis ignoriert');
});

test('funding and customer event types are ignored', async () => {
  const deps = makeDeps();
  const result = await processCalEvent({
    triggerEvent: 'BOOKING_CREATED', eventTypeId: 4588626, bookingUid: 'funding-1', email: 'max@example.com',
  }, deps);

  assert.equal(result.status, 'ignored');
  assert.equal(deps.calls.length, 0);
});

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

test('Slack retry after CRM success does not repeat CRM mutations', async () => {
  const idempotency = new DurableIdempotency({ store: new MemoryBlobStore(), ownerFactory: () => crypto.randomUUID() });
  const deps = makeDeps({ idempotency });
  let attempts = 0;
  deps.slack.send = async (message) => {
    deps.calls.push(['slack', message]);
    attempts += 1;
    if (attempts === 1) throw new Error('temporary Slack failure');
  };
  const event = { eventId: 'submission-retry', data: { email: 'max@example.com', vorname: 'Max' } };

  await assert.rejects(processWebsiteLead(event, deps), /temporary Slack failure/);
  const result = await processWebsiteLead(event, deps);

  assert.equal(result.status, 'processed');
  assert.equal(deps.calls.filter(([name]) => name === 'upsertContact').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'createDeal').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'createDealNote').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'slack').length, 2);
});

test('note response loss retry uses the CRM marker but still sends Slack once', async () => {
  let markerExists = false;
  let firstCompletion = true;
  const idempotency = {
    async runStep(_eventKey, step, operation) {
      const value = await operation();
      if (step === 'crm' && firstCompletion) {
        firstCompletion = false;
        throw new Error('blob completion response lost');
      }
      return { status: 'executed', value };
    },
  };
  const deps = makeDeps({ idempotency });
  deps.client.hasEventMarker = async () => markerExists;
  deps.client.createDealNote = async (dealId, text) => {
    deps.calls.push(['createDealNote', dealId, text]);
    markerExists = true;
    return { id: 'note-1' };
  };
  const event = { eventId: 'submission-response-loss', data: { email: 'max@example.com', vorname: 'Max' } };

  await assert.rejects(processWebsiteLead(event, deps), /blob completion response lost/);
  const result = await processWebsiteLead(event, deps);

  assert.equal(result.status, 'processed');
  assert.equal(deps.calls.filter(([name]) => name === 'createDealNote').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'slack').length, 1);
});

test('concurrent duplicate website deliveries do not duplicate CRM or Slack', async () => {
  const idempotency = new DurableIdempotency({ store: new MemoryBlobStore(), ownerFactory: () => crypto.randomUUID() });
  const deps = makeDeps({ idempotency });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const originalUpsert = deps.client.upsertContact;
  deps.client.upsertContact = async (input) => {
    await gate;
    return originalUpsert(input);
  };
  const event = { eventId: 'submission-concurrent', data: { email: 'max@example.com', vorname: 'Max' } };

  const first = processWebsiteLead(event, deps);
  await new Promise((resolve) => setImmediate(resolve));
  const second = await processWebsiteLead(event, deps);
  release();
  const firstResult = await first;

  assert.equal(second.status, 'processing');
  assert.equal(firstResult.status, 'processed');
  assert.equal(deps.calls.filter(([name]) => name === 'upsertContact').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'createDeal').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'createDealNote').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'slack').length, 1);
});
