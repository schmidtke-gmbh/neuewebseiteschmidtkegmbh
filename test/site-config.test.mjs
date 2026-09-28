import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the normal thank-you page embeds the website first-call calendar', async () => {
  const html = await readFile(new URL('../danke.html', import.meta.url), 'utf8');
  assert.match(html, /schmidtke-gmbh\/20-min-erstgesprach-webseite/);
  assert.doesNotMatch(html, /20-min-forderanfrage-gesprach-am-telefon/);
});

test('Netlify is configured to deploy functions', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(config, /functions\s*=\s*"netlify\/functions"/);
});

test('both Netlify entry points use durable blob idempotency', async () => {
  const submission = await readFile(new URL('../netlify/functions/submission-created.mjs', import.meta.url), 'utf8');
  const cal = await readFile(new URL('../netlify/functions/cal-booking.mjs', import.meta.url), 'utf8');

  for (const source of [submission, cal]) {
    assert.match(source, /DurableIdempotency/);
    assert.match(source, /idempotency/);
  }
});
