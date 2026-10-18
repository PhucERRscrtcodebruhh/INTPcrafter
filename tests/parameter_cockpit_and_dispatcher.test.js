import assert from 'assert';
import { resolveModelCapabilities } from '../src/config/modelRegistry.js';
import { buildGoogleGenAIConfig, buildOpenAICompatiblePayload } from '../server/services/aiDispatcher.js';
import { useSettingsStore, DEFAULT_PARAMETERS, BUILTIN_PRESETS } from '../src/store/useSettingsStore.js';

console.log('=== TEST SUITE: DYNAMIC MULTI-PROVIDER LLM PARAMETER COCKPIT & DISPATCHER ===\n');

// -----------------------------------------------------------------------------
// [TEST 1] Model Capability Resolution & Feature Schema Detection
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing Model Capability Resolution...');

// 1.1 Gemini 3.x (Google GenAI Native - Thinking Level)
const gemini38 = resolveModelCapabilities('google', 'gemini-3.8-flash');
assert.strictEqual(gemini38.provider, 'google');
assert.strictEqual(gemini38.supportsTopK, true);
assert.strictEqual(gemini38.supportsPenalties, false);
assert.strictEqual(gemini38.reasoningType, 'google-level');
assert.strictEqual(gemini38.supportsGroundingSearch, true);
assert.strictEqual(gemini38.supportsUrlContext, true);
assert.strictEqual(gemini38.maxOutputTokensCap, 65535);

const gemini4 = resolveModelCapabilities('gemini', 'gemini-4-argon');
assert.strictEqual(gemini4.provider, 'google');
assert.strictEqual(gemini4.reasoningType, 'google-level');

// 1.2 Gemini 2.5 (Google GenAI Native - Thinking Budget)
const gemini25 = resolveModelCapabilities('google', 'gemini-2.5-flash');
assert.strictEqual(gemini25.provider, 'google');
assert.strictEqual(gemini25.supportsTopK, true);
assert.strictEqual(gemini25.supportsPenalties, false);
assert.strictEqual(gemini25.reasoningType, 'google-budget');
assert.strictEqual(gemini25.maxOutputTokensCap, 65535);

// 1.3 Gemma (Google GenAI - Non-Reasoning)
const gemma = resolveModelCapabilities('google', 'gemma-2-9b');
assert.strictEqual(gemma.provider, 'google');
assert.strictEqual(gemma.supportsTopK, true);
assert.strictEqual(gemma.supportsPenalties, false);
assert.strictEqual(gemma.reasoningType, 'none');

// 1.4 DeepSeek R1 & OpenAI Reasoning (OpenAI Compatible - Reasoning Effort)
const deepseekR1 = resolveModelCapabilities('deepseek', 'deepseek-r1');
assert.strictEqual(deepseekR1.provider, 'openai-compatible');
assert.strictEqual(deepseekR1.supportsTopK, false);
assert.strictEqual(deepseekR1.supportsPenalties, true);
assert.strictEqual(deepseekR1.reasoningType, 'openai-effort');
assert.strictEqual(deepseekR1.supportsGroundingSearch, false);
assert.strictEqual(deepseekR1.maxOutputTokensCap, 16384);

const o1Model = resolveModelCapabilities('openai', 'o1-mini');
assert.strictEqual(o1Model.provider, 'openai-compatible');
assert.strictEqual(o1Model.reasoningType, 'openai-effort');

// 1.5 Groq / Standard Non-Reasoning OpenAI
const groqLlama = resolveModelCapabilities('groq', 'llama-3.1-8b-instant');
assert.strictEqual(groqLlama.provider, 'openai-compatible');
assert.strictEqual(groqLlama.supportsTopK, false);
assert.strictEqual(groqLlama.supportsPenalties, true);
assert.strictEqual(groqLlama.reasoningType, 'none');

console.log('✓ Model capability resolution correctly differentiated Google (Gemini 2.5/3.x/Gemma) vs OpenAI.\n');

