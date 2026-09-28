import assert from 'node:assert/strict';
import test from 'node:test';

import { SalesSuiteClient } from '../netlify/functions/lib/salessuite.mjs';
import { SlackNotifier } from '../netlify/functions/lib/slack.mjs';

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function captureFetch(responses = [jsonResponse({})]) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return responses.shift() ?? jsonResponse({});
    },
  };
}

test('SalesSuite contact upsert matches the HTTP contract', async () => {
  const capture = captureFetch([jsonResponse({ contact: { id: 'contact-1' } })]);
  const client = new SalesSuiteClient({ apiKey: 'test-key', fetchImpl: capture.fetch });

  await client.upsertContact({
    email: 'max@example.com', firstName: 'Max', lastName: 'Mustermann', phone: '+49 123',
    website: 'https://example.com', companyName: 'Beispiel GmbH', leadSource: 'Webseite',
    referer: 'https://google.example', utm: { source: 'google', medium: 'cpc', campaign: 'brand' },
  });

  const [{ url, options }] = capture.calls;
  assert.equal(url, 'https://api.salessuite.com/api/v1/contact/create-or-update-by-email');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['x-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(options.body), {
    contact: {
      companyName: 'Beispiel GmbH', website: 'https://example.com', leadSource: 'Webseite',
      referer: 'https://google.example', utm_source: 'google', utm_medium: 'cpc',
      utm_campaign: 'brand',
    },
    contactPerson: { email: 'max@example.com', firstName: 'Max', lastName: 'Mustermann', phone: '+49 123' },
  });
  assert.ok(options.signal instanceof AbortSignal);
});

test('SalesSuite deal and appointment requests match the HTTP contract', async () => {
  const capture = captureFetch([
    jsonResponse([]),
    jsonResponse({ deal: { id: 'deal-1' } }),
    jsonResponse({ deal: { id: 'deal-1' } }),
  ]);
  const client = new SalesSuiteClient({ apiKey: 'test-key', fetchImpl: capture.fetch });

  await client.findDealsByEmail('max@example.com');
  await client.createDeal({ name: 'Website-Anfrage – Max', contactId: 'contact-1', pipelineId: 'pipeline-1', phaseId: 'phase-1' });
  await client.updateDeal('deal-1', { pipelineId: 'pipeline-1', phaseId: 'phase-2', fields: { x_termin: '2026-10-02T08:00:00.000Z' } });

  assert.equal(capture.calls[0].url, 'https://api.salessuite.com/api/v1/deal/by-email?email=max%40example.com');
  assert.equal(capture.calls[0].options.method, 'GET');
  assert.equal(capture.calls[1].url, 'https://api.salessuite.com/api/v1/deal?pipelineId=pipeline-1&contactId=contact-1&phaseId=phase-1');
  assert.deepEqual(JSON.parse(capture.calls[1].options.body), { name: 'Website-Anfrage – Max' });
  assert.equal(capture.calls[2].url, 'https://api.salessuite.com/api/v1/deal/deal-1?pipelineId=pipeline-1&phaseId=phase-2');
  assert.deepEqual(JSON.parse(capture.calls[2].options.body), { x_termin: '2026-10-02T08:00:00.000Z' });
});

test('SalesSuite note lookup follows cursors and note creation matches the HTTP contract', async () => {
  const capture = captureFetch([
    jsonResponse({ notes: [{ text: 'older note' }], nextCursor: 'cursor-2' }),
    jsonResponse({ notes: [{ text: 'Automation-ID: form:submission-1' }] }),
    new Response('', { status: 200 }),
  ]);
  const client = new SalesSuiteClient({ apiKey: 'test-key', fetchImpl: capture.fetch });

  assert.equal(await client.hasEventMarker('deal-1', 'Automation-ID: form:submission-1'), true);
  await client.createDealNote('deal-1', 'note body');

  assert.equal(capture.calls[0].url, 'https://api.salessuite.com/api/v1/note?dealId=deal-1&limit=100');
  assert.equal(capture.calls[1].url, 'https://api.salessuite.com/api/v1/note?dealId=deal-1&limit=100&cursor=cursor-2');
  assert.equal(capture.calls[2].url, 'https://api.salessuite.com/api/v1/note?dealId=deal-1');
  assert.equal(capture.calls[2].options.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(capture.calls[2].options.body, 'note body');
});

test('upstream failures redact response bodies and include only safe metadata', async () => {
  const sales = new SalesSuiteClient({
    apiKey: 'test-key',
    fetchImpl: async () => new Response('customer-secret@example.com', { status: 502 }),
  });
  const slack = new SlackNotifier({
    webhookUrl: 'https://hooks.slack.test/services/test',
    fetchImpl: async () => new Response('private webhook failure detail', { status: 500 }),
  });

  await assert.rejects(sales.findDealsByEmail('max@example.com'), (error) => {
    assert.equal(error.service, 'SalesSuite');
    assert.equal(error.operation, 'GET /v1/deal/by-email');
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /customer-secret|example\.com/i);
    return true;
  });
  await assert.rejects(slack.send({ title: 'Test', status: 'Erfasst', name: 'Max', company: 'Beispiel GmbH' }), (error) => {
    assert.equal(error.service, 'Slack');
    assert.equal(error.operation, 'webhook');
    assert.equal(error.status, 500);
    assert.doesNotMatch(error.message, /private webhook/i);
    return true;
  });
});

test('Slack uses plain_text blocks and sends only operational identity fields', async () => {
  const capture = captureFetch([new Response('ok', { status: 200 })]);
  const slack = new SlackNotifier({ webhookUrl: 'https://hooks.slack.test/services/test', fetchImpl: capture.fetch });

  await slack.send({ title: 'Neue Webseitenanfrage <script>', status: 'SalesSuite: Anfrage erfasst', name: 'Max *Admin*', company: 'Beispiel & Co.' });

  const payload = JSON.parse(capture.calls[0].options.body);
  assert.equal(payload.text, 'CRM automation update');
  assert.ok(payload.blocks.every((block) => block.text?.type === 'plain_text'));
  assert.match(JSON.stringify(payload), /Max \*Admin\*/);
  assert.doesNotMatch(JSON.stringify(payload), /mrkdwn|email|phone|website|reason/i);
  assert.ok(capture.calls[0].options.signal instanceof AbortSignal);
});

test('SalesSuite requests abort after the configured timeout', async () => {
  const client = new SalesSuiteClient({
    apiKey: 'test-key',
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });

  await assert.rejects(client.findDealsByEmail('max@example.com'), (error) => {
    assert.equal(error.service, 'SalesSuite');
    assert.equal(error.operation, 'GET /v1/deal/by-email');
    assert.equal(error.status, undefined);
    return true;
  });
});
