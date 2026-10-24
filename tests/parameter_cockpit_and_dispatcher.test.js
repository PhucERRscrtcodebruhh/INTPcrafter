import assert from 'assert';
import { GEMINI_TEXT_MODELS, resolveModelCapabilities } from '../src/config/modelRegistry.js';
import {
  resolveGoogleModelId,
  transformToGoogleTextMasterConfig,
  transformToGoogleConfig,
  buildGoogleGenAIConfig,
  buildOpenAICompatiblePayload,
} from '../server/services/aiDispatcher.js';
import { useSettingsStore, DEFAULT_PARAMETERS } from '../src/store/useSettingsStore.js';

console.log('=== TEST SUITE: 2026 GOOGLE @google/genai & MULTI-PROVIDER PARAMETER COCKPIT ===\n');

// -----------------------------------------------------------------------------
// [TEST 1] 2026 GEMINI_TEXT_MODELS Registry & Direct Model ID Resolution
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing 2026 GEMINI_TEXT_MODELS & Direct Model ID Resolution...');

const EXPECTED_GEMINI_TEXT_MODELS = [
  'gemini-4-argon',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

for (const id of EXPECTED_GEMINI_TEXT_MODELS) {
  assert.ok(GEMINI_TEXT_MODELS[id], `Missing GEMINI_TEXT_MODELS entry for ${id}`);
  // 1.0 No model ID downgrading: pass directly to Google API
  assert.strictEqual(resolveGoogleModelId(id), id, `${id} must NOT be downgraded`);
}

// 1.1 Gemini 4 Argon (1,000,000 maxOutputTokens, thinkingDefault: 'high')
const gemini4 = resolveModelCapabilities('gemini', 'gemini-4-argon');
assert.strictEqual(gemini4.provider, 'google');
assert.strictEqual(gemini4.reasoningType, 'google-level');
assert.strictEqual(gemini4.supportsThinking, true);
assert.strictEqual(gemini4.thinkingDefault, 'high');
assert.strictEqual(gemini4.maxOutputTokensCap, 1000000);

// 1.2 Gemini 3.8 Flash (65536 maxOutputTokens, thinkingDefault: 'medium')
const gemini38 = resolveModelCapabilities('google', 'gemini-3.8-flash');
assert.strictEqual(gemini38.provider, 'google');
assert.strictEqual(gemini38.reasoningType, 'google-level');
assert.strictEqual(gemini38.supportsThinking, true);
assert.strictEqual(gemini38.thinkingDefault, 'medium');
assert.strictEqual(gemini38.maxOutputTokensCap, 65536);

// 1.3 Non-Reasoning Gemini 3.x / Flash-Lite (supportsThinking: false)
for (const nonThinkingId of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
  const caps = resolveModelCapabilities('google', nonThinkingId);
  assert.strictEqual(caps.supportsThinking, false, `${nonThinkingId} must have supportsThinking: false`);
  assert.strictEqual(caps.reasoningType, 'none', `${nonThinkingId} must have reasoningType: 'none'`);
}

// 1.4 Legacy Gemini 2.5 Pro (supportsThinking: true, isLegacyThinking: true)
const gemini25Pro = resolveModelCapabilities('google', 'gemini-2.5-pro');
assert.strictEqual(gemini25Pro.supportsThinking, true);
assert.strictEqual(gemini25Pro.isLegacyThinking, true);
assert.strictEqual(gemini25Pro.reasoningType, 'google-budget');
assert.strictEqual(gemini25Pro.maxOutputTokensCap, 8192);

console.log('✓ 2026 GEMINI_TEXT_MODELS and capability resolution verified.\n');

// -----------------------------------------------------------------------------
// [TEST 2] 2026 Google Text Master Config Pruning & Thinking Rules
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing transformToGoogleTextMasterConfig...');

// 2.1 Gemini 4 Argon with Thinking Enabled:
// - Uses uppercase thinkingLevel (defaults to 'HIGH' if not valid)
// - Purges temperature, topP, topK completely
// - Allows up to 1,000,000 maxOutputTokens
const argonConfig = transformToGoogleTextMasterConfig({
  maxOutputTokens: 500000,
  temperature: 1.2,
  topP: 0.9,
  topK: 40,
  thinkingEnabled: true,
  thinkingLevel: 'auto',
  systemInstruction: 'System directive.',
}, 'gemini-4-argon');

assert.strictEqual(argonConfig.maxOutputTokens, 500000);
assert.deepStrictEqual(argonConfig.thinkingConfig, { thinkingLevel: 'HIGH' });
assert.strictEqual('temperature' in argonConfig, false, 'temperature must be purged when thinking is active on Gemini 4 Argon');
assert.strictEqual('topP' in argonConfig, false, 'topP must be purged when thinking is active on Gemini 4 Argon');
assert.strictEqual('topK' in argonConfig, false, 'topK must be purged when thinking is active on Gemini 4 Argon');

// 2.2 Gemini 3.8 Flash with Thinking Enabled:
// - Uses uppercase thinkingLevel ('MEDIUM' default or explicit 'LOW'/'MEDIUM'/'HIGH')
// - Purges temperature, topP, topK
const flash38Config = transformToGoogleConfig({
  maxOutputTokens: 16384,
  temperature: 0.85,
  topP: 0.92,
  topK: 45,
  thinkingEnabled: true,
  thinkingLevel: 'low',
}, 'gemini-3.8-flash');

assert.deepStrictEqual(flash38Config.thinkingConfig, { thinkingLevel: 'LOW' });
assert.strictEqual('temperature' in flash38Config, false);
assert.strictEqual('topP' in flash38Config, false);
assert.strictEqual('topK' in flash38Config, false);

// 2.3 Flash-Lite / Non-thinking model (even if clientConfig.thinkingEnabled is true):
// - Deletes thinkingConfig
// - Preserves standard sampling keys (temperature, topP, topK)
const flashLiteConfig = transformToGoogleConfig({
  maxOutputTokens: 8192,
  temperature: 0.8,
  topP: 0.95,
  topK: 32,
  thinkingEnabled: true,
  thinkingLevel: 'high',
}, 'gemini-3.5-flash-lite');

assert.strictEqual('thinkingConfig' in flashLiteConfig, false, 'flash-lite must not include thinkingConfig');
assert.strictEqual(flashLiteConfig.temperature, 0.8);
assert.strictEqual(flashLiteConfig.topP, 0.95);
assert.strictEqual(flashLiteConfig.topK, 32);

// 2.4 Thinking Disabled on Gemini 3.8 Flash:
// - Deletes thinkingConfig
// - Preserves standard sampling keys (temperature, topP, topK)
const flash38NoThinking = transformToGoogleConfig({
  temperature: 0.9,
  topP: 0.95,
  topK: 40,
  thinkingEnabled: false,
}, 'gemini-3.8-flash');

assert.strictEqual('thinkingConfig' in flash38NoThinking, false);
assert.strictEqual(flash38NoThinking.temperature, 0.9);
assert.strictEqual(flash38NoThinking.topP, 0.95);
assert.strictEqual(flash38NoThinking.topK, 40);

// 2.5 Legacy Gemini 2.5 Pro with Thinking Enabled:
// - Uses thinkingBudget (default 2048) and preserves temperature
const legacy25ProConfig = transformToGoogleConfig({
  temperature: 0.7,
  thinkingEnabled: true,
  thinkingBudget: 4096,
}, 'gemini-2.5-pro');

assert.deepStrictEqual(legacy25ProConfig.thinkingConfig, { thinkingBudget: 4096 });
assert.strictEqual(legacy25ProConfig.temperature, 0.7);

console.log('✓ 2026 Google Text Master Config pruning and thinking rules verified.\n');

// -----------------------------------------------------------------------------
// [TEST 3] OpenAI-Compatible Payload Builder & Zero-Leakage Enforcement
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing OpenAI-Compatible Payload Builder...');

const deepseekR1 = resolveModelCapabilities('deepseek', 'deepseek-r1');
const openAiMessages = [{ role: 'user', content: 'Prove Goldbach conjecture.' }];
const openAiPayload = buildOpenAICompatiblePayload({
  temperature: 0.6,
  topP: 0.9,
  maxOutputTokens: 16000,
  frequencyPenalty: 0.5,
  presencePenalty: 0.3,
  stopSequences: ['[HALT]'],
  reasoningEffort: 'high',
  topK: 50,
  thinkingEnabled: true,
  thinkingLevel: 'high',
}, deepseekR1, openAiMessages);

assert.strictEqual(openAiPayload.temperature, 0.6);
assert.strictEqual(openAiPayload.top_p, 0.9);
assert.strictEqual(openAiPayload.max_tokens, 16000);
assert.strictEqual(openAiPayload.reasoning_effort, 'high');
assert.strictEqual(openAiPayload.topK, undefined);
assert.strictEqual(openAiPayload.thinkingConfig, undefined);

console.log('✓ OpenAI-compatible payload builder verified.\n');
console.log('=== ALL 2026 COCKPIT & DISPATCHER TESTS PASSED SUCCESSFULLY! ===');
