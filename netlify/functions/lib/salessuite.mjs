import { fetchWithTimeout, UpstreamError } from './upstream.mjs';

const API_BASE = 'https://api.salessuite.com/api';

function buildUrl(path, query = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

export class SalesSuiteClient {
  constructor({ apiKey = process.env.SALESSUITE_API_KEY, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
    if (!apiKey) throw new Error('SALESSUITE_API_KEY is missing');
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, { query, body, textBody } = {}) {
    const operation = `${method} ${path}`;
    const response = await fetchWithTimeout(this.fetch, buildUrl(path, query), {
      method,
      headers: {
        'x-api-key': this.apiKey,
        'x-lang': 'de',
        ...(textBody !== undefined
          ? { 'content-type': 'text/plain; charset=utf-8' }
          : { 'content-type': 'application/json' }),
      },
      body: textBody !== undefined ? textBody : body === undefined ? undefined : JSON.stringify(body),
    }, { service: 'SalesSuite', operation, timeoutMs: this.timeoutMs });
    if (!response.ok) {
      throw new UpstreamError('SalesSuite', operation, response.status);
    }
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return text; }
  }

  upsertContact({ email, firstName, lastName, phone, website, companyName, leadSource, referer, utm = {} }) {
    return this.request('POST', '/v1/contact/create-or-update-by-email', {
      body: {
        contact: {
          companyName: companyName || undefined,
          website: website || undefined,
          leadSource: leadSource || undefined,
          referer: referer || undefined,
          utm_source: utm.source || undefined,
          utm_medium: utm.medium || undefined,
          utm_campaign: utm.campaign || undefined,
          utm_content: utm.content || undefined,
          utm_term: utm.term || undefined,
        },
        contactPerson: {
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        },
      },
    });
  }

  findDealsByEmail(email) {
    return this.request('GET', '/v1/deal/by-email', { query: { email } });
  }

  createDeal({ name, contactId, pipelineId, phaseId }) {
    return this.request('POST', '/v1/deal', {
      query: { pipelineId, contactId, phaseId },
      body: { name },
    });
  }

  updateDeal(dealId, { pipelineId, phaseId, fields = {} }) {
    return this.request('PATCH', `/v1/deal/${encodeURIComponent(dealId)}`, {
      query: phaseId ? { pipelineId, phaseId } : {},
      body: fields,
    });
  }

  async hasEventMarker(dealId, marker) {
    let cursor;
    const seen = new Set();
    do {
      const result = await this.request('GET', '/v1/note', { query: { dealId, limit: 100, cursor } });
      const notes = Array.isArray(result) ? result : result?.notes ?? [];
      if (notes.some((note) => {
        const text = note?.text ?? note?.content ?? note?.note ?? note?.body ?? '';
        return String(text).includes(marker);
      })) return true;
      cursor = Array.isArray(result) ? undefined : result?.nextCursor ?? result?.next_cursor;
      if (cursor && seen.has(cursor)) break;
      if (cursor) seen.add(cursor);
    } while (cursor);
    return false;
  }

  createDealNote(dealId, text) {
    return this.request('POST', '/v1/note', {
      query: { dealId },
      textBody: text,
    });
  }
}