// -----------------------------------------------------------------------------
// [TEST 2] Google GenAI Native Config Builder & Zero-Leakage Enforcement
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing Google GenAI Config Builder...');

// 2.1 Gemini 3.x with Thinking Level & Google Search Grounding
const gemini3Params = {
  temperature: 0.85,
  topP: 0.92,
  maxOutputTokens: 8192,
  topK: 45,
  thinkingEnabled: true,
  thinkingLevel: 'high',
  groundingWithGoogleSearch: true,
  // CONTAMINATION ATTEMPTS (OpenAI parameters that MUST NOT leak):
  frequencyPenalty: 1.5,
  presencePenalty: 1.0,
  reasoningEffort: 'medium',
  stopSequences: ['###', 'END']
};

const gemini3Config = buildGoogleGenAIConfig(gemini3Params, gemini38);
assert.strictEqual(gemini3Config.temperature, 0.85);
assert.strictEqual(gemini3Config.topP, 0.92);
assert.strictEqual(gemini3Config.maxOutputTokens, 8192);
assert.strictEqual(gemini3Config.topK, 45);
assert.deepStrictEqual(gemini3Config.thinkingConfig, { thinkingLevel: 'high' });
assert.deepStrictEqual(gemini3Config.tools, [{ googleSearch: {} }]);

// Strict Zero-Leakage verification
assert.strictEqual(gemini3Config.frequency_penalty, undefined, 'LEAK: frequency_penalty in Google config');
assert.strictEqual(gemini3Config.presence_penalty, undefined, 'LEAK: presence_penalty in Google config');
assert.strictEqual(gemini3Config.frequencyPenalty, undefined, 'LEAK: frequencyPenalty in Google config');
assert.strictEqual(gemini3Config.presencePenalty, undefined, 'LEAK: presencePenalty in Google config');
assert.strictEqual(gemini3Config.reasoning_effort, undefined, 'LEAK: reasoning_effort in Google config');
assert.strictEqual(gemini3Config.reasoningEffort, undefined, 'LEAK: reasoningEffort in Google config');
assert.strictEqual(gemini3Config.stop, undefined, 'LEAK: stop in Google config');

// 2.2 Gemini 2.5 with Thinking Budget
const gemini25Params = {
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 4096,
  thinkingEnabled: true,
  thinkingBudget: 2048,
  groundingWithGoogleSearch: false
};
const gemini25Config = buildGoogleGenAIConfig(gemini25Params, gemini25);
assert.deepStrictEqual(gemini25Config.thinkingConfig, { thinkingBudget: 2048 });
assert.strictEqual(gemini25Config.tools, undefined);

// 2.3 Gemini with Thinking Disabled (Must explicitly pass thinkingBudget: 0)
const geminiDisabledThinking = buildGoogleGenAIConfig({
  ...gemini3Params,
  thinkingEnabled: false
}, gemini38);
assert.deepStrictEqual(geminiDisabledThinking.thinkingConfig, { thinkingBudget: 0 });

// 2.4 Gemini 3.x with auto thinking level
const geminiAutoLevel = buildGoogleGenAIConfig({
  ...gemini3Params,
  thinkingEnabled: true,
  thinkingLevel: 'auto'
}, gemini38);
assert.strictEqual(geminiAutoLevel.thinkingConfig.thinkingLevel, undefined);

console.log('✓ Google GenAI Native config builder enforces version-aware thinking and zero parameter leaks.\n');

// -----------------------------------------------------------------------------
// [TEST 3] OpenAI-Compatible Payload Builder & Zero-Leakage Enforcement
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing OpenAI-Compatible Payload Builder...');

const openAiMessages = [
  { role: 'user', content: 'Prove Goldbach conjecture.' }
];

