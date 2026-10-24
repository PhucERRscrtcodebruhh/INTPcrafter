/**
 * AI Request Dispatcher & Payload Sanitizer (2026 @google/genai Specs)
 * Enforces a strict boundary between Google's official @google/genai SDK specifications
 * and OpenAI/Universal specifications.
 */

import { GEMINI_TEXT_MODELS, resolveModelCapabilities } from '../../src/config/modelRegistry.js';

export { GEMINI_TEXT_MODELS, resolveModelCapabilities };

/**
 * A. Model ID Resolver for Google Gemini (2026 Native Production Models)
 * Passes 'gemini-3.8-flash', 'gemini-4-argon', and all 2026 production models
 * directly to the Google API without downgrading to 2.5.
 *
 * @param {string} modelId
 * @returns {string}
 */
export function resolveGoogleModelId(modelId = '') {
  let m = String(modelId || 'gemini-3.8-flash').trim();
  if (m.startsWith('models/')) {
    m = m.replace(/^models\//i, '').trim();
  }
  return m || 'gemini-3.8-flash';
}

/**
 * Determines whether a Google model supports reasoning / ThinkingConfig.
 *
 * @param {string} modelId
 * @param {string} [resolvedModel]
 * @returns {boolean}
 */
export function supportsGoogleThinking(modelId = '', resolvedModel = '') {
  const target = String(resolvedModel || modelId || '').toLowerCase().trim();
  if (GEMINI_TEXT_MODELS[target]) {
    return Boolean(GEMINI_TEXT_MODELS[target].supportsThinking);
  }
  if (target.includes('-lite') || target.startsWith('gemma-') || target.includes('nano')) {
    return false;
  }
  const isLegacy = target.includes('gemini-2.5-pro');
  return (
    target.includes('argon') ||
    target.includes('gemini-3.8-flash') ||
    target.includes('gemini-3.7-flash') ||
    target.includes('gemini-3.1-pro') ||
    isLegacy
  );
}

const VALID_SAFETY_CATEGORIES = new Set([
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_CIVIC_INTEGRITY',
]);

const VALID_SAFETY_THRESHOLDS = new Set([
  'BLOCK_NONE',
  'BLOCK_LOW_AND_ABOVE',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_ONLY_HIGH',
  'OFF',
]);

/**
 * Validates and normalizes Google AI Studio safety settings array.
 *
 * @param {Array} safetySettings
 * @returns {Array|undefined}
 */
export function transformGoogleSafetySettings(safetySettings) {
  if (!Array.isArray(safetySettings) || safetySettings.length === 0) {
    return undefined;
  }
  const valid = safetySettings
    .filter((s) => s && VALID_SAFETY_CATEGORIES.has(s.category) && VALID_SAFETY_THRESHOLDS.has(s.threshold))
    .map((s) => ({
      category: s.category,
      threshold: s.threshold,
    }));
  return valid.length > 0 ? valid : undefined;
}

/**
 * B & C. The 2026 Google `@google/genai` Text Master Config Transformer
 * Enforces strict configuration pruning:
 * - If a model doesn't support reasoning (e.g., flash-lite, 3.6-flash, 3.5-flash, 2.5-flash)
 *   or if thinking is disabled: passes standard sampling keys (temperature, topP, topK) and deletes thinkingConfig.
 * - If thinking is enabled on Gemini 3.8+ / 3.7 / 3.1-pro or Gemini 4 Argon: purges all sampling keys
 *   (temperature, topP, topK) and passes uppercase `thinkingLevel` ('MINIMAL', 'LOW', 'MEDIUM', 'HIGH').
 * - If thinking is enabled on legacy Gemini 2.5 Pro: passes `thinkingBudget` and `temperature`.
 * - Supports up to 1,000,000 maxOutputTokens on 'gemini-4-argon'.
 *
 * @param {Object} clientConfig
 * @param {string} resolvedModel
 * @returns {Object} Strict Google `GenerateContentConfig`
 */
export function transformToGoogleTextMasterConfig(clientConfig = {}, resolvedModel = 'gemini-3.8-flash') {
  const modelStr = String(resolvedModel || clientConfig.model || 'gemini-3.8-flash').toLowerCase().trim();
  const modelMeta = GEMINI_TEXT_MODELS[modelStr];
  const maxOutputCap = modelMeta
    ? modelMeta.maxOutputTokens
    : modelStr.includes('argon')
      ? 1000000
      : modelStr.includes('gemini-2.5')
        ? 8192
        : 65536;

  const rawMaxTokens =
    clientConfig.maxOutputTokens ??
    clientConfig.max_tokens ??
    clientConfig.max_completion_tokens;
  const resolvedMaxTokens =
    typeof rawMaxTokens === 'number' && !Number.isNaN(rawMaxTokens) && rawMaxTokens > 0
      ? Math.min(rawMaxTokens, maxOutputCap)
      : undefined;

  const rawStop = clientConfig.stopSequences ?? clientConfig.stop;
  let resolvedStop;
  if (Array.isArray(rawStop) && rawStop.length > 0) {
    const clean = rawStop.map((s) => String(s)).filter(Boolean);
    if (clean.length > 0) resolvedStop = clean;
  } else if (typeof rawStop === 'string' && rawStop.trim()) {
    resolvedStop = [rawStop.trim()];
  }

  const rawSystemInstruction = clientConfig.systemInstruction ?? clientConfig.system_prompt;
  const resolvedSystemInstruction =
    typeof rawSystemInstruction === 'string'
      ? rawSystemInstruction.trim()
      : rawSystemInstruction;

  // 1. Khởi tạo cấu hình cơ bản cho văn bản thuần túy
  const googleConfig = {
    maxOutputTokens: resolvedMaxTokens,
    stopSequences: resolvedStop,
    systemInstruction: resolvedSystemInstruction,
  };

  if (clientConfig.safetySettings) {
    googleConfig.safetySettings = transformGoogleSafetySettings(clientConfig.safetySettings);
  }

  // 2. Kiểm tra các dòng model hỗ trợ tư duy sâu
  const isLegacy = modelStr.includes('gemini-2.5-pro');
  const isLite = modelStr.includes('-lite');
  const supportsThinking =
    !isLite &&
    (modelStr.includes('argon') ||
      modelStr.includes('gemini-3.8-flash') ||
      modelStr.includes('gemini-3.7-flash') ||
      modelStr.includes('gemini-3.1-pro') ||
      isLegacy);

  // LƯU Ý: Các bản chứa "-lite" hoặc các mã 3.5/3.6/2.5-flash thường không hỗ trợ Thinking
  if (clientConfig.thinkingEnabled && supportsThinking) {
    if (isLegacy) {
      // Dòng 2.5 cũ: dùng số lượng token (thinkingBudget)
      googleConfig.thinkingConfig = {
        thinkingBudget: Number(clientConfig.thinkingBudget) || 2048,
      };
      googleConfig.temperature = clientConfig.temperature ?? 1.0;
    } else {
      // THẾ HỆ 3.8+ VÀ 4 ARGON: Sử dụng chuỗi định mức độ tư duy viết HOA
      const allowedLevels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
      let level =
        typeof clientConfig.thinkingLevel === 'string'
          ? clientConfig.thinkingLevel.toUpperCase().trim()
          : '';
      if (!allowedLevels.includes(level)) {
        level = modelStr.includes('argon') || modelStr.includes('gemini-3.1-pro') ? 'HIGH' : 'MEDIUM';
      }

      googleConfig.thinkingConfig = {
        thinkingLevel: level,
      };

      // 🚨 BẮT BUỘC: Xóa triệt để các tham số sampling truyền thống để chống lỗi 400 từ Google API 2026
      delete googleConfig.temperature;
      delete googleConfig.topP;
      delete googleConfig.topK;
    }
  } else {
    // Trường hợp TẮT tư duy hoặc model không hỗ trợ (như các bản Flash-Lite, Gemini 3.5, v.v.)
    googleConfig.temperature = clientConfig.temperature ?? 1.0;
    googleConfig.topP = clientConfig.topP ?? clientConfig.top_p;
    googleConfig.topK = clientConfig.topK ?? clientConfig.top_k;
    delete googleConfig.thinkingConfig;
  }

  // Optional Tools / Grounding
  if (Array.isArray(clientConfig.tools) && clientConfig.tools.length > 0) {
    googleConfig.tools = clientConfig.tools;
  } else if (clientConfig.groundingWithGoogleSearch) {
    googleConfig.tools = [{ googleSearch: {} }];
  }

  // 3. Làm sạch payload
  Object.keys(googleConfig).forEach((key) => {
    if (googleConfig[key] === undefined || googleConfig[key] === '') {
      delete googleConfig[key];
    }
  });

  return googleConfig;
}

/**
 * Alias for transformToGoogleTextMasterConfig for full compatibility across backend services.
 */
export function transformToGoogleConfig(clientConfig = {}, resolvedModel = 'gemini-3.8-flash') {
  return transformToGoogleTextMasterConfig(clientConfig, resolvedModel);
}

/**
 * Builds and sanitizes Google GenAI Native configuration object.
 *
 * @param {Object} params - Unified model parameters
 * @param {import('../../src/config/modelRegistry.js').ModelCapabilitySchema} [modelCapabilities]
 * @returns {Object} Google GenAI config
 */
export function buildGoogleGenAIConfig(params = {}, modelCapabilities) {
  let targetModel = params.model;
  if (!targetModel) {
    if (modelCapabilities?.reasoningType === 'none') {
      targetModel = 'gemini-3.6-flash';
    } else if (modelCapabilities?.reasoningType === 'google-budget') {
      targetModel = 'gemini-2.5-pro';
    } else {
      targetModel = 'gemini-3.8-flash';
    }
  }
  const resolvedModel = resolveGoogleModelId(targetModel);
  return transformToGoogleTextMasterConfig(params, resolvedModel);
}

/**
 * Builds and sanitizes OpenAI-Compatible completion payload.
 * Strictly avoids leaking Google-exclusive fields (e.g. topK, thinkingConfig, groundingWithGoogleSearch, safetySettings).
 *
 * @param {Object} params - Unified model parameters
 * @param {import('../../src/config/modelRegistry.js').ModelCapabilitySchema} modelCapabilities
 * @param {Array} messages - Formatted messages array
 * @returns {Object} OpenAI-compatible payload
 */
export function buildOpenAICompatiblePayload(params = {}, modelCapabilities, messages = []) {
  const caps = modelCapabilities || resolveModelCapabilities('openai-compatible', params.model || '');

  const resolvedTopP = typeof params.top_p === 'number'
    ? params.top_p
    : (typeof params.topP === 'number' ? params.topP : 0.95);
  const resolvedMaxTokens = typeof params.max_completion_tokens === 'number'
    ? params.max_completion_tokens
    : (typeof params.max_tokens === 'number'
      ? params.max_tokens
      : (typeof params.maxOutputTokens === 'number' ? params.maxOutputTokens : caps.defaultMaxTokens));
  const resolvedFreqPenalty = typeof params.frequency_penalty === 'number'
    ? params.frequency_penalty
    : (typeof params.frequencyPenalty === 'number' ? params.frequencyPenalty : 0.0);
  const resolvedPresPenalty = typeof params.presence_penalty === 'number'
    ? params.presence_penalty
    : (typeof params.presencePenalty === 'number' ? params.presencePenalty : 0.0);

  const payload = {
    messages,
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
    top_p: resolvedTopP,
    max_tokens: resolvedMaxTokens,
    stream: !params.disableStreaming,
  };

  if (caps.supportsPenalties) {
    payload.frequency_penalty = resolvedFreqPenalty;
    payload.presence_penalty = resolvedPresPenalty;
  }

  if (params.stopSequences && Array.isArray(params.stopSequences) && params.stopSequences.length > 0) {
    payload.stop = params.stopSequences;
  } else if (params.stop && Array.isArray(params.stop) && params.stop.length > 0) {
    payload.stop = params.stop;
  }

  if (caps.reasoningType === 'openai-effort' && params.reasoningEffort && params.reasoningEffort !== 'auto') {
    payload.reasoning_effort = params.reasoningEffort;
  }

  return payload;
}
