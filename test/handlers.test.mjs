import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildCalHandler, buildSubmissionHandler } from '../netlify/functions/lib/handlers.mjs';

test('submission handler ignores forms other than erstgespraech', async () => {
  let processed = false;
  const handler = buildSubmissionHandler({ processLead: async () => { processed = true; } });
  const response = await handler({ body: JSON.stringify({ payload: { form_name: 'bewerbung', data: {} } }) });
  assert.equal(response.statusCode, 200);
  assert.equal(processed, false);
});

test('submission handler processes the normal website form', async () => {
  let received;
  const handler = buildSubmissionHandler({ processLead: async (event) => { received = event; return { status: 'processed' }; } });
  const response = await handler({ body: JSON.stringify({ payload: { id: 'sub-1', form_name: 'erstgespraech', data: { email: 'max@example.com' } } }) });
  assert.equal(response.statusCode, 200);
  assert.equal(received.eventId, 'sub-1');
});

test('Cal handler rejects an invalid signature', async () => {
  const handler = buildCalHandler({ secret: 'secret', processEvent: async () => { throw new Error('must not run'); } });
  const response = await handler({ body: '{}', headers: { 'x-cal-signature-256': 'bad' } });
  assert.equal(response.statusCode, 401);
});

test('Cal handler accepts a valid signature and processes the event', async () => {
  const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'u1', eventTypeId: 7242881, startTime: '2026-10-02T08:00:00.000Z', attendees: [{ email: 'max@example.com' }] } });
  const secret = 'secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  let received;
  const handler = buildCalHandler({ secret, processEvent: async (event) => { received = event; return { status: 'processed' }; } });
  const response = await handler({ body, headers: { 'x-cal-signature-256': signature } });
  assert.equal(response.statusCode, 200);
  assert.equal(received.bookingUid, 'u1');
});

async function signedFixture(name, processEvent = async () => ({ status: 'processed' })) {
  const body = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const secret = 'secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const handler = buildCalHandler({ secret, processEvent });
  return handler({ body, headers: { 'X-Cal-Signature-256': signature } });
}

test('Cal handler returns safe 400 for missing booking UID and start time', async () => {
  let processed = false;
  const response = await signedFixture('cal-missing-fields.json', async () => {
    processed = true;
    return { status: 'processed' };
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { status: 'invalid-payload' });
  assert.equal(processed, false);
});

test('Cal handler returns safe 400 for an invalid created start time', async () => {
  const body = JSON.stringify({
    triggerEvent: 'BOOKING_CREATED',
    payload: { uid: 'u-invalid-time', eventTypeId: 7242881, startTime: 'not-a-date', attendees: [{ email: 'max@example.com' }] },
  });
  const secret = 'secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const handler = buildCalHandler({ secret, processEvent: async () => { throw new Error('must not run'); } });
  const response = await handler({ body, headers: { 'x-cal-signature-256': signature } });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { status: 'invalid-payload' });
});

test('Cal handler returns safe 400 for signed malformed JSON', async () => {
  const body = '{';
  const secret = 'secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const handler = buildCalHandler({ secret, processEvent: async () => { throw new Error('must not run'); } });
  const response = await handler({ body, headers: { 'x-cal-signature-256': signature } });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { status: 'invalid-payload' });
});

test('Cal handler accepts legacy Netlify event shape with case-insensitive signed header', async () => {
  const response = await signedFixture('cal-created.json');
  assert.equal(response.statusCode, 200);
});

test('Cal reschedule and cancellation fixtures preserve webhook fields', async () => {
  const received = [];
  for (const fixture of ['cal-rescheduled.json', 'cal-cancelled.json']) {
    const response = await signedFixture(fixture, async (event) => {
      received.push(event);
      return { status: 'processed' };
    });
    assert.equal(response.statusCode, 200);
  }

  assert.equal(received[0].triggerEvent, 'BOOKING_RESCHEDULED');
  assert.equal(received[0].rescheduleUid, 'booking-original-1');
  assert.equal(received[1].triggerEvent, 'BOOKING_CANCELLED');
  assert.equal(received[1].cancellationReason, 'Private details that must not reach Slack');
});

test('handlers log only safe upstream metadata and event identifiers', async () => {
  const entries = [];
  const originalError = console.error;
  console.error = (entry) => entries.push(JSON.parse(entry));
  try {
    const error = new Error('response contained max@example.com and private body');
    error.service = 'SalesSuite';
    error.operation = 'POST /v1/note';
    error.status = 502;
    const handler = buildSubmissionHandler({ processLead: async () => { throw error; } });
    const response = await handler({ body: JSON.stringify({ payload: { id: 'sub-safe-1', form_name: 'erstgespraech', data: { email: 'max@example.com' } } }) });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(entries, [{
      event: 'website-lead', eventId: 'sub-safe-1', status: 'error',
      service: 'SalesSuite', operation: 'POST /v1/note', httpStatus: 502,
    }]);
    assert.doesNotMatch(JSON.stringify(entries), /max@example\.com|private body/i);
  } finally {
    console.error = originalError;
  }
});
