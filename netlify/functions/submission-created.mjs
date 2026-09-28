import { processWebsiteLead } from './lib/automation.mjs';
import { assertRuntimeConfig, config } from './lib/config.mjs';
import { buildSubmissionHandler } from './lib/handlers.mjs';
import { DurableIdempotency } from './lib/idempotency.mjs';
import { SalesSuiteClient } from './lib/salessuite.mjs';
import { SlackNotifier } from './lib/slack.mjs';

assertRuntimeConfig();
const client = new SalesSuiteClient();
const slack = new SlackNotifier();
const idempotency = new DurableIdempotency();

export const handler = buildSubmissionHandler({
  processLead: (event) => processWebsiteLead(event, { client, slack, config, idempotency }),
});
