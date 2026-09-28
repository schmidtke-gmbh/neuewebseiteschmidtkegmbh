import crypto from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function derivedSubmissionId(payload) {
  const canonical = JSON.stringify(canonicalize(payload));
  return `derived-${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

function firstValidTimestamp(values) {
  for (const value of values) {
    if (value && !Number.isNaN(Date.parse(value))) return String(value);
  }
  return '';
}

export function parseNetlifySubmission(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : rawBody;
  const payload = body?.payload ?? body;
  const formName = payload?.form_name ?? payload?.formName ?? payload?.data?.['form-name'];
  if (formName !== 'erstgespraech') return null;
  return {
    eventId: String(payload?.id ?? payload?.submission_id ?? derivedSubmissionId(payload)),
    formName,
    data: payload?.data ?? {},
  };
}

export function extractCalEvent(body) {
  const payload = body?.payload ?? {};
  const attendee = payload.attendees?.[0] ?? payload.attendee ?? {};
  const triggerEvent = String(body?.triggerEvent ?? body?.event ?? '').toUpperCase();
  const eventTypeId = Number(
    payload.eventTypeId ?? payload.eventType?.id ?? payload.typeId ?? body?.eventTypeId,
  );
  const eventSpecificTime = triggerEvent === 'BOOKING_CANCELLED'
    ? payload.cancelledAt ?? payload.booking?.cancelledAt
    : triggerEvent === 'BOOKING_RESCHEDULED'
      ? payload.rescheduledAt ?? payload.booking?.rescheduledAt
      : undefined;
  return {
    triggerEvent,
    eventTypeId,
    bookingUid: String(payload.uid ?? payload.bookingUid ?? payload.booking?.uid ?? ''),
    email: String(attendee.email ?? payload.email ?? '').trim().toLowerCase(),
    name: String(attendee.name ?? payload.name ?? '').trim(),
    startTime: String(payload.startTime ?? payload.start ?? payload.booking?.startTime ?? ''),
    rescheduleUid: String(payload.rescheduleUid ?? payload.rescheduledFromUid ?? ''),
    cancellationReason: String(payload.cancellationReason ?? payload.cancelReason ?? '').trim(),
    occurredAt: firstValidTimestamp([
      eventSpecificTime,
      payload.updatedAt,
      payload.booking?.updatedAt,
      payload.createdAt,
      payload.booking?.createdAt,
      body?.createdAt,
    ]),
  };
}

export function isValidCalEvent(event) {
  if (!event.bookingUid) return false;
  if (['BOOKING_CREATED', 'BOOKING_RESCHEDULED'].includes(event.triggerEvent)) {
    return Boolean(event.startTime) && !Number.isNaN(Date.parse(event.startTime));
  }
  return true;
}

export function verifyCalSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = String(signature).replace(/^sha256=/i, '').trim();
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
