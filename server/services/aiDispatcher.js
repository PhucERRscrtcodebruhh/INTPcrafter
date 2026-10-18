/**
 * AI Request Dispatcher & Payload Sanitizer
 * Enforces zero-parameter leakage across Google GenAI Native and OpenAI-Compatible endpoints.
 */

import { resolveModelCapabilities } from '../../src/config/modelRegistry.js';

export { resolveModelCapabilities };

/**
 * Builds and sanitizes Google GenAI Native configuration object.
 * Strictly avoids leaking OpenAI-exclusive fields (e.g. penalties, reasoning_effort).
 *
 * @param {Object} params - Unified model parameters
 * @param {import('../../src/config/modelRegistry.js').ModelCapabilitySchema} modelCapabilities
 * @returns {Object} Google GenAI config
 */
export function buildGoogleGenAIConfig(params = {}, modelCapabilities) {
  const caps = modelCapabilities || resolveModelCapabilities('google', params.model || '');

  const config = {
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
    topP: typeof params.topP === 'number' ? params.topP : 0.95,
    maxOutputTokens: typeof params.maxOutputTokens === 'number' ? params.maxOutputTokens : caps.defaultMaxTokens,
  };

  if (caps.supportsTopK && params.topK !== undefined) {
    config.topK = params.topK;
  }

  // Thinking configuration
  if (params.thinkingEnabled) {
    if (caps.reasoningType === 'google-level') {
      config.thinkingConfig = {
        thinkingLevel: params.thinkingLevel === 'auto' ? undefined : params.thinkingLevel,
      };
    } else if (caps.reasoningType === 'google-budget') {
      config.thinkingConfig = {
        thinkingBudget: params.thinkingBudget === -1 ? undefined : params.thinkingBudget,
      };
    }
  } else {
    // Explicitly turn off thinking if supported
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  // Tools
  if (params.groundingWithGoogleSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  return config;
}

/**
 * Builds and sanitizes OpenAI-Compatible completion payload.
 * Strictly avoids leaking Google-exclusive fields (e.g. topK, thinkingConfig, groundingWithGoogleSearch).
 *
 * @param {Object} params - Unified model parameters
 * @param {import('../../src/config/modelRegistry.js').ModelCapabilitySchema} modelCapabilities
 * @param {Array} messages - Formatted messages array
 * @returns {Object} OpenAI-compatible payload
 */
export function buildOpenAICompatiblePayload(params = {}, modelCapabilities, messages = []) {
  const caps = modelCapabilities || resolveModelCapabilities('openai-compatible', params.model || '');

  const payload = {
    messages,
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
    top_p: typeof params.topP === 'number' ? params.topP : 0.95,
    max_tokens: typeof params.maxOutputTokens === 'number' ? params.maxOutputTokens : caps.defaultMaxTokens,
    stream: !params.disableStreaming,
  };

  if (caps.supportsPenalties) {
    payload.frequency_penalty = typeof params.frequencyPenalty === 'number' ? params.frequencyPenalty : 0.0;
    payload.presence_penalty = typeof params.presencePenalty === 'number' ? params.presencePenalty : 0.0;
  }

  if (params.stopSequences && Array.isArray(params.stopSequences) && params.stopSequences.length > 0) {
    payload.stop = params.stopSequences;
  }

  if (caps.reasoningType === 'openai-effort' && params.reasoningEffort && params.reasoningEffort !== 'auto') {
    payload.reasoning_effort = params.reasoningEffort;
  }

  return payload;
}