const openAiParams = {
  temperature: 0.6,
  topP: 0.9,
  maxOutputTokens: 16000,
  frequencyPenalty: 0.5,
  presencePenalty: 0.3,
  stopSequences: ['[HALT]', '<|im_end|>'],
  reasoningEffort: 'high',
  disableStreaming: false,
  // CONTAMINATION ATTEMPTS (Google parameters that MUST NOT leak):
  topK: 50,
  thinkingEnabled: true,
  thinkingLevel: 'high',
  thinkingBudget: 8192,
  groundingWithGoogleSearch: true,
  urlContext: true
};

const openAiPayload = buildOpenAICompatiblePayload(openAiParams, deepseekR1, openAiMessages);
assert.strictEqual(openAiPayload.temperature, 0.6);
assert.strictEqual(openAiPayload.top_p, 0.9);
assert.strictEqual(openAiPayload.max_tokens, 16000);
assert.strictEqual(openAiPayload.stream, true);
assert.strictEqual(openAiPayload.frequency_penalty, 0.5);
assert.strictEqual(openAiPayload.presence_penalty, 0.3);
assert.deepStrictEqual(openAiPayload.stop, ['[HALT]', '<|im_end|>']);
assert.strictEqual(openAiPayload.reasoning_effort, 'high');

// Strict Zero-Leakage verification
assert.strictEqual(openAiPayload.topK, undefined, 'LEAK: topK in OpenAI payload');
assert.strictEqual(openAiPayload.top_k, undefined, 'LEAK: top_k in OpenAI payload');
assert.strictEqual(openAiPayload.thinkingConfig, undefined, 'LEAK: thinkingConfig in OpenAI payload');
assert.strictEqual(openAiPayload.thinkingLevel, undefined, 'LEAK: thinkingLevel in OpenAI payload');
assert.strictEqual(openAiPayload.thinkingBudget, undefined, 'LEAK: thinkingBudget in OpenAI payload');
assert.strictEqual(openAiPayload.groundingWithGoogleSearch, undefined, 'LEAK: groundingWithGoogleSearch in OpenAI payload');
assert.strictEqual(openAiPayload.tools, undefined, 'LEAK: tools in OpenAI payload');
assert.strictEqual(openAiPayload.urlContext, undefined, 'LEAK: urlContext in OpenAI payload');

// 3.2 Non-reasoning model (Groq Llama 3) does not leak reasoning_effort
const groqPayload = buildOpenAICompatiblePayload({
  ...openAiParams,
  reasoningEffort: 'high' // Non-reasoning model must not send reasoning_effort
}, groqLlama, openAiMessages);
assert.strictEqual(groqPayload.reasoning_effort, undefined, 'LEAK: reasoning_effort passed to non-reasoning model');
assert.strictEqual(groqPayload.frequency_penalty, 0.5);

// 3.3 Reasoning model with reasoningEffort: 'auto' does not send explicit reasoning_effort
const r1AutoPayload = buildOpenAICompatiblePayload({
  ...openAiParams,
  reasoningEffort: 'auto'
}, deepseekR1, openAiMessages);
assert.strictEqual(r1AutoPayload.reasoning_effort, undefined);

console.log('✓ OpenAI-compatible payload builder enforces penalty validation and zero parameter leaks.\n');

// -----------------------------------------------------------------------------
// [TEST 4] Zustand Settings Store & Preset System
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing Zustand Settings Store & Presets...');

const store = useSettingsStore.getState();
assert.strictEqual(store.parameters.temperature, DEFAULT_PARAMETERS.temperature);
assert.strictEqual(store.parameters.topP, DEFAULT_PARAMETERS.topP);
assert.strictEqual(store.parameters.maxOutputTokens, DEFAULT_PARAMETERS.maxOutputTokens);
assert.strictEqual(store.parameters.topK, DEFAULT_PARAMETERS.topK);
assert.strictEqual(store.parameters.thinkingBudget, -1);
assert.strictEqual(store.parameters.thinkingLevel, 'auto');

