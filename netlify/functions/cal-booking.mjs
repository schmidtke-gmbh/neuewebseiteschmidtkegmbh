import { processCalEvent } from './lib/automation.mjs';
import { assertRuntimeConfig, config } from './lib/config.mjs';
import { buildCalHandler } from './lib/handlers.mjs';
import { DurableBookingState, DurableIdempotency } from './lib/idempotency.mjs';
import { SalesSuiteClient } from './lib/salessuite.mjs';
import { SlackNotifier } from './lib/slack.mjs';

assertRuntimeConfig();
const client = new SalesSuiteClient();
const slack = new SlackNotifier();
const idempotency = new DurableIdempotency();
const bookingState = new DurableBookingState();

export const handler = buildCalHandler({
  secret: process.env.CAL_WEBHOOK_SECRET,
  processEvent: (event) => processCalEvent(event, {
    client, slack, config, idempotency, bookingState,
  }),
});
