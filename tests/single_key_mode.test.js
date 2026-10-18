import assert from 'assert';
import { ProviderKeyPool } from '../server/llmProviders.js';

console.log('=== TEST SUITE: SINGLE KEY MODE (NO ROTATION) ===\n');

const pool = new ProviderKeyPool(0, 'groq');
pool.initialized = true; // skip DB init; keys are injected below
pool.keys = [
  { id: 101, key: 'gsk_dummy_1', masked: 'gsk_du...001', status: 'active', baseUrl: 'http://127.0.0.1:9' },
  { id: 102, key: 'gsk_dummy_2', masked: 'gsk_du...002', status: 'active', baseUrl: 'http://127.0.0.1:9' },
];

let error = null;
try {
  await pool.executeStreamWithRotation({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'ping' }],
    singleKeyMode: true,
    streamTimeout: 1500,
  });
} catch (err) {
  error = err;
}

assert.ok(error, 'the unreachable endpoint must throw');
assert.strictEqual(pool.keys[0].requestCount, 1, 'single key mode must attempt exactly once');
assert.ok(!pool.keys[1].requestCount, 'rotation must never touch the second key');
assert.ok(!/ROTATION_EXHAUSTED|ALL_KEYS_EXHAUSTED/.test(error.message), 'no pool-rotation warnings in single key mode');
console.log('✓ Only the first active key is used; no rotation / pool-exhausted warnings.\n');

console.log('=== ALL SINGLE KEY MODE TESTS PASSED ===');
