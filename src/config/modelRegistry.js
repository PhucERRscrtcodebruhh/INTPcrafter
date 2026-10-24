/**
 * Model Registry & Feature Schema for Dynamic Multi-Provider Cockpit (2026 Specs)
 */

export const GEMINI_TEXT_MODELS = {
  // --- THẾ HỆ 4: SIÊU TƯ DUY (Flagship Reasoning) ---
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    contextWindow: 1048576,
    maxOutputTokens: 1000000, // Trần decode lên tới 1M tokens
    supportsThinking: true,
    thinkingDefault: 'high'
  },

  // --- THẾ HỆ 3: WORKHORSE CHAT (Flash & Flash-Lite Series) ---
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (GA)',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: true,
    thinkingDefault: 'medium'
  },
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: true,
    thinkingDefault: 'medium'
  },
  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: false
  },
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: false
  },
  // Bản Lite siêu tốc độ của thế hệ 3
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: false
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: true,
    thinkingDefault: 'high'
  },
  // Bản Lite cổ điển dòng 3.1
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsThinking: false
  },

  // --- THẾ HỆ 2.5: CỰU BINH (Legacy) ---
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsThinking: true,
    isLegacyThinking: true
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsThinking: false
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsThinking: false
  }
};

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
 * @property {boolean} supportsThinking
 * @property {boolean} isLegacyThinking
 * @property {string} [thinkingDefault]
 * @property {number} [contextWindow]
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

  const isGoogle =
    p === 'google' ||
    p === 'gemini' ||
    m.startsWith('gemini-') ||
    m.startsWith('gemma-') ||
    Boolean(GEMINI_TEXT_MODELS[m]);

  if (isGoogle) {
    const exactEntry = GEMINI_TEXT_MODELS[m];
    const isGemma = m.startsWith('gemma-');
    const isArgon = m.includes('argon');
    const isLite = m.includes('-lite');
    const isLegacy25Pro = Boolean(exactEntry?.isLegacyThinking) || m.includes('gemini-2.5-pro');

    let supportsThinking = false;
    if (exactEntry) {
      supportsThinking = Boolean(exactEntry.supportsThinking);
    } else if (!isGemma && !isLite) {
      supportsThinking =
        isArgon ||
        m.includes('gemini-3.8-flash') ||
        m.includes('gemini-3.7-flash') ||
        m.includes('gemini-3.1-pro') ||
        isLegacy25Pro;
    }

    let reasoningType = 'none';
    if (supportsThinking) {
      reasoningType = isLegacy25Pro ? 'google-budget' : 'google-level';
    }

    const maxOutputTokensCap = exactEntry
      ? exactEntry.maxOutputTokens
      : isArgon
        ? 1000000
        : m.includes('gemini-2.5')
          ? 8192
          : 65536;

    const defaultMaxTokens = Math.min(8192, maxOutputTokensCap);
    const thinkingDefault =
      exactEntry?.thinkingDefault ||
      (isArgon || m.includes('gemini-3.1-pro') ? 'high' : supportsThinking ? 'medium' : undefined);

    return {
      provider: 'google',
      supportsTopK: true,
      supportsPenalties: false,
      supportsStopSequences: true,
      reasoningType,
      supportsThinking,
      isLegacyThinking: isLegacy25Pro,
      thinkingDefault,
      contextWindow: exactEntry?.contextWindow || 1048576,
      supportsGroundingSearch: true,
      supportsUrlContext: true,
      supportsImageDetail: true,
      defaultMaxTokens,
      maxOutputTokensCap,
    };
  }

  const isReasoningOpenAI =
    m.includes('r1') || m.includes('o1') || m.includes('o3') || m.includes('reasoner');

  return {
    provider: 'openai-compatible',
    supportsTopK: false,
    supportsPenalties: true,
    supportsStopSequences: true,
    reasoningType: isReasoningOpenAI ? 'openai-effort' : 'none',
    supportsThinking: isReasoningOpenAI,
    isLegacyThinking: false,
    supportsGroundingSearch: false,
    supportsUrlContext: false,
    supportsImageDetail: true,
    defaultMaxTokens: 4096,
    maxOutputTokensCap: 16384,
  };
}
