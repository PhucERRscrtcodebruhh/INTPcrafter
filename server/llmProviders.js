import crypto from 'crypto';
import { pool } from './db.js';
import { 
  sha256Hash, 
  encryptKey, 
  decryptKey, 
  getPoolForUser, 
  GeminiKeyPool 
} from './geminiPool.js';

export const PROVIDER_ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  huggingface: 'https://api-inference.huggingface.co/v1'
};

// Map UI Model names to upstream API Model IDs
export function resolveModelForProvider(modelName, provider = 'deepseek') {
  const m = (modelName || '').toLowerCase().trim();
  
  if (provider === 'deepseek') {
    if (m.includes('reasoner') || m.includes('reasoning') || m.includes('r1') || m.includes('zero') || m.includes('0528')) {
      return 'deepseek-reasoner';
    }
    if (m.includes('coder')) {
      return 'deepseek-coder';
    }
    return 'deepseek-chat';
  }

  if (provider === 'openrouter') {
    if (m.startsWith('openrouter/')) return m.replace('openrouter/', '');
    if (m.includes('r1')) return 'deepseek/deepseek-r1';
    if (m.includes('v4') || m.includes('v3') || m.includes('chat')) return 'deepseek/deepseek-chat';
    return modelName;
  }

  if (provider === 'huggingface') {
    if (m.startsWith('huggingface/')) return m.replace('huggingface/', '');
    return modelName;
  }

  return modelName;
}

// Determine provider from model name
export function detectProviderFromModel(modelName) {
  const m = (modelName || '').toLowerCase().trim();
  if (m.startsWith('deepseek-') || m.startsWith('deepseek/')) return 'deepseek';
  if (m.startsWith('openrouter/') || m.includes('llama') || m.includes('mistral') || m.includes('claude')) return 'openrouter';
  if (m.startsWith('huggingface/') || m.startsWith('hf/')) return 'huggingface';
  return 'gemini';
}

/**
 * Universal OpenAI-Compatible SSE Streaming Client
 */
