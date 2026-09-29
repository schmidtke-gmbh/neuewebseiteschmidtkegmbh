import { fetchWithTimeout, UpstreamError } from './upstream.mjs';

export class SlackNotifier {
  constructor({ webhookUrl = process.env.SLACK_WEBHOOK_URL, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
    if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is missing');
    this.webhookUrl = webhookUrl;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async send({
    title, status, name, company, email, phone, industry, service, website, budget,
  }) {
    const safe = (value, fallback = '–') => {
      const text = String(value ?? '').trim() || fallback;
      return text.length > 500 ? `${text.slice(0, 497)}…` : text;
    };
    const hasLeadDetails = [email, phone, company, industry, service, website, budget]
      .some((value) => String(value ?? '').trim());
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: safe(title).slice(0, 150), emoji: true } },
    ];
    if (hasLeadDetails) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: `👤 Kontakt\nName: ${safe(name)}\nE-Mail: ${safe(email)}\nTelefon: ${safe(phone)}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: `🏢 Unternehmen\nUnternehmen: ${safe(company)}\nBranche: ${safe(industry)}\nAngebot: ${safe(service)}\nWebsite: ${safe(website)}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: { type: 'plain_text', text: `💰 Werbebudget\n${safe(budget)}`, emoji: true },
        },
      );
    } else {
      blocks.push({
        type: 'section',
        text: { type: 'plain_text', text: `Name: ${safe(name)}`, emoji: true },
      });
    }
    blocks.push({
      type: 'section',
      text: { type: 'plain_text', text: safe(status), emoji: true },
    });
    const payload = {
      text: 'CRM automation update',
      blocks,
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
