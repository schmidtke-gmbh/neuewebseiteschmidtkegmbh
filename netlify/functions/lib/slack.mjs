import { fetchWithTimeout, UpstreamError } from './upstream.mjs';

export class SlackNotifier {
  constructor({ webhookUrl = process.env.SLACK_WEBHOOK_URL, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
    if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is missing');
    this.webhookUrl = webhookUrl;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async send({ title, status, name, company }) {
    const detail = [name ? `Name: ${name}` : '', company ? `Unternehmen: ${company}` : '', status]
      .filter(Boolean)
      .join('\n');
    const payload = {
      text: 'CRM automation update',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: String(title), emoji: true } },
        { type: 'section', text: { type: 'plain_text', text: detail, emoji: true } },
      ],
    };
    const response = await fetchWithTimeout(this.fetch, this.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }, { service: 'Slack', operation: 'webhook', timeoutMs: this.timeoutMs });
    if (!response.ok) throw new UpstreamError('Slack', 'webhook', response.status);
    const body = await response.text();
    if (body.trim() !== 'ok') throw new UpstreamError('Slack', 'webhook', response.status);
  }
}
