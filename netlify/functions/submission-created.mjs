import { connectLambda } from '@netlify/blobs';

import { processWebsiteLead } from './lib/automation.mjs';
import { assertRuntimeConfig, config } from './lib/config.mjs';
import { buildSubmissionHandler } from './lib/handlers.mjs';
import { DurableIdempotency } from './lib/idempotency.mjs';
import { buildLambdaEntrypoint } from './lib/lambda-runtime.mjs';
import { SalesSuiteClient } from './lib/salessuite.mjs';
import { SlackNotifier } from './lib/slack.mjs';

function createHandler() {
  assertRuntimeConfig();
  const client = new SalesSuiteClient();
  const slack = new SlackNotifier();
  const idempotency = new DurableIdempotency();

  return buildSubmissionHandler({
    processLead: (event) => processWebsiteLead(event, { client, slack, config, idempotency }),
  });
}

export const handler = buildLambdaEntrypoint({ connect: connectLambda, createHandler });