// Update single parameter
useSettingsStore.getState().updateParameter('temperature', 1.4);
assert.strictEqual(useSettingsStore.getState().parameters.temperature, 1.4);
assert.strictEqual(useSettingsStore.getState().activePreset, 'Custom');

// Apply Builtin Preset: Creative Novelist
useSettingsStore.getState().applyPreset('Creative Novelist');
const creativeParams = useSettingsStore.getState().parameters;
assert.strictEqual(creativeParams.temperature, 1.25);
assert.strictEqual(creativeParams.topP, 0.98);
assert.strictEqual(creativeParams.frequencyPenalty, 0.2);
assert.strictEqual(useSettingsStore.getState().activePreset, 'Creative Novelist');

// Save Custom Preset
useSettingsStore.getState().updateParameter('temperature', 0.42);
useSettingsStore.getState().savePreset('Cyber Lore Mode');
assert.strictEqual(useSettingsStore.getState().activePreset, 'Cyber Lore Mode');
assert.ok(useSettingsStore.getState().customPresets.some(p => p.name === 'Cyber Lore Mode'));

// Reset to Defaults
useSettingsStore.getState().resetToDefaults();
assert.strictEqual(useSettingsStore.getState().parameters.temperature, DEFAULT_PARAMETERS.temperature);
assert.strictEqual(useSettingsStore.getState().activePreset, 'Default Balanced');

// Delete Custom Preset
useSettingsStore.getState().deletePreset('Cyber Lore Mode');
assert.strictEqual(useSettingsStore.getState().customPresets.length, 0);

console.log('✓ Zustand settings store, presets, and updates verified.\n');

// -----------------------------------------------------------------------------
// [TEST 5] Cross-Provider Automatic Failover Sanitization
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing Cross-Provider Failover Sanitization...');

// Simulating a request configured with Google GenAI parameters that gets rerouted to DeepSeek
const geminiSessionConfig = {
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 4096,
  topK: 40,
  thinkingEnabled: true,
  thinkingLevel: 'medium',
  groundingWithGoogleSearch: true,
  urlContext: true,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

// When dispatched to Gemini:
const googleConfig = buildGoogleGenAIConfig(geminiSessionConfig, gemini38);
assert.strictEqual(googleConfig.topK, 40);
assert.deepStrictEqual(googleConfig.thinkingConfig, { thinkingLevel: 'medium' });
assert.deepStrictEqual(googleConfig.tools, [{ googleSearch: {} }]);

// When Gemini fails with 503 and fails over to DeepSeek:
const deepseekFallbackCaps = resolveModelCapabilities('deepseek', 'deepseek-chat');
const deepseekFallbackPayload = buildOpenAICompatiblePayload(geminiSessionConfig, deepseekFallbackCaps, openAiMessages);

assert.strictEqual(deepseekFallbackPayload.topK, undefined, 'LEAK: topK leaked into fallback DeepSeek payload');
assert.strictEqual(deepseekFallbackPayload.thinkingConfig, undefined, 'LEAK: thinkingConfig leaked into fallback DeepSeek payload');
assert.strictEqual(deepseekFallbackPayload.tools, undefined, 'LEAK: tools leaked into fallback DeepSeek payload');
assert.strictEqual(deepseekFallbackPayload.groundingWithGoogleSearch, undefined, 'LEAK: groundingWithGoogleSearch leaked into fallback DeepSeek payload');
assert.strictEqual(deepseekFallbackPayload.urlContext, undefined, 'LEAK: urlContext leaked into fallback DeepSeek payload');
assert.strictEqual(deepseekFallbackPayload.temperature, 0.7);
assert.strictEqual(deepseekFallbackPayload.top_p, 0.95);

console.log('✓ Cross-provider failover safely strips Google parameters when failing over to DeepSeek.\n');

console.log('=== ALL COCKPIT & DISPATCHER TESTS PASSED SUCCESSFULLY! ===');

