import assert from 'assert';
import {
  resolveRequiredProvider,
  getProviderKeys,
  getActiveKeyCount,
  hasActiveKey,
  normalizeProvider,
} from '../src/services/keyAvailability.js';

console.log('=== TEST SUITE: PROVIDER-AWARE KEY AVAILABILITY ===\n');

const pool = [
  { id: 1, provider: 'gemini', status: 'active' },
  { id: 2, provider: 'gemini', status: 'rate_limited' },
  { id: 3, provider: 'groq', status: 'active' },
  { id: 4, provider: 'groq' }, // legacy row without status == active
  { id: 5, provider: 'deepseek', status: 'invalid' },
];

// 1. A single active key is enough (paid tier, no rotation).
assert.strictEqual(getActiveKeyCount(pool, 'gemini'), 1);
assert.ok(hasActiveKey(pool, 'gemini'), 'one active Gemini key must satisfy BYOK');
assert.strictEqual(getActiveKeyCount(pool, 'groq'), 2, 'missing status must count as active');
assert.strictEqual(getActiveKeyCount(pool, 'deepseek'), 0);
assert.strictEqual(hasActiveKey(pool, 'deepseek'), false);
console.log('✓ Single active key satisfies the guard; rate-limited/invalid keys do not.\n');

// 2. Provider isolation: Groq keys must never suppress/trigger Gemini checks.
assert.strictEqual(getProviderKeys(pool, 'groq').length, 2);
assert.strictEqual(getProviderKeys(pool, 'gemini').length, 2);
assert.strictEqual(getProviderKeys(pool, 'openrouter').length, 0);
console.log('✓ Provider key pools are isolated (Groq vs Gemini vs others).\n');

// 3. Explicit primary provider wins; "auto" follows the model.
assert.strictEqual(resolveRequiredProvider('groq', 'gemini'), 'groq');
assert.strictEqual(resolveRequiredProvider('auto', 'deepseek'), 'deepseek');
assert.strictEqual(resolveRequiredProvider('', 'groq'), 'groq');
assert.strictEqual(resolveRequiredProvider(null, 'gemini'), 'gemini');
assert.strictEqual(normalizeProvider('unknown-provider'), 'gemini');
console.log('✓ Active provider / model provider resolution is deterministic.\n');

// 4. Empty/undefined payloads are safe.
assert.strictEqual(getActiveKeyCount(null, 'gemini'), 0);
assert.strictEqual(getActiveKeyCount(undefined, 'groq'), 0);
assert.strictEqual(hasActiveKey([], 'gemini'), false);
console.log('✓ Empty telemetry payloads are handled safely.\n');

console.log('=== ALL KEY AVAILABILITY TESTS PASSED ===');
