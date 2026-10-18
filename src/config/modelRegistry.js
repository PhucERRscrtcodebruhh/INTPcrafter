/**
 * Model Registry & Feature Schema for Dynamic Multi-Provider Cockpit
 */

/**
 * @typedef {'google' | 'openai-compatible'} ProviderType
 * @typedef {'none' | 'google-budget' | 'google-level' | 'openai-effort'} ReasoningType
 *
 * @typedef {Object} ModelCapabilitySchema
 * @property {ProviderType} provider
 * @property {boolean} supportsTopK
 * @property {boolean} supportsPenalties - frequency_penalty & presence_penalty
 * @property {boolean} supportsStopSequences
 * @property {ReasoningType} reasoningType
 * @property {boolean} supportsGroundingSearch
 * @property {boolean} supportsUrlContext
 * @property {boolean} supportsImageDetail
 * @property {number} defaultMaxTokens
 * @property {number} maxOutputTokensCap
 */

/**
 * Centralized capability resolver inspecting provider and modelId
 * @param {string} provider
 * @param {string} modelId
 * @returns {ModelCapabilitySchema}
 */
export function resolveModelCapabilities(provider = '', modelId = '') {
  const p = String(provider || '').toLowerCase().trim();
  const m = String(modelId || '').toLowerCase().trim();

  const isGoogle = p === 'google' || p === 'gemini' || m.startsWith('gemini-') || m.startsWith('gemma-');
  const isGemini25 = isGoogle && m.includes('gemini-2.5');
  const isGemini3 = isGoogle && !isGemini25 && (m.includes('gemini-3') || m.includes('gemini-v3') || m.includes('gemini-4') || m.includes('gemini-omni'));
  const isReasoningOpenAI = !isGoogle && (m.includes('r1') || m.includes('o1') || m.includes('o3') || m.includes('reasoner'));

  return {
    provider: isGoogle ? 'google' : 'openai-compatible',
    supportsTopK: isGoogle,
    supportsPenalties: !isGoogle,
    supportsStopSequences: true,
    reasoningType: isGemini3 ? 'google-level' : isGemini25 ? 'google-budget' : isReasoningOpenAI ? 'openai-effort' : 'none',
    supportsGroundingSearch: isGoogle,
    supportsUrlContext: isGoogle,
    supportsImageDetail: true,
    defaultMaxTokens: isGoogle ? 8192 : 4096,
    maxOutputTokensCap: isGoogle ? 65535 : 16384,
  };
}
