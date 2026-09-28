import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractCalEvent,
  parseNetlifySubmission,
  verifyCalSignature,
} from '../netlify/functions/lib/parsing.mjs';

test('parses the normal Netlify form submission', () => {
  const parsed = parseNetlifySubmission(JSON.stringify({
    payload: {
      id: 'submission-1',
      form_name: 'erstgespraech',
      data: { email: 'MAX@example.com', vorname: 'Max' },
    },
  }));
  assert.equal(parsed.formName, 'erstgespraech');
  assert.equal(parsed.eventId, 'submission-1');
  assert.equal(parsed.data.email, 'MAX@example.com');
});

test('rejects unrelated Netlify forms', () => {
  const parsed = parseNetlifySubmission(JSON.stringify({ payload: { id: 'x', form_name: 'bewerbung', data: {} } }));
  assert.equal(parsed, null);
});

test('derives a stable submission ID when Netlify omits its ID', async () => {
  const raw = await readFile(new URL('./fixtures/netlify-submission.json', import.meta.url), 'utf8');
  const first = parseNetlifySubmission(raw);
  const second = parseNetlifySubmission(JSON.stringify(JSON.parse(raw)));

  assert.match(first.eventId, /^derived-[a-f0-9]{64}$/);
  assert.equal(second.eventId, first.eventId);
});

test('duplicate fixture deliveries produce the same canonical event ID', async () => {
  const raw = await readFile(new URL('./fixtures/netlify-submission.json', import.meta.url), 'utf8');
  const reordered = JSON.stringify({
    payload: {
      data: JSON.parse(raw).payload.data,
      form_name: 'erstgespraech',
    },
  });

  assert.equal(parseNetlifySubmission(raw).eventId, parseNetlifySubmission(reordered).eventId);
});

test('extracts a Cal.com booking-created payload', () => {
  const event = extractCalEvent({
    triggerEvent: 'BOOKING_CREATED',
    payload: {
      uid: 'uid-1',
      eventTypeId: 7242881,
      startTime: '2026-10-02T08:00:00.000Z',
      attendees: [{ name: 'Max Mustermann', email: 'max@example.com' }],
    },
  });
  assert.deepEqual(event, {
    triggerEvent: 'BOOKING_CREATED',
    eventTypeId: 7242881,
    bookingUid: 'uid-1',
    email: 'max@example.com',
    name: 'Max Mustermann',
    startTime: '2026-10-02T08:00:00.000Z',
    rescheduleUid: '',
    cancellationReason: '',
    occurredAt: '',
  });
});

test('extracts the most specific stable Cal event occurrence timestamp', () => {
  const cancelled = extractCalEvent({
    createdAt: '2026-09-28T08:00:00.000Z',
    payload: {
      uid: 'uid-cancelled', eventTypeId: 7242881,
      cancelledAt: '2026-09-28T10:00:00.000Z',
      updatedAt: '2026-09-28T09:00:00.000Z',
    },
    triggerEvent: 'BOOKING_CANCELLED',
  });
  const rescheduled = extractCalEvent({
    createdAt: '2026-09-28T08:00:00.000Z',
    payload: {
      uid: 'uid-rescheduled', eventTypeId: 7242881,
      rescheduledAt: '2026-09-28T11:00:00.000Z',
      updatedAt: '2026-09-28T09:00:00.000Z',
    },
    triggerEvent: 'BOOKING_RESCHEDULED',
  });
  const created = extractCalEvent({
    createdAt: '2026-09-28T08:00:00.000Z',
    payload: { uid: 'uid-created', eventTypeId: 7242881 },
    triggerEvent: 'BOOKING_CREATED',
  });

  assert.equal(cancelled.occurredAt, '2026-09-28T10:00:00.000Z');
  assert.equal(rescheduled.occurredAt, '2026-09-28T11:00:00.000Z');
  assert.equal(created.occurredAt, '2026-09-28T08:00:00.000Z');
});

test('validates Cal.com HMAC signatures', () => {
  const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED' });
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyCalSignature(body, signature, secret), true);
  assert.equal(verifyCalSignature(body, 'bad-signature', secret), false);
});
