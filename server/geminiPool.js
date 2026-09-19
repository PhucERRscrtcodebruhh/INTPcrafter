import { GoogleGenAI } from '@google/genai';
import { pool } from './db.js';

class GeminiKeyPool {
  constructor() {
    this.keys = []; // Array of { key: string, status: 'active'|'rate_limited'|'invalid', callCount: number, lastUsed: number|null, rateLimitedUntil: number|null, errorMsg: string }
    this.currentIndex = 0;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      const [rows] = await pool.query(`SELECT value FROM system_configs WHERE key_name = 'gemini_api_keys'`);
      let keyList = [];
      if (rows.length > 0 && rows[0].value) {
        try {
          keyList = JSON.parse(rows[0].value);
        } catch {
          keyList = rows[0].value.split(',').map(k => k.trim()).filter(Boolean);
        }
      }

      // Check env fallback
      if (keyList.length === 0 && process.env.GEMINI_API_KEYS) {
        keyList = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
      } else if (keyList.length === 0 && process.env.GEMINI_API_KEY) {
        keyList = [process.env.GEMINI_API_KEY.trim()];
      }

      this.setKeys(keyList);
      this.initialized = true;
      console.log(`[KeyPool] Initialized with ${this.keys.length} API keys using @google/genai SDK.`);
    } catch (err) {
      console.error('[KeyPool] Failed to load keys from DB:', err.message);
    }
  }

  setKeys(keyList) {
    const existingMap = new Map(this.keys.map(k => [k.key, k]));
    this.keys = keyList.map((key, index) => {
      const cleanKey = key.trim();
      const existing = existingMap.get(cleanKey);
      return {
        id: index + 1,
        key: cleanKey,
        masked: this.maskKey(cleanKey),
        status: existing ? existing.status : 'active',
        callCount: existing ? existing.callCount : 0,
        lastUsed: existing ? existing.lastUsed : null,
        rateLimitedUntil: existing ? existing.rateLimitedUntil : null,
        errorMsg: existing ? existing.errorMsg : ''
      };
    });
    this.currentIndex = 0;
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  async saveKeysToDB(keyList) {
    const cleanList = keyList.map(k => k.trim()).filter(Boolean);
    await pool.query(
      `INSERT INTO system_configs (key_name, value) VALUES ('gemini_api_keys', ?) 
       ON DUPLICATE KEY UPDATE value = ?`,
      [JSON.stringify(cleanList), JSON.stringify(cleanList)]
    );
    this.setKeys(cleanList);
    return this.getStatus();
  }

  getStatus() {
    const now = Date.now();
    return this.keys.map(k => {
      // Auto-recover from rate-limit if cooldown expired
      let effectiveStatus = k.status;
      if (effectiveStatus === 'rate_limited' && k.rateLimitedUntil && now > k.rateLimitedUntil) {
        effectiveStatus = 'active';
        k.status = 'active';
        k.rateLimitedUntil = null;
        k.errorMsg = '';
      }
      return {
        id: k.id,
        masked: k.masked,
        status: effectiveStatus,
        callCount: k.callCount,
        lastUsed: k.lastUsed,
        rateLimitedUntil: k.rateLimitedUntil,
        cooldownSecondsRemaining: k.rateLimitedUntil && k.rateLimitedUntil > now ? Math.ceil((k.rateLimitedUntil - now) / 1000) : 0,
        errorMsg: k.errorMsg
      };
    });
  }

  resetStatuses() {
    this.keys.forEach(k => {
      k.status = 'active';
      k.rateLimitedUntil = null;
      k.errorMsg = '';
    });
    return this.getStatus();
  }

  getNextKeyIndex() {
    if (this.keys.length === 0) return -1;
    const now = Date.now();
    
    // Check for auto-recovery
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

    // Round-robin selection
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    let attempts = 0;
    while (attempts < this.keys.length) {
      const idx = (this.currentIndex + attempts) % this.keys.length;
      if (this.keys[idx].status === 'active') {
        this.currentIndex = idx;
        return idx;
      }
      attempts++;
    }

    return activeIndices[0];
  }

  async executeWithFallback({ model, contents, systemInstruction, generationConfig }) {
    await this.init();
    if (this.keys.length === 0) {
      throw new Error('NO_API_KEYS: No Gemini API keys configured in Key Pool. Please add keys in World Config Dashboard.');
    }

    const rotationLogs = [];
    let attempts = 0;
    const maxAttempts = this.keys.length;

    while (attempts < maxAttempts) {
      const keyIdx = this.getNextKeyIndex();
      if (keyIdx === -1) {
        // All keys are currently rate-limited or invalid
        const cooldowns = this.keys.map(k => k.rateLimitedUntil ? Math.max(0, Math.ceil((k.rateLimitedUntil - Date.now()) / 1000)) : 0);
        const minWait = Math.min(...cooldowns.filter(c => c > 0)) || 60;
        throw new Error(`ALL_KEYS_EXHAUSTED: All ${this.keys.length} API keys are currently rate-limited or exhausted. Next key cooldown in ~${minWait}s.`);
      }

      const keyObj = this.keys[keyIdx];
      attempts++;

      try {
        rotationLogs.push(`Attempt ${attempts}: Dispatching request to Key #${keyObj.id} (${keyObj.masked}) via @google/genai SDK`);
        const result = await this.callGeminiApi({
          apiKey: keyObj.key,
          model,
          contents,
          systemInstruction,
          generationConfig
        });

        // Mark success
        keyObj.callCount++;
        keyObj.lastUsed = Date.now();
        keyObj.status = 'active';
        keyObj.errorMsg = '';

        return {
          ...result,
          keyUsed: { id: keyObj.id, masked: keyObj.masked },
          rotationLogs
        };
      } catch (err) {
        const status = err.status || err.statusCode || 0;
        const errMsg = err.message || 'Unknown API Error';
        console.warn(`[KeyPool] Key #${keyObj.id} failed:`, errMsg);

        if (status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          // Rate-limited: 60s cooldown
          keyObj.status = 'rate_limited';
          keyObj.rateLimitedUntil = Date.now() + 60000;
          keyObj.errorMsg = 'Rate Limit / Quota Exceeded (429)';
          rotationLogs.push(`Key #${keyObj.id} hit 429 Quota Limit. Marked rate-limited (60s cooldown). Falling back to next key...`);
        } else if (status === 400 && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid') || errMsg.includes('API key not valid'))) {
          // Invalid API Key
          keyObj.status = 'invalid';
          keyObj.errorMsg = 'Invalid API Key';
          rotationLogs.push(`Key #${keyObj.id} is invalid. Marked inactive. Falling back to next key...`);
        } else {
          // General error - still try next key
          rotationLogs.push(`Key #${keyObj.id} error (${errMsg}). Falling back to next key...`);
        }
      }
    }

    throw new Error(`ROTATION_EXHAUSTED: Failed after attempting all ${this.keys.length} available keys in pool.`);
  }

  async executeStreamWithFallback({ model, contents, systemInstruction, generationConfig, onChunk }) {
    await this.init();
    if (this.keys.length === 0) {
      throw new Error('NO_API_KEYS: No Gemini API keys configured in Key Pool. Please add keys in World Config Dashboard.');
    }

    const rotationLogs = [];
    let attempts = 0;
    const maxAttempts = this.keys.length;

    while (attempts < maxAttempts) {
      const keyIdx = this.getNextKeyIndex();
      if (keyIdx === -1) {
        const cooldowns = this.keys.map(k => k.rateLimitedUntil ? Math.max(0, Math.ceil((k.rateLimitedUntil - Date.now()) / 1000)) : 0);
        const minWait = Math.min(...cooldowns.filter(c => c > 0)) || 60;
        throw new Error(`ALL_KEYS_EXHAUSTED: All ${this.keys.length} API keys are currently rate-limited or exhausted. Next key cooldown in ~${minWait}s.`);
      }

      const keyObj = this.keys[keyIdx];
      attempts++;

      try {
        rotationLogs.push(`Attempt ${attempts}: Streaming request via Key #${keyObj.id} (${keyObj.masked})`);
        
        let targetModel = model || 'gemini-3.8-flash';
        if (targetModel.startsWith('models/')) {
          targetModel = targetModel.replace('models/', '');
        }

        const ai = new GoogleGenAI({ apiKey: keyObj.key });
        const config = {
          temperature: generationConfig?.temperature ?? 0.7,
          topP: generationConfig?.topP ?? 0.95,
          maxOutputTokens: generationConfig?.maxOutputTokens ?? 4096,
        };
        if (systemInstruction) {
          config.systemInstruction = systemInstruction;
        }

        const responseStream = await ai.models.generateContentStream({
          model: targetModel,
          contents,
          config
        });

        let fullText = '';
        let finishReason = 'STOP';
        let usageMetadata = null;

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || '';
          if (chunkText) {
            fullText += chunkText;
            if (onChunk) {
              onChunk(chunkText);
            }
          }
          if (chunk.candidates?.[0]?.finishReason) {
            finishReason = chunk.candidates[0].finishReason;
          }
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata;
          }
        }

        keyObj.callCount++;
        keyObj.lastUsed = Date.now();
        keyObj.status = 'active';
        keyObj.errorMsg = '';

        return {
          text: fullText,
          finishReason,
          usageMetadata,
          model: targetModel,
          keyUsed: { id: keyObj.id, masked: keyObj.masked },
          rotationLogs
        };
      } catch (err) {
        const status = err.status || err.statusCode || 0;
        const errMsg = err.message || 'Unknown API Error';
        console.warn(`[KeyPool Stream] Key #${keyObj.id} failed:`, errMsg);

        if (status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          keyObj.status = 'rate_limited';
          keyObj.rateLimitedUntil = Date.now() + 60000;
          keyObj.errorMsg = 'Rate Limit / Quota Exceeded (429)';
          rotationLogs.push(`Key #${keyObj.id} hit 429 Quota Limit. Falling back to next key...`);
        } else if (status === 400 && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid') || errMsg.includes('API key not valid'))) {
          keyObj.status = 'invalid';
          keyObj.errorMsg = 'Invalid API Key';
          rotationLogs.push(`Key #${keyObj.id} is invalid. Falling back to next key...`);
        } else {
          rotationLogs.push(`Key #${keyObj.id} error (${errMsg}). Falling back to next key...`);
        }
      }
    }

    throw new Error(`ROTATION_EXHAUSTED: Streaming failed after trying all ${this.keys.length} keys in pool.`);
  }

  async callGeminiApi({ apiKey, model, contents, systemInstruction, generationConfig }) {
    // Normalise model identifier
    let targetModel = model || 'gemini-3.8-flash';
    if (targetModel.startsWith('models/')) {
      targetModel = targetModel.replace('models/', '');
    }

    const ai = new GoogleGenAI({ apiKey });

    const config = {
      temperature: generationConfig?.temperature ?? 0.7,
      topP: generationConfig?.topP ?? 0.95,
      maxOutputTokens: generationConfig?.maxOutputTokens ?? 4096,
    };

    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config
    });

    const text = response.text || '';
    const finishReason = response.candidates?.[0]?.finishReason || 'STOP';
    const usageMetadata = response.usageMetadata || null;

    return {
      text,
      finishReason,
      usageMetadata,
      model: targetModel
    };
  }

  async testSingleKey(key) {
    if (!key) throw new Error('Key cannot be empty');
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: 'Ping. Respond with single word "PONG".',
        config: { maxOutputTokens: 10 }
      });
      return { success: true, response: (response.text || 'PONG').trim(), model: 'gemini-3.5-flash-lite' };
    } catch (err) {
      return { success: false, error: err.message, status: err.status || 500 };
    }
  }
}

export const keyPool = new GeminiKeyPool();
