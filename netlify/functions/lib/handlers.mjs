import { extractCalEvent, isValidCalEvent, parseNetlifySubmission, verifyCalSignature } from './parsing.mjs';

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  };
}

function safeErrorLog(event, identifier, error) {
  return {
    event,
    ...(identifier ?? {}),
    status: 'error',
    ...(error?.service ? { service: error.service } : {}),
    ...(error?.operation ? { operation: error.operation } : {}),
    ...(error?.status ? { httpStatus: error.status } : {}),
  };
}

export function buildSubmissionHandler({ processLead }) {
  return async function handler(event) {
    let submission;
    try {
      submission = parseNetlifySubmission(event.body ?? '{}');
      if (!submission) return jsonResponse(200, { status: 'ignored' });
      const result = await processLead(submission);
      console.log(JSON.stringify({ event: 'website-lead', eventId: submission.eventId, status: result.status }));
      return jsonResponse(200, result);
    } catch (error) {
      console.error(JSON.stringify(safeErrorLog('website-lead', submission?.eventId ? { eventId: submission.eventId } : undefined, error)));
      return jsonResponse(500, { status: 'error' });
    }
  };
}

export function buildCalHandler({ secret, processEvent }) {
  return async function handler(event) {
    const rawBody = event.body ?? '';
    const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const signature = headers['x-cal-signature-256'] ?? headers['x-cal-signature'];
    if (!verifyCalSignature(rawBody, signature, secret)) {
      return jsonResponse(401, { status: 'invalid-signature' });
    }
    let calEvent;
    try {
      calEvent = extractCalEvent(JSON.parse(rawBody));
      if (!isValidCalEvent(calEvent)) return jsonResponse(400, { status: 'invalid-payload' });
      const result = await processEvent(calEvent);
      console.log(JSON.stringify({ event: 'cal-booking', trigger: calEvent.triggerEvent, bookingUid: calEvent.bookingUid, status: result.status }));
      return jsonResponse(200, result);
    } catch (error) {
      if (error instanceof SyntaxError) return jsonResponse(400, { status: 'invalid-payload' });
      console.error(JSON.stringify(safeErrorLog('cal-booking', calEvent?.bookingUid ? { bookingUid: calEvent.bookingUid } : undefined, error)));
      return jsonResponse(500, { status: 'error' });
    }
  };
}
