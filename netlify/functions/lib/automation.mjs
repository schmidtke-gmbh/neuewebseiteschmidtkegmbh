function clean(value) {
  return String(value ?? '').trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function fullName(data) {
  return [clean(data.vorname), clean(data.nachname)].filter(Boolean).join(' ') || clean(data.name) || 'Unbekannt';
}

function splitName(name) {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}

function activeDeals(deals, config) {
  const terminal = new Set([config.phases.sold, config.phases.lost, config.phases.unqualified]);
  return (Array.isArray(deals) ? deals : [])
    .filter((deal) => deal.pipelineId === config.pipelineId && !deal.archived && !terminal.has(deal.phaseId))
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

function mayMoveToFirstCall(phaseId, phases) {
  return new Set([phases.inquiry, phases.firstCall, phases.followup, phases.qualified]).has(phaseId);
}

function mayMoveToFollowup(phaseId, phases) {
  return new Set([phases.inquiry, phases.firstCall, phases.followup, phases.qualified]).has(phaseId);
}

function markerForForm(eventId) {
  return `Automation-ID: form:${eventId}`;
}

function markerForCal(event) {
  return `Automation-ID: cal:${event.triggerEvent}:${event.bookingUid}:${event.startTime}`;
}

function formatAppointment(value) {
  if (!value) return 'nicht angegeben';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin',
  }).format(date);
}

function requireIdempotency(idempotency) {
  if (!idempotency?.runStep) throw new Error('Durable idempotency is not configured');
  return idempotency;
}

function completionStatus(crmStep, slackStep) {
  if (crmStep.status === 'in-progress' || slackStep?.status === 'in-progress') return 'processing';
  if (crmStep.status === 'done' && slackStep?.status === 'done') return 'duplicate';
  return 'processed';
}

async function ensureDeal({ email, name, startPhaseId, contactId, client, config, reuseTerminal = false }) {
  const deals = await client.findDealsByEmail(email);
  const existing = activeDeals(deals, config)[0];
  if (existing) return existing;
  if (reuseTerminal) {
    const terminalDeal = (Array.isArray(deals) ? deals : [])
      .filter((deal) => deal.pipelineId === config.pipelineId && !deal.archived)
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0];
    if (terminalDeal) return terminalDeal;
  }
  const created = await client.createDeal({
    name: `Website-Anfrage – ${name}`,
    contactId,
    pipelineId: config.pipelineId,
    phaseId: startPhaseId,
  });
  return created.deal ?? created;
}

export async function processWebsiteLead(event, { client, slack, config, idempotency }) {
  const steps = requireIdempotency(idempotency);
  const data = event.data ?? {};
  const email = normalizeEmail(data.email);
  if (!email) throw new Error('Website submission has no email');
  const name = fullName(data);
  const eventKey = `form:${event.eventId}`;

  const crmStep = await steps.runStep(eventKey, 'crm', async () => {
    const contactResult = await client.upsertContact({
      email,
      firstName: clean(data.vorname),
      lastName: clean(data.nachname),
      phone: clean(data.telefon),
      website: clean(data.website),
      companyName: clean(data.firma),
      leadSource: 'Schmidtke-GmbH-Webseite',
      referer: clean(data.referrer || data.landing_page),
      utm: {
        source: clean(data.utm_source), medium: clean(data.utm_medium), campaign: clean(data.utm_campaign),
        content: clean(data.utm_content), term: clean(data.utm_term),
      },
    });
    const contactId = contactResult?.contact?.id;
    if (!contactId) throw new Error('SalesSuite contact upsert returned no contact ID');
    const deal = await ensureDeal({ email, name, startPhaseId: config.phases.inquiry, contactId, client, config });
    const marker = markerForForm(event.eventId);
    if (await client.hasEventMarker(deal.id, marker)) {
      return { duplicate: true, dealId: deal.id, contactId };
    }

    const note = [
      'Neue Anfrage über die normale Schmidtke-GmbH-Webseite', marker,
      `Name: ${name}`, `E-Mail: ${email}`,
      `Telefon: ${clean(data.telefon) || '–'}`, `Webseite: ${clean(data.website) || '–'}`,
      `Branche: ${clean(data.branche) || '–'}`, `Dienstleistung: ${clean(data.dienstleistung) || '–'}`,
      `Werbebudget: ${clean(data.budget) || '–'}`,
      `UTM Source: ${clean(data.utm_source) || '–'}`, `UTM Medium: ${clean(data.utm_medium) || '–'}`,
      `UTM Campaign: ${clean(data.utm_campaign) || '–'}`,
    ].join('\n');
    await client.createDealNote(deal.id, note);
    return { duplicate: false, dealId: deal.id, contactId };
  });

  if (crmStep.status === 'in-progress') return { status: 'processing' };

  const slackStep = await steps.runStep(eventKey, 'slack', () => slack.send({
    title: '🔔 Neue Anfrage über die Webseite!',
    status: 'SalesSuite: Anfrage erfasst',
    name,
    company: clean(data.firma),
    email,
    phone: clean(data.telefon),
    industry: clean(data.branche),
    service: clean(data.dienstleistung),
    website: clean(data.website),
    budget: clean(data.budget),
  }));
  return {
    status: completionStatus(crmStep, slackStep),
    dealId: crmStep.value?.dealId,
    contactId: crmStep.value?.contactId,
  };
}

