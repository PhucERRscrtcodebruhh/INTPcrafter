export const MODEL_CONTEXT_LIMITS = {
  // Gemini Flagship Series
  'gemini-4-argon-cyber-permissive': 1048576,
  'gemini-4-argon': 1048576,
  'gemini-3.8-flash': 1048576,
  'gemini-3.7-flash': 1048576,
  'gemini-3.6-flash': 1048576,
  'gemini-3.5-flash-lite': 1048576,
  'gemini-3.5-flash': 1048576,
  'gemini-3.1-pro-preview': 1048576,
  'gemini-3.1-pro': 1048576,
  'gemini-3.1-flash-lite': 1048576,
  'gemini-2.5-pro': 1048576,
  'gemini-2.5-flash-lite': 1048576,
  'gemini-2.5-flash': 1048576,
  'gemma-4-31b-it': 131072,
  'gemma-4-26b-a4b-it': 131072,

  // DeepSeek Flagship Series (128K context window)
  'deepseek-v4-pro': 1048576,
  'deepseek-v4-flash': 1048576,
  'deepseek-v3.2': 131072,
  'deepseek-chat': 1048576,
  'deepseek-r1-zero': 131072,
  'deepseek-r1-0528': 131072,
  'deepseek-r1': 131072,
  'deepseek-reasoner': 131072,
  'deepseek-reasoning': 131072,
  'deepseek-coder-v2': 131072,
  'deepseek-coder': 131072,
  'deepseek-math-v2': 131072,
  'deepseek-prover-v2': 131072,

  // OpenRouter & HuggingFace
  'openrouter/auto': 131072,
  'meta-llama/llama-3.3-70b-instruct': 131072,
  'mistralai/mistral-large': 131072,
  'huggingface/deepseek-ai/DeepSeek-R1': 131072,

  // Gemini 4 / next-gen
  'gemini-4-argon-cyber-permissive': 1048576,
  'gemini-4-argon': 1048576,
  'gemini-3.8-flash-cyber': 1048576,
  'gemini-3.8-live': 1048576,
  'gemini-3.5-flash-lite': 1048576,
  'gemini-3.5-flash': 1048576,
  'gemini-omni-1.1-flash-preview': 1048576,
  'gemini-nano-banana-2.1': 32768,
  'gemini-nano': 32768,

  // Gemma open weights
  'gemma-4-31b-it': 131072,
  'gemma-4-26b-a4b-it': 131072,
  'gemma-4-e4b-it': 131072,
  'gemma-4-e2b-it': 131072,
  'gemma-4-12b': 131072,
  'gemma-3-27b': 131072,
  'gemma-2-27b': 8192,
  'gemma-2-9b': 8192,
  'gemma-2-2b': 8192,

  // Groq production
  'llama-3.1-8b-instant': 131072,
  'llama-3.3-70b-versatile': 131072,
  'openai/gpt-oss-120b': 131072,
  'openai/gpt-oss-20b': 131072,
  'whisper-large-v3-turbo': 32768,
  'whisper-large-v3': 32768,

  // Groq preview
  'canopylabs/orpheus-arabic-saudi': 32768,
  'canopylabs/orpheus-v1-english': 32768,
  'meta-llama/llama-prompt-guard-2-22m': 32768,
  'meta-llama/llama-prompt-guard-2-86m': 32768,
  'meta-models/muse-spark-open': 32768,
  'minimaxai/minimax-m2.7': 131072,
  'openai/gpt-oss-safeguard-20b': 32768,
  'qwen/qwen3.8-27b': 131072,

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

// ==========================================
// PREFIX-CACHE-PRESERVING ROLLING ANCHORS
// ==========================================
// Sliding the window by one message every turn rewrites the very first tokens of
// the prompt, which invalidates the provider's implicit prefix cache for the whole
// conversation. Instead we pin a "first kept message" anchor and only move it in a
// single large batch (down to a low-water mark) when the budget is exceeded. Between
// rolls the prompt prefix stays byte-identical, so cache hits survive.
const ROLLING_ANCHOR_MAX = Number(process.env.ROLLING_ANCHOR_MAX || 500);
const ROLLING_ANCHOR_TTL_MS = Number(process.env.ROLLING_ANCHOR_TTL_MS || 6 * 60 * 60 * 1000);
const ROLLING_LOW_WATER_RATIO = Math.min(Math.max(Number(process.env.ROLLING_LOW_WATER_RATIO || 0.6), 0.2), 0.95);

const rollingAnchors = new Map(); // sessionKey -> { anchorId, updatedAt }

function messageTokens(msg) {
  return estimateTokens(msg?.content || '') + 4;
}

function totalMessageTokens(list) {
  let total = 0;
  for (const msg of list) total += messageTokens(msg);
  return total;
}

function rememberAnchor(sessionKey, anchorId, thresholdTokens) {
  const now = Date.now();
  rollingAnchors.delete(sessionKey);
  rollingAnchors.set(sessionKey, { anchorId, thresholdTokens, updatedAt: now });

  // Evict stale entries first, then the oldest ones if still over capacity.
  for (const [key, entry] of rollingAnchors) {
    if (now - entry.updatedAt > ROLLING_ANCHOR_TTL_MS) rollingAnchors.delete(key);
  }
  while (rollingAnchors.size > ROLLING_ANCHOR_MAX) {
    rollingAnchors.delete(rollingAnchors.keys().next().value);
  }
}

/** Drop the pinned anchor for one session (or all sessions when no key is given). */
export function resetRollingAnchors(sessionKey = null) {
  if (sessionKey) rollingAnchors.delete(sessionKey);
  else rollingAnchors.clear();
}

/**
 * Apply Rolling Context Window logic based on user-configured threshold.
 *
 * When `options.sessionKey` is supplied the window is anchored: an already-cached
 * cut point is reused for as long as it fits, and only advanced in one large batch
 * when the budget is exceeded. This keeps the request prefix stable across turns,
 * which is what preserves provider-side prefix cache hits.
 *
 * @param {Array} messages - Full history of messages in current session
 * @param {string} systemInstruction - Master world simulation instruction
 * @param {string} ragContext - Retrieved knowledge base lore (Tier 2 context)
 * @param {number} thresholdTokens - User-selected limit where rolling activates
 * @param {Object} [options] - { sessionKey, reset }
 * @returns {Object} { prunedMessages, isRolled, originalCount, keptCount, totalTokens, thresholdTokens, anchorId, cacheStable }
 */
export function applyRollingContext(
  messages = [],
  systemInstruction = '',
  ragContext = '',
  thresholdTokens = 32768,
  options = {}
) {
  const list = Array.isArray(messages) ? messages : [];
  const { sessionKey = null, reset = false } = options;

  const baseTokens = estimateTokens(systemInstruction) + 4 + estimateTokens(ragContext) + 4;
  const maxHistoryBudget = Math.max(1, thresholdTokens - baseTokens);

  // ---- Legacy behaviour: no session key -> simple backward fit (stateless) ----
  if (!sessionKey) {
    let currentHistoryTokens = 0;
    const keptMessages = [];
    let isRolled = false;

    for (let i = list.length - 1; i >= 0; i--) {
      const msg = list[i];
      const msgTokens = messageTokens(msg);

      // Always keep at least the very last message.
      if (i === list.length - 1 || (currentHistoryTokens + msgTokens <= maxHistoryBudget)) {
        keptMessages.unshift(msg);
        currentHistoryTokens += msgTokens;
      } else {
        isRolled = true;
      }
    }

    return {
      prunedMessages: keptMessages,
      isRolled,
      originalCount: list.length,
      keptCount: keptMessages.length,
      totalTokens: baseTokens + currentHistoryTokens,
      thresholdTokens,
      anchorId: keptMessages[0]?.id ?? null,
      cacheStable: false,
    };
  }

  // ---- Anchored behaviour: reuse the previous cut point whenever possible ----
  const cached = reset ? null : rollingAnchors.get(sessionKey);
  const sameBudget = cached?.thresholdTokens === thresholdTokens;
  let startIdx = 0;
  if (sameBudget && cached?.anchorId !== undefined && cached?.anchorId !== null) {
    const found = list.findIndex(m => String(m.id) === String(cached.anchorId));
    startIdx = found >= 0 ? found : 0;
  }

  let historyTokens = totalMessageTokens(list.slice(startIdx));

  if (historyTokens > maxHistoryBudget) {
    // Move the anchor forward in ONE batch to a low-water mark. The next turns can
    // then append messages without touching the prefix at all.
    const lowWater = Math.max(1, Math.floor(maxHistoryBudget * ROLLING_LOW_WATER_RATIO));
    let idx = startIdx;
    let running = historyTokens;

    while (idx < list.length - 1 && running > lowWater) {
      running -= messageTokens(list[idx]);
      idx += 1;
    }

    // Snap to a user turn so the trimmed history starts with a clean user request.
    while (idx < list.length - 1 && list[idx]?.role !== 'user') {
      running -= messageTokens(list[idx]);
      idx += 1;
    }

    startIdx = idx;
    historyTokens = running;
  }

  const prunedMessages = list.slice(startIdx);
  const anchorId = prunedMessages[0]?.id ?? null;

  if (anchorId !== null) rememberAnchor(sessionKey, anchorId, thresholdTokens);
  else if (reset) rollingAnchors.delete(sessionKey);

  return {
    prunedMessages,
    isRolled: startIdx > 0,
    originalCount: list.length,
    keptCount: prunedMessages.length,
    totalTokens: baseTokens + historyTokens,
    thresholdTokens,
    anchorId,
    cacheStable: true,
  };
}
