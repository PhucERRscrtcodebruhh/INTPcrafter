export const MODEL_CONTEXT_LIMITS = {
  'gemini-3.8-flash': 1048576,
  'gemini-3.7-flash': 1048576,
  'gemini-3.6-flash': 1048576,
  'gemini-3.5-flash-lite': 1048576,
  'gemini-3.1-pro': 1048576,
  'gemini-2.5-pro': 2097152,
  'gemini-2.5-flash': 1048576,
  'gemma-4-31b-it': 131072,
  'gemma-4-26b-a4b-it': 131072,
  'default': 1048576
};

/**
 * Returns maximum context window tokens for a given model
 */
export function getModelContextLimit(modelName) {
  if (!modelName) return MODEL_CONTEXT_LIMITS.default;
  const lower = modelName.toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (lower.includes(key)) return limit;
  }
  return MODEL_CONTEXT_LIMITS.default;
}

/**
 * Accurate heuristic token estimation for Gemini/LLM models
 * Accounts for English (~4 chars/token) and multi-byte/Vietnamese/CJK (~1.8 chars/token)
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  let asciiCount = 0;
  let nonAsciiCount = 0;
  
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }
  
  const estimatedTokens = Math.ceil((asciiCount / 3.8) + (nonAsciiCount / 1.7));
  return Math.max(1, estimatedTokens);
}

/**
 * Estimate total tokens of message payload including system instruction and lore
 */
export function calculateContextTokens(messages = [], systemInstruction = '', ragContext = '') {
  let tokens = 0;
  
  if (systemInstruction) {
    tokens += estimateTokens(systemInstruction) + 4;
  }
  if (ragContext) {
    tokens += estimateTokens(ragContext) + 4;
  }
  
  for (const msg of messages) {
    // 4 overhead tokens per message for role formatting
    tokens += estimateTokens(msg.content || '') + 4;
  }
  
  return tokens;
}

/**
 * Apply Rolling Context Window logic based on user-configured threshold
 * 
 * @param {Array} messages - Full history of messages in current session
 * @param {string} systemInstruction - Master world simulation instruction
 * @param {string} ragContext - Retrieved knowledge base lore
 * @param {number} thresholdTokens - User-selected limit where rolling activates
 * @returns {Object} { prunedMessages, isRolled, originalCount, keptCount, currentTokens, limit }
 */
export function applyRollingContext(messages = [], systemInstruction = '', ragContext = '', thresholdTokens = 32768) {
  const systemTokens = estimateTokens(systemInstruction) + 4;
  const loreTokens = estimateTokens(ragContext) + 4;
  const baseTokens = systemTokens + loreTokens;
  
  const maxHistoryBudget = Math.max(1, thresholdTokens - baseTokens);
  
  let currentHistoryTokens = 0;
  const keptMessages = [];
  let isRolled = false;
  
  // Work backwards from newest message to oldest to preserve recent narrative continuity
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content || '') + 4;
    
    // Always keep at least the very last user message
    if (i === messages.length - 1 || (currentHistoryTokens + msgTokens <= maxHistoryBudget)) {
      keptMessages.unshift(msg);
      currentHistoryTokens += msgTokens;
    } else {
      isRolled = true;
      // Truncate older context
    }
  }
  
  const totalTokens = baseTokens + currentHistoryTokens;
  
  return {
    prunedMessages: keptMessages,
    isRolled,
    originalCount: messages.length,
    keptCount: keptMessages.length,
    totalTokens,
    thresholdTokens,
  };
}