export async function processCalEvent(event, {
  client, slack, config, idempotency, bookingState,
}) {
  if (Number(event.eventTypeId) !== Number(config.websiteEventTypeId)) return { status: 'ignored' };
  if (!['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'].includes(event.triggerEvent)) {
    return { status: 'ignored' };
  }
  const steps = requireIdempotency(idempotency);
  if (!bookingState?.apply) throw new Error('Durable booking state is not configured');
  const email = normalizeEmail(event.email);
  if (!email) throw new Error('Cal.com event has no attendee email');
  const name = clean(event.name) || 'Unbekannt';
  const { firstName, lastName } = splitName(name);
  const eventKey = `cal:${event.triggerEvent}:${event.bookingUid}:${event.startTime}`;
  const title = event.triggerEvent === 'BOOKING_CANCELLED'
    ? 'Erstgespräch abgesagt'
    : event.triggerEvent === 'BOOKING_RESCHEDULED'
      ? 'Erstgespräch umgebucht'
      : 'Erstgespräch gebucht';

  const crmStep = await steps.runStep(eventKey, 'crm', async () => {
    const contactResult = await client.upsertContact({
      email,
      firstName,
      lastName,
      leadSource: 'Cal.com – Webseite',
    });
    const contactId = contactResult?.contact?.id;
    if (!contactId) throw new Error('SalesSuite contact upsert returned no contact ID');
    const initialPhase = event.triggerEvent === 'BOOKING_CANCELLED' ? config.phases.followup : config.phases.firstCall;
    const deal = await ensureDeal({
      email,
      name,
      startPhaseId: initialPhase,
      contactId,
      client,
      config,
      reuseTerminal: true,
    });
    const booking = await bookingState.apply({ email, dealId: deal.id }, event);
    if (booking.stale) {
      return {
        duplicate: false,
        stale: true,
        dealId: deal.id,
        contactId,
        slackStatus: 'SalesSuite: Veraltetes Ereignis ignoriert',
      };
    }
    const marker = markerForCal(event);

    let phaseId;
    let fields = {};
    if (event.triggerEvent === 'BOOKING_CANCELLED') {
      fields = { x_termin: null };
      if (mayMoveToFollowup(deal.phaseId, config.phases)) phaseId = config.phases.followup;
    } else {
      fields = { x_termin: event.startTime };
      if (mayMoveToFirstCall(deal.phaseId, config.phases)) phaseId = config.phases.firstCall;
    }
    const terminal = new Set([config.phases.sold, config.phases.lost, config.phases.unqualified]);
    const dealUpdated = Boolean(phaseId) || !terminal.has(deal.phaseId);
    const slackStatus = event.triggerEvent === 'BOOKING_CANCELLED'
      ? phaseId === config.phases.followup
        ? 'SalesSuite: Follow-up gesetzt'
        : 'SalesSuite: Keine Phasenänderung'
      : 'SalesSuite: Termin erfasst';
    if (await client.hasEventMarker(deal.id, marker)) {
      return { duplicate: true, dealId: deal.id, contactId, slackStatus };
    }
    if (dealUpdated) {
      await client.updateDeal(deal.id, { pipelineId: config.pipelineId, phaseId, fields });
    }
    const note = [
      title, marker, `Name: ${name}`, `E-Mail: ${email}`,
      `Termin: ${formatAppointment(event.startTime)}`,
      event.cancellationReason ? `Absagegrund: ${event.cancellationReason}` : '',
    ].filter(Boolean).join('\n');
    await client.createDealNote(deal.id, note);
    return { duplicate: false, dealId: deal.id, contactId, slackStatus };
  });

  if (crmStep.status === 'in-progress') return { status: 'processing' };

  const slackStep = await steps.runStep(eventKey, 'slack', () => slack.send({
    title,
    status: crmStep.value?.slackStatus ?? 'SalesSuite: Keine Phasenänderung',
    name,
  }));
  return {
    status: completionStatus(crmStep, slackStep),
    dealId: crmStep.value?.dealId,
    contactId: crmStep.value?.contactId,
  };
}