export async function callOpenAICompatibleStream({
  apiKey,
  baseUrl = 'https://api.deepseek.com/v1',
  model = 'deepseek-chat',
  messages = [],
  systemInstruction = '',
  temperature = 0.7,
  topP = 0.95,
  maxTokens = 4096,
  onChunk,
  extraHeaders = {}
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const formattedMessages = [];
  const hasSystemInMessages = messages.some(m => m.role === 'system');
  if (!hasSystemInMessages && systemInstruction && systemInstruction.trim()) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction.trim()
    });
  }

  messages.forEach(msg => {
    let content = '';
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.parts)) {
      content = msg.parts.map(p => p.text || '').join('');
    }
    const role = (msg.role === 'model' || msg.role === 'assistant')
      ? 'assistant'
      : (msg.role === 'system' ? 'system' : 'user');
    formattedMessages.push({ role, content });
  });

  const payload = {
    model,
    messages: formattedMessages,
    temperature: typeof temperature === 'number' ? temperature : 0.7,
    top_p: typeof topP === 'number' ? topP : 0.95,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 4096,
    stream: true
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`,
    ...extraHeaders
  };

  if (baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = 'https://storycontainer.intp';
    headers['X-Title'] = 'StoryContainer Engine';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errBody = '';
    try {
      const errJson = await response.json();
      errBody = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errBody = await response.text();
    }
    const error = new Error(`Provider API Error (${response.status}): ${errBody}`);
    error.status = response.status;
    throw error;
  }

  if (!response.body) {
    throw new Error('No readable stream body returned from LLM provider.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let reasoningText = '';
  let isReasoningOpen = false;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') continue;

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // DeepSeek-R1 reasoning content handling
          if (delta.reasoning_content) {
            if (!isReasoningOpen) {
              isReasoningOpen = true;
              const openTag = '<think>\n';
              fullText += openTag;
              if (onChunk) onChunk(openTag);
            }
            reasoningText += delta.reasoning_content;
            fullText += delta.reasoning_content;
            if (onChunk) onChunk(delta.reasoning_content);
          }

          if (delta.content) {
            if (isReasoningOpen) {
              isReasoningOpen = false;
              const closeTag = '\n</think>\n\n';
              fullText += closeTag;
              if (onChunk) onChunk(closeTag);
            }
            fullText += delta.content;
            if (onChunk) onChunk(delta.content);
          }
        } catch (parseErr) {
          // Incomplete chunk, keep going
        }
      }
    }
  }

  if (isReasoningOpen) {
    const closeTag = '\n</think>\n\n';
    fullText += closeTag;
    if (onChunk) onChunk(closeTag);
  }

  return {
    text: fullText,
    reasoningText,
    model,
    finishReason: 'STOP'
  };
}

/**
 * Universal Non-Streaming Call
 */
export async function callOpenAICompatibleApi({
  apiKey,
  baseUrl = 'https://api.deepseek.com/v1',
  model = 'deepseek-chat',
  messages = [],
  systemInstruction = '',
  temperature = 0.7,
  topP = 0.95,
  maxTokens = 4096,
  extraHeaders = {}
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const formattedMessages = [];
  const hasSystemInMessages = messages.some(m => m.role === 'system');
  if (!hasSystemInMessages && systemInstruction && systemInstruction.trim()) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction.trim()
    });
  }

  messages.forEach(msg => {
    let content = '';
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.parts)) {
      content = msg.parts.map(p => p.text || '').join('');
    }
    const role = (msg.role === 'model' || msg.role === 'assistant')
      ? 'assistant'
      : (msg.role === 'system' ? 'system' : 'user');
    formattedMessages.push({ role, content });
  });

  const payload = {
    model,
    messages: formattedMessages,
    temperature: typeof temperature === 'number' ? temperature : 0.7,
    top_p: typeof topP === 'number' ? topP : 0.95,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 4096,
    stream: false
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`,
    ...extraHeaders
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errBody = '';
    try {
      const errJson = await response.json();
      errBody = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errBody = await response.text();
    }
    const error = new Error(`Provider API Error (${response.status}): ${errBody}`);
    error.status = response.status;
    throw error;
  }

  const json = await response.json();
  const choice = json.choices?.[0];
  let replyText = choice?.message?.content || '';
  const reasoning = choice?.message?.reasoning_content || '';

  if (reasoning) {
    replyText = `<think>\n${reasoning}\n</think>\n\n${replyText}`;
  }

  return {
    text: replyText,
    model: json.model || model,
    finishReason: choice?.finish_reason || 'STOP',
    usageMetadata: json.usage ? {
      promptTokenCount: json.usage.prompt_tokens,
      candidatesTokenCount: json.usage.completion_tokens,
      totalTokenCount: json.usage.total_tokens
    } : null
  };
}

/**
 * Provider-Specific Key Pool Manager
 */
export class ProviderKeyPool {
  constructor(userId = 0, provider = 'deepseek') {
    this.userId = userId;
    this.provider = provider;
    this.keys = [];
    this.currentIndex = -1;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      let rows;
      if (this.userId > 0) {
        [rows] = await pool.query(
          `SELECT id, provider, base_url, key_hash, encrypted_key, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg 
           FROM user_api_keys WHERE user_id = ? AND provider = ? ORDER BY id ASC`,
          [this.userId, this.provider]
        );
      } else {
        [rows] = await pool.query(
          `SELECT id, provider, base_url, key_hash, encrypted_key, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg 
           FROM api_keys_vault WHERE provider = ? ORDER BY id ASC`,
          [this.provider]
        );
      }

      this.keys = (rows || []).map(row => {
        const rawKey = decryptKey(row.encrypted_key);
        return {
          id: row.id,
          provider: row.provider || this.provider,
          baseUrl: row.base_url || PROVIDER_ENDPOINTS[this.provider] || PROVIDER_ENDPOINTS.deepseek,
          key: rawKey,
          hash: row.key_hash || sha256Hash(rawKey),
          masked: row.masked_key || this.maskKey(rawKey),
          status: row.status || 'active',
          callCount: row.call_count || 0,
          requestCount: row.request_count || 0,
          rateLimitCount: row.rate_limit_count || 0,
          lastUsed: row.last_used_at || null,
          rateLimitedUntil: row.rate_limited_until || null,
          errorMsg: row.error_msg || ''
        };
      });

      this.initialized = true;
    } catch (err) {
      console.error(`[ProviderKeyPool] Failed to load keys for provider ${this.provider}:`, err.message);
      this.initialized = true;
    }
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  getStatus() {
    const now = Date.now();
    return this.keys.map(k => {
      let effectiveStatus = k.status;
      if (effectiveStatus === 'rate_limited' && k.rateLimitedUntil && now > k.rateLimitedUntil) {
        effectiveStatus = 'active';
        k.status = 'active';
        k.rateLimitedUntil = null;
        k.errorMsg = '';
      }
      return {
        id: k.id,
        provider: k.provider,
        baseUrl: k.baseUrl,
        hash: k.hash ? k.hash.substring(0, 16) + '...' : '',
        masked: k.masked,
        status: effectiveStatus,
        callCount: k.callCount || 0,
        requestCount: k.requestCount || 0,
        rateLimitCount: k.rateLimitCount || 0,
        lastUsed: k.lastUsed,
        rateLimitedUntil: k.rateLimitedUntil,
        cooldownSecondsRemaining: k.rateLimitedUntil && k.rateLimitedUntil > now ? Math.ceil((k.rateLimitedUntil - now) / 1000) : 0,
        errorMsg: k.errorMsg
      };
    });
  }

