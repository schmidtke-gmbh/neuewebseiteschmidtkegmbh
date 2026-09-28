import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLambdaEntrypoint } from '../netlify/functions/lib/lambda-runtime.mjs';

test('Lambda entrypoint connects Netlify Blobs before creating store-backed dependencies', async () => {
  const order = [];
  const event = { blobs: 'context' };
  const entrypoint = buildLambdaEntrypoint({
    connect: (received) => {
      assert.equal(received, event);
      order.push('connect');
    },
    createHandler: () => {
      order.push('create-handler');
      return async (received) => {
        assert.equal(received, event);
        order.push('handle');
        return { statusCode: 200, body: 'ok' };
      };
    },
  });

  assert.deepEqual(order, []);
  const response = await entrypoint(event, { requestId: 'ctx-1' });

  assert.deepEqual(order, ['connect', 'create-handler', 'handle']);
  assert.deepEqual(response, { statusCode: 200, body: 'ok' });
});
