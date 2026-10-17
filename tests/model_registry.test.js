import assert from 'assert';
import { MODEL_SPECS, MODEL_GROUPS, getModelSpec } from '../src/services/tokenEstimator.js';
import { PROVIDER_ENDPOINTS, GROQ_MODEL_IDS, detectProviderFromModel, resolveModelForProvider } from '../server/llmProviders.js';
import { getModelContextLimit } from '../server/tokenUtils.js';

const GEMINI_IDS = [
  'gemini-4-argon',
  'gemini-4-argon-cyber-permissive',
  'gemini-3.8-flash',
  'gemini-3.8-flash-cyber',
  'gemini-3.8-live',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro',
  'gemini-omni-1.1-flash-preview',
  'gemini-nano-banana-2.1',
  'gemini-nano',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemma-4-e4b-it',
  'gemma-4-e2b-it',
  'gemma-4-12b',
  'gemma-3-27b',
  'gemma-2-27b',
  'gemma-2-9b',
  'gemma-2-2b',
];

const GROQ_IDS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'canopylabs/orpheus-arabic-saudi',
  'canopylabs/orpheus-v1-english',
  'meta-llama/llama-prompt-guard-2-22m',
  'meta-llama/llama-prompt-guard-2-86m',
  'meta-models/muse-spark-open',
  'minimaxai/minimax-m2.7',
  'openai/gpt-oss-safeguard-20b',
  'qwen/qwen3.8-27b',
];

console.log('=== TEST SUITE: MODEL REGISTRY (GEMINI / GEMMA / GROQ) ===\n');

for (const id of [...GEMINI_IDS, ...GROQ_IDS]) {
  assert.ok(MODEL_SPECS[id], `Missing MODEL_SPECS entry for ${id}`);
  assert.ok(MODEL_SPECS[id].name, `Missing display name for ${id}`);
  assert.ok(MODEL_SPECS[id].contextLimit > 0, `Invalid contextLimit for ${id}`);
  assert.ok(getModelContextLimit(id) > 0, `Missing server context limit for ${id}`);
}
console.log(`✓ All ${GEMINI_IDS.length} Gemini/Gemma + ${GROQ_IDS.length} Groq models are registered.\n`);

for (const id of GEMINI_IDS) {
  assert.strictEqual(MODEL_SPECS[id].provider, 'gemini', `${id} must route to the Gemini provider`);
}
for (const id of GROQ_IDS) {
  assert.strictEqual(MODEL_SPECS[id].provider, 'groq', `${id} must route to the Groq provider`);
  assert.ok(GROQ_MODEL_IDS.has(id), `${id} missing from server GROQ_MODEL_IDS`);
  assert.strictEqual(detectProviderFromModel(id), 'groq', `${id} provider detection failed`);
}
console.log('✓ Provider routing metadata matches the server-side registry.\n');

const groupedIds = MODEL_GROUPS.flatMap(g => g.ids);
for (const id of [...GEMINI_IDS, ...GROQ_IDS]) {
  assert.ok(groupedIds.includes(id), `${id} is not exposed in any MODEL_GROUPS picker section`);
}
assert.strictEqual(new Set(groupedIds).size, groupedIds.length, 'MODEL_GROUPS contains duplicate ids');
console.log('✓ Every registered target model is exposed exactly once in the picker groups.\n');

assert.strictEqual(PROVIDER_ENDPOINTS.groq, 'https://api.groq.com/openai/v1');
assert.strictEqual(resolveModelForProvider('groq/openai/gpt-oss-20b', 'groq'), 'openai/gpt-oss-20b');
assert.strictEqual(getModelSpec('llama-3.1-8b-instant').provider, 'groq');
console.log('✓ Groq endpoint + model resolution verified.\n');

console.log('=== ALL MODEL REGISTRY TESTS PASSED ===');