  getNextKeyIndex() {
    if (this.keys.length === 0) return -1;
    const now = Date.now();
    this.keys.forEach(k => {
      if (k.status === 'rate_limited' && k.rateLimitedUntil && now > k.rateLimitedUntil) {
        k.status = 'active';
        k.rateLimitedUntil = null;
        k.errorMsg = '';
      }
    });

    const activeIndices = [];
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].status === 'active') {
        activeIndices.push(i);
      }
    }

    if (activeIndices.length === 0) return -1;

    let nextIdx = (this.currentIndex + 1) % this.keys.length;
    if (nextIdx < 0) nextIdx = 0;
    let attempts = 0;
    while (attempts < this.keys.length) {
      const idx = (nextIdx + attempts) % this.keys.length;
      if (this.keys[idx].status === 'active') {
        this.currentIndex = idx;
        return idx;
      }
      attempts++;
    }

    return activeIndices[0];
  }

  async updateKeyMetrics(keyObj) {
    if (!keyObj || !keyObj.hash) return;
    try {
      const tableName = this.userId > 0 ? 'user_api_keys' : 'api_keys_vault';
      const whereClause = this.userId > 0 ? 'WHERE user_id = ? AND provider = ? AND key_hash = ?' : 'WHERE provider = ? AND key_hash = ?';
      const params = [
        keyObj.callCount || 0,
        keyObj.requestCount || 0,
        keyObj.rateLimitCount || 0,
        keyObj.lastUsed || null,
        keyObj.status || 'active',
        keyObj.rateLimitedUntil || null,
        keyObj.errorMsg || null
      ];

      if (this.userId > 0) {
        params.push(this.userId, this.provider, keyObj.hash);
      } else {
        params.push(this.provider, keyObj.hash);
      }

      await pool.query(
        `UPDATE ${tableName} 
         SET call_count = ?, request_count = ?, rate_limit_count = ?, last_used_at = ?, status = ?, rate_limited_until = ?, error_msg = ?
         ${whereClause}`,
        params
      );
    } catch (err) {
      console.warn(`[ProviderKeyPool] Metric sync warning for ${this.provider}:`, err.message);
    }
  }

  async executeStreamWithRotation({ model, messages, systemInstruction, generationConfig, onChunk }) {
    await this.init();
    if (this.keys.length === 0) {
      throw new Error(`NO_API_KEYS: No API keys configured for provider '${this.provider}'.`);
    }

    const rotationLogs = [];
    let attempts = 0;
    const maxAttempts = this.keys.length;
    let previousErrorWas429 = false;

    const resolvedModel = resolveModelForProvider(model, this.provider);

    while (attempts < maxAttempts) {
      const keyIdx = this.getNextKeyIndex();
      if (keyIdx === -1) {
        const cooldowns = this.keys.map(k => k.rateLimitedUntil ? Math.max(0, Math.ceil((k.rateLimitedUntil - Date.now()) / 1000)) : 0);
        const minWait = Math.min(...cooldowns.filter(c => c > 0)) || 60;
        throw new Error(`ALL_KEYS_EXHAUSTED: All ${this.keys.length} keys for provider '${this.provider}' are rate-limited. Next cooldown in ~${minWait}s.`);
      }

      const keyObj = this.keys[keyIdx];
      attempts++;

      if (attempts > 1) {
        if (previousErrorWas429) {
          rotationLogs.push(`Immediate 429 failover (${this.provider}): Switching to Key #${keyObj.id} (${keyObj.masked})`);
        } else {
          rotationLogs.push(`Key rotation delay (${this.provider}): Enforcing 2000ms cooldown...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      keyObj.requestCount = (keyObj.requestCount || 0) + 1;
      this.updateKeyMetrics(keyObj).catch(() => {});

      try {
        rotationLogs.push(`Attempt ${attempts}: Dispatching stream to ${this.provider} (${resolvedModel}) via Key #${keyObj.id} (${keyObj.masked})`);

        const result = await callOpenAICompatibleStream({
          apiKey: keyObj.key,
          baseUrl: keyObj.baseUrl || PROVIDER_ENDPOINTS[this.provider] || PROVIDER_ENDPOINTS.deepseek,
          model: resolvedModel,
          messages,
          systemInstruction,
          temperature: generationConfig?.temperature ?? 0.7,
          topP: generationConfig?.topP ?? 0.95,
          maxTokens: generationConfig?.maxOutputTokens ?? 4096,
          onChunk
        });

        keyObj.callCount = (keyObj.callCount || 0) + 1;
        keyObj.lastUsed = Date.now();
        keyObj.status = 'active';
        keyObj.errorMsg = '';
        previousErrorWas429 = false;

        this.updateKeyMetrics(keyObj).catch(() => {});

        return {
          ...result,
          keyUsed: { id: keyObj.id, masked: keyObj.masked, provider: this.provider },
          rotationLogs
        };
      } catch (err) {
        const status = err.status || 0;
        const errMsg = err.message || 'Unknown Provider Error';
        const lowerMsg = errMsg.toLowerCase();
        console.warn(`[ProviderKeyPool ${this.provider}] Key #${keyObj.id} failed:`, errMsg);

        const is429 = status === 429 || errMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('rate_limit') || lowerMsg.includes('resource_exhausted');
        const isAuthError = status === 401 || status === 403 || 
          errMsg.includes('API_KEY_INVALID') || 
          lowerMsg.includes('invalid api key') || 
          lowerMsg.includes('incorrect api key') || 
          lowerMsg.includes('unauthorized') || 
          lowerMsg.includes('authentication failed');

        previousErrorWas429 = is429;

        if (is429) {
          keyObj.rateLimitCount = (keyObj.rateLimitCount || 0) + 1;
          keyObj.status = 'rate_limited';
          keyObj.rateLimitedUntil = Date.now() + 60000;
          keyObj.errorMsg = 'Rate Limit / Quota Exceeded (429)';
          rotationLogs.push(`Key #${keyObj.id} (${this.provider}) hit 429 limit. Rotating immediately...`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else if (isAuthError) {
          keyObj.status = 'invalid';
          keyObj.errorMsg = 'Invalid API Key / Unauthorized';
          rotationLogs.push(`Key #${keyObj.id} (${this.provider}) is invalid.`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else {
          keyObj.errorMsg = errMsg;
          rotationLogs.push(`Key #${keyObj.id} (${this.provider}) transient error: ${errMsg}`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        }
      }
    }

    throw new Error(`ROTATION_EXHAUSTED: Streaming failed after attempting all ${this.keys.length} keys for provider '${this.provider}'.`);
  }
}

/**
 * Universal Multi-Provider Dispatcher with Automatic Fallback
 */
export async function dispatchStreamingGeneration({
  userId = 0,
  requestedModel = 'gemini-3.8-flash',
  messages = [],
  contents = [],
  systemInstruction = '',
  generationConfig = {},
  onChunk
}) {
  const provider = detectProviderFromModel(requestedModel);
  const rotationLogs = [];

  // If DeepSeek, OpenRouter, or Hugging Face is explicitly requested:
  if (provider !== 'gemini') {
    const providerPool = new ProviderKeyPool(userId, provider);
    return await providerPool.executeStreamWithRotation({
      model: requestedModel,
      messages,
      systemInstruction,
      generationConfig,
      onChunk
    });
  }

  // Gemini is requested: execute on Gemini Key Pool
  const geminiPool = await getPoolForUser(userId);
  try {
    const result = await geminiPool.executeStreamWithFallback({
      model: requestedModel,
      contents,
      systemInstruction,
      generationConfig,
      onChunk
    });
    return result;
  } catch (geminiErr) {
    const errMsg = geminiErr.message || '';
    const is503 = errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('High demand');
    const isExhausted = errMsg.includes('ALL_KEYS_EXHAUSTED') || errMsg.includes('ROTATION_EXHAUSTED') || errMsg.includes('NO_API_KEYS');

    if (is503 || isExhausted) {
      console.warn(`[Auto-Fallback] Gemini failed (${errMsg}). Checking for DeepSeek/OpenRouter fallback keys...`);
      
      // Try fallback to DeepSeek pool first
      const deepseekPool = new ProviderKeyPool(userId, 'deepseek');
      await deepseekPool.init();
      if (deepseekPool.keys.length > 0) {
        rotationLogs.push(`Gemini ${is503 ? '503 High Demand' : 'Exhausted'} -> Automatic cross-provider failover to DeepSeek (deepseek-chat)`);
        if (onChunk) {
          onChunk('\n\n*[Thông báo: Đang tự động chuyển sang DeepSeek do hệ thống Gemini quá tải hoặc hết lượt...]*\n\n');
        }
        const fallbackResult = await deepseekPool.executeStreamWithRotation({
          model: 'deepseek-chat',
          messages,
          systemInstruction,
          generationConfig,
          onChunk
        });
        return {
          ...fallbackResult,
          rotationLogs: [...(fallbackResult.rotationLogs || []), ...rotationLogs]
        };
      }

      // Try fallback to OpenRouter pool
      const openRouterPool = new ProviderKeyPool(userId, 'openrouter');
      await openRouterPool.init();
      if (openRouterPool.keys.length > 0) {
        rotationLogs.push(`Gemini ${is503 ? '503 High Demand' : 'Exhausted'} -> Automatic cross-provider failover to OpenRouter`);
        if (onChunk) {
          onChunk('\n\n*[Thông báo: Đang tự động chuyển sang OpenRouter do hệ thống Gemini quá tải...]*\n\n');
        }
        const fallbackResult = await openRouterPool.executeStreamWithRotation({
          model: 'deepseek/deepseek-chat',
          messages,
          systemInstruction,
          generationConfig,
          onChunk
        });
        return {
          ...fallbackResult,
          rotationLogs: [...(fallbackResult.rotationLogs || []), ...rotationLogs]
        };
      }
    }

    // Rethrow original Gemini error if no fallback available
    throw geminiErr;
  }
}

/**
 * Test Single Key for any provider
 */
export async function testProviderKey({ provider = 'gemini', key, baseUrl }) {
  if (!key || !key.trim()) {
    throw new Error('Key cannot be empty');
  }

  const cleanKey = key.trim();

  if (provider === 'gemini') {
    const testPool = new GeminiKeyPool(0);
    return await testPool.testSingleKey(cleanKey);
  }

  const targetBaseUrl = baseUrl || PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS.deepseek;
  const testModel = provider === 'deepseek' ? 'deepseek-chat' : (provider === 'openrouter' ? 'openrouter/auto' : 'deepseek-ai/DeepSeek-R1');

  try {
    const res = await callOpenAICompatibleApi({
      apiKey: cleanKey,
      baseUrl: targetBaseUrl,
      model: testModel,
      messages: [{ role: 'user', content: 'Ping. Respond with single word "PONG".' }],
      maxTokens: 10
    });
    return {
      success: true,
      response: (res.text || 'PONG').trim(),
      model: res.model,
      provider
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      status: err.status || 500,
      provider
    };
  }
}

/**
 * Multi-Provider User Key CRUD
 */
export async function getUserMultiProviderKeys(userId, provider = null) {
  const uid = parseInt(userId, 10) || 0;
  let sql = uid > 0 
    ? `SELECT id, provider, base_url, key_hash, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg FROM user_api_keys WHERE user_id = ?`
    : `SELECT id, provider, base_url, key_hash, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg FROM api_keys_vault WHERE 1=1`;
  const params = uid > 0 ? [uid] : [];

  if (provider && provider !== 'all') {
    sql += ` AND provider = ?`;
    params.push(provider);
  }

  sql += ` ORDER BY id ASC`;
  const [rows] = await pool.query(sql, params);
  const now = Date.now();

  return (rows || []).map(k => {
    let effectiveStatus = k.status;
    if (effectiveStatus === 'rate_limited' && k.rate_limited_until && now > k.rate_limited_until) {
      effectiveStatus = 'active';
    }
    return {
      id: k.id,
      provider: k.provider || 'gemini',
      baseUrl: k.base_url || PROVIDER_ENDPOINTS[k.provider] || null,
      hash: k.key_hash ? k.key_hash.substring(0, 16) + '...' : '',
      masked: k.masked_key,
      status: effectiveStatus,
      callCount: k.call_count || 0,
      requestCount: k.request_count || 0,
      rateLimitCount: k.rate_limit_count || 0,
      lastUsed: k.last_used_at,
      rateLimitedUntil: k.rate_limited_until,
      cooldownSecondsRemaining: k.rate_limited_until && k.rate_limited_until > now ? Math.ceil((k.rate_limited_until - now) / 1000) : 0,
      errorMsg: k.error_msg
    };
  });
}

export async function addUserMultiProviderKey(userId, rawKey, provider = 'deepseek', baseUrl = null) {
  const uid = parseInt(userId, 10) || 0;
  if (!rawKey || !rawKey.trim()) throw new Error('API key cannot be empty.');

  const cleanKey = rawKey.trim();
  const cleanProvider = provider || 'gemini';
  const cleanBaseUrl = baseUrl ? baseUrl.trim() : null;

  const hash = sha256Hash(cleanKey);
  const encrypted = encryptKey(cleanKey);
  const masked = `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`;

  if (uid > 0) {
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM user_api_keys WHERE user_id = ? AND provider = ?', [uid, cleanProvider]);
    if (countRows[0].total >= 10) {
      throw new Error(`Maximum 10 API keys per user for provider '${cleanProvider}'.`);
    }

    await pool.query(
      `INSERT INTO user_api_keys (user_id, provider, base_url, key_hash, encrypted_key, masked_key, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE encrypted_key = VALUES(encrypted_key), masked_key = VALUES(masked_key), base_url = VALUES(base_url), status = 'active'`,
      [uid, cleanProvider, cleanBaseUrl, hash, encrypted, masked]
    );
  } else {
    // Dev account
    await pool.query(
      `INSERT INTO api_keys_vault (provider, base_url, key_hash, encrypted_key, masked_key, status)
       VALUES (?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE encrypted_key = VALUES(encrypted_key), masked_key = VALUES(masked_key), base_url = VALUES(base_url), status = 'active'`,
      [cleanProvider, cleanBaseUrl, hash, encrypted, masked]
    );
  }

  return await getUserMultiProviderKeys(uid, cleanProvider);
}

export async function removeUserMultiProviderKey(userId, keyId) {
  const uid = parseInt(userId, 10) || 0;
  const targetId = parseInt(keyId, 10);

  if (uid > 0) {
    await pool.query('DELETE FROM user_api_keys WHERE id = ? AND user_id = ?', [targetId, uid]);
  } else {
    await pool.query('DELETE FROM api_keys_vault WHERE id = ?', [targetId]);
  }

  return await getUserMultiProviderKeys(uid);
}

export async function resetUserMultiProviderStatuses(userId, provider = null) {
  const uid = parseInt(userId, 10) || 0;
  if (uid > 0) {
    if (provider && provider !== 'all') {
      await pool.query(`UPDATE user_api_keys SET status = 'active', rate_limited_until = NULL, error_msg = NULL WHERE user_id = ? AND provider = ?`, [uid, provider]);
    } else {
      await pool.query(`UPDATE user_api_keys SET status = 'active', rate_limited_until = NULL, error_msg = NULL WHERE user_id = ?`, [uid]);
    }
  } else {
    if (provider && provider !== 'all') {
      await pool.query(`UPDATE api_keys_vault SET status = 'active', rate_limited_until = NULL, error_msg = NULL WHERE provider = ?`, [provider]);
    } else {
      await pool.query(`UPDATE api_keys_vault SET status = 'active', rate_limited_until = NULL, error_msg = NULL`);
    }
  }
  return await getUserMultiProviderKeys(uid, provider);
}
