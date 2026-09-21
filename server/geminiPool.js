import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { pool } from './db.js';

const CRYPTO_SECRET = process.env.CRYPTO_SECRET || 'intp_5w4_neuro_matrix_vault_secret_key_9999';

// SHA-256 Cryptographic Hash
export function sha256Hash(key) {
  if (!key) return '';
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

// AES-256-CBC Key Encryption for Database Storage
export function encryptKey(text, secret = CRYPTO_SECRET) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(secret).digest(); // 32 bytes key
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// AES-256-CBC Key Decryption
export function decryptKey(payload, secret = CRYPTO_SECRET) {
  if (!payload) return '';
  try {
    const parts = payload.split(':');
    if (parts.length !== 2) return payload; // Fallback if plain
    const [ivHex, encrypted] = parts;
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[Crypto] Decryption notice:', err.message);
    return payload;
  }
}

export class GeminiKeyPool {
  constructor(userId = 0) {
    this.userId = userId;
    this.keys = []; // Array of { id, key, hash, masked, status, callCount, requestCount, rateLimitCount, lastUsed, rateLimitedUntil, errorMsg }
    this.currentIndex = -1;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      // 1. Try loading from secure api_keys_vault table
      let [vaultRows] = await pool.query(
        `SELECT id, key_hash, encrypted_key, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg 
         FROM api_keys_vault ORDER BY id ASC`
      );

      let keyList = [];

      if (vaultRows && vaultRows.length > 0) {
        // Vault has keys: Decrypt on-the-fly in memory
        this.keys = vaultRows.map(row => {
          const rawKey = decryptKey(row.encrypted_key);
          return {
            id: row.id,
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
        console.log(`[KeyPool] Loaded ${this.keys.length} API keys from secure SHA-256 api_keys_vault.`);
        return;
      }

      // 2. Migration fallback: If vault is empty, load from legacy system_configs or .env
      const [legacyRows] = await pool.query(`SELECT value FROM system_configs WHERE key_name = 'gemini_api_keys'`);
      if (legacyRows.length > 0 && legacyRows[0].value) {
        try {
          keyList = JSON.parse(legacyRows[0].value);
        } catch {
          keyList = legacyRows[0].value.split(',').map(k => k.trim()).filter(Boolean);
        }
      }

      if (keyList.length === 0 && process.env.GEMINI_API_KEYS) {
        keyList = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
      } else if (keyList.length === 0 && process.env.GEMINI_API_KEY) {
        keyList = [process.env.GEMINI_API_KEY.trim()];
      }

      // Populate vault with SHA-256 hashed and encrypted records
      if (keyList.length > 0) {
        await this.saveKeysToDB(keyList);
      }

      this.initialized = true;
      console.log(`[KeyPool] Initialized with ${this.keys.length} API keys secured with SHA-256.`);
    } catch (err) {
      console.error('[KeyPool] Failed to load keys from DB vault:', err.message);
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
        hash: sha256Hash(cleanKey),
        masked: this.maskKey(cleanKey),
        status: existing ? existing.status : 'active',
        callCount: existing ? existing.callCount : 0,
        requestCount: existing ? existing.requestCount : 0,
        rateLimitCount: existing ? existing.rateLimitCount : 0,
        lastUsed: existing ? existing.lastUsed : null,
        rateLimitedUntil: existing ? existing.rateLimitedUntil : null,
        errorMsg: existing ? existing.errorMsg : ''
      };
    });
    this.currentIndex = -1;
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  async saveKeysToDB(keyList) {
    const cleanList = keyList.map(k => k.trim()).filter(Boolean);

    // Save encrypted & SHA-256 hashed keys into api_keys_vault
    for (const rawKey of cleanList) {
      const hash = sha256Hash(rawKey);
      const encrypted = encryptKey(rawKey);
      const masked = this.maskKey(rawKey);

      await pool.query(
        `INSERT INTO api_keys_vault (key_hash, encrypted_key, masked_key, status) 
         VALUES (?, ?, ?, 'active') 
         ON DUPLICATE KEY UPDATE encrypted_key = VALUES(encrypted_key), masked_key = VALUES(masked_key), status = 'active'`,
        [hash, encrypted, masked]
      );
    }

    // Mirror to system_configs for legacy compatibility
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

  async updateKeyMetrics(keyObj) {
    if (!keyObj || !keyObj.hash) return;
    try {
      if (this.userId && this.userId > 0) {
        await pool.query(
          `UPDATE user_api_keys 
           SET call_count = ?, request_count = ?, rate_limit_count = ?, last_used_at = ?, status = ?, rate_limited_until = ?, error_msg = ?
           WHERE user_id = ? AND key_hash = ?`,
          [
            keyObj.callCount || 0,
            keyObj.requestCount || 0,
            keyObj.rateLimitCount || 0,
            keyObj.lastUsed || null,
            keyObj.status || 'active',
            keyObj.rateLimitedUntil || null,
            keyObj.errorMsg || null,
            this.userId,
            keyObj.hash
          ]
        );
      } else {
        await pool.query(
          `UPDATE api_keys_vault 
           SET call_count = ?, request_count = ?, rate_limit_count = ?, last_used_at = ?, status = ?, rate_limited_until = ?, error_msg = ?
           WHERE key_hash = ?`,
          [
            keyObj.callCount || 0,
            keyObj.requestCount || 0,
            keyObj.rateLimitCount || 0,
            keyObj.lastUsed || null,
            keyObj.status || 'active',
            keyObj.rateLimitedUntil || null,
            keyObj.errorMsg || null,
            keyObj.hash
          ]
        );
      }
    } catch (err) {
      console.warn('[KeyPool] Metric sync notice:', err.message);
    }
  }

  resetStatuses() {
    this.keys.forEach(k => {
      k.status = 'active';
      k.rateLimitedUntil = null;
      k.errorMsg = '';
    });
    // Reset status in DB vault
    if (this.userId && this.userId > 0) {
      pool.query(`UPDATE user_api_keys SET status = 'active', rate_limited_until = NULL, error_msg = NULL WHERE user_id = ?`, [this.userId]).catch(err => {
        console.warn('[UserKeyVault] Failed to reset DB statuses:', err.message);
      });
    } else {
      pool.query(`UPDATE api_keys_vault SET status = 'active', rate_limited_until = NULL, error_msg = NULL`).catch(err => {
        console.warn('[KeyVault] Failed to reset DB statuses:', err.message);
      });
    }
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

  async executeWithFallback({ model, contents, systemInstruction, generationConfig }) {
    await this.init();
    if (this.keys.length === 0) {
      throw new Error('NO_API_KEYS: No Gemini API keys configured in Key Pool. Please add keys in World Config Dashboard.');
    }

    const rotationLogs = [];
    let attempts = 0;
    const maxAttempts = this.keys.length;
    let previousErrorWas429 = false;

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

      // Delay on Key Rotation:
      // If rotating after a previous failure:
      // - 429: Immediate failover without cooldown (0ms delay)
      // - Non-429 (503, 500, network timeout): Enforce mandatory 2000ms delay to prevent 503 errors
      if (attempts > 1) {
        if (previousErrorWas429) {
          rotationLogs.push(`Immediate 429 failover: Switching to Key #${keyObj.id} (${keyObj.masked}) with 0ms cooldown delay.`);
        } else {
          rotationLogs.push(`Key rotation delay: Enforcing 2000ms cooldown before dispatching request with Key #${keyObj.id} (${keyObj.masked}) to prevent 503 errors...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Track request attempt count
      keyObj.requestCount = (keyObj.requestCount || 0) + 1;
      this.updateKeyMetrics(keyObj).catch(() => {});

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
        keyObj.callCount = (keyObj.callCount || 0) + 1;
        keyObj.lastUsed = Date.now();
        keyObj.status = 'active';
        keyObj.errorMsg = '';
        previousErrorWas429 = false;

        this.updateKeyMetrics(keyObj).catch(() => {});

        return {
          ...result,
          keyUsed: { id: keyObj.id, masked: keyObj.masked },
          rotationLogs
        };
      } catch (err) {
        const status = err.status || err.statusCode || 0;
        const errMsg = err.message || 'Unknown API Error';
        console.warn(`[KeyPool] Key #${keyObj.id} failed:`, errMsg);

        const is429 = status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
        previousErrorWas429 = is429;

        if (is429) {
          // Rate-limited: 60s cooldown, increment rate limit counter
          keyObj.rateLimitCount = (keyObj.rateLimitCount || 0) + 1;
          keyObj.status = 'rate_limited';
          keyObj.rateLimitedUntil = Date.now() + 60000;
          keyObj.errorMsg = 'Rate Limit / Quota Exceeded (429)';
          rotationLogs.push(`Key #${keyObj.id} hit 429 Quota Limit. Marked rate-limited (60s cooldown). Immediate failover to next key.`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else if ((status === 400 || status === 403) && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.toLowerCase().includes('api_key_invalid'))) {
          // Invalid API Key
          keyObj.status = 'invalid';
          keyObj.errorMsg = 'Invalid API Key';
          rotationLogs.push(`Key #${keyObj.id} is invalid. Marked inactive. Rotating to next key with 2s cooldown...`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else {
          // General error (503 Service Unavailable, 500, network timeout, etc.)
          keyObj.errorMsg = errMsg;
          rotationLogs.push(`Key #${keyObj.id} error (${errMsg}). Rotating to next key with 2s cooldown...`);
          this.updateKeyMetrics(keyObj).catch(() => {});
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
    let previousErrorWas429 = false;

    while (attempts < maxAttempts) {
      const keyIdx = this.getNextKeyIndex();
      if (keyIdx === -1) {
        const cooldowns = this.keys.map(k => k.rateLimitedUntil ? Math.max(0, Math.ceil((k.rateLimitedUntil - Date.now()) / 1000)) : 0);
        const minWait = Math.min(...cooldowns.filter(c => c > 0)) || 60;
        throw new Error(`ALL_KEYS_EXHAUSTED: All ${this.keys.length} API keys are currently rate-limited or exhausted. Next key cooldown in ~${minWait}s.`);
      }

      const keyObj = this.keys[keyIdx];
      attempts++;

      // Delay on Key Rotation:
      // If rotating after a previous failure:
      // - 429: Immediate failover without cooldown (0ms delay)
      // - Non-429 (503, 500, network timeout): Enforce mandatory 2000ms delay to prevent 503 errors
      if (attempts > 1) {
        if (previousErrorWas429) {
          rotationLogs.push(`Immediate 429 failover: Switching to Key #${keyObj.id} (${keyObj.masked}) with 0ms cooldown delay.`);
        } else {
          rotationLogs.push(`Key rotation delay: Enforcing 2000ms cooldown before dispatching request with Key #${keyObj.id} (${keyObj.masked}) to prevent 503 errors...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Track request attempt count
      keyObj.requestCount = (keyObj.requestCount || 0) + 1;
      this.updateKeyMetrics(keyObj).catch(() => {});

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

        keyObj.callCount = (keyObj.callCount || 0) + 1;
        keyObj.lastUsed = Date.now();
        keyObj.status = 'active';
        keyObj.errorMsg = '';
        previousErrorWas429 = false;

        this.updateKeyMetrics(keyObj, true).catch(() => {});

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

        const is429 = status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
        previousErrorWas429 = is429;

        if (is429) {
          keyObj.rateLimitCount = (keyObj.rateLimitCount || 0) + 1;
          keyObj.status = 'rate_limited';
          keyObj.rateLimitedUntil = Date.now() + 60000;
          keyObj.errorMsg = 'Rate Limit / Quota Exceeded (429)';
          rotationLogs.push(`Key #${keyObj.id} hit 429 Quota Limit. Marked rate-limited (60s cooldown). Immediate failover to next key.`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else if ((status === 400 || status === 403) && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.toLowerCase().includes('api_key_invalid'))) {
          keyObj.status = 'invalid';
          keyObj.errorMsg = 'Invalid API Key';
          rotationLogs.push(`Key #${keyObj.id} is invalid. Rotating to next key with 2s cooldown...`);
          this.updateKeyMetrics(keyObj).catch(() => {});
        } else {
          keyObj.errorMsg = errMsg;
          rotationLogs.push(`Key #${keyObj.id} error (${errMsg}). Rotating to next key with 2s cooldown...`);
          this.updateKeyMetrics(keyObj).catch(() => {});
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

// ==========================================
// Per-User Key Pool (BYOK)
// ==========================================

// In-memory cache: userId -> { pool, lastAccess }
const userPoolCache = new Map();
const POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Factory: Get a GeminiKeyPool for a specific user.
 * userId=0 (dev) → uses global api_keys_vault (legacy).
 * userId>0 → uses user_api_keys table.
 */
export async function getPoolForUser(userId) {
  const uid = parseInt(userId, 10) || 0;
  const now = Date.now();

  // Check cache
  const cached = userPoolCache.get(uid);
  if (cached && (now - cached.lastAccess) < POOL_CACHE_TTL) {
    cached.lastAccess = now;
    return cached.pool;
  }

  // Create fresh pool with uid
  const userPool = new GeminiKeyPool(uid);

  if (uid === 0) {
    // Dev/legacy: load from global api_keys_vault
    await userPool.init();
  } else {
    // Registered user: load from user_api_keys
    try {
      const [rows] = await pool.query(
        `SELECT id, key_hash, encrypted_key, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg 
         FROM user_api_keys WHERE user_id = ? ORDER BY id ASC`,
        [uid]
      );

      if (rows && rows.length > 0) {
        userPool.keys = rows.map(row => {
          const rawKey = decryptKey(row.encrypted_key);
          return {
            id: row.id,
            key: rawKey,
            hash: row.key_hash || sha256Hash(rawKey),
            masked: row.masked_key || userPool.maskKey(rawKey),
            status: row.status || 'active',
            callCount: row.call_count || 0,
            requestCount: row.request_count || 0,
            rateLimitCount: row.rate_limit_count || 0,
            lastUsed: row.last_used_at || null,
            rateLimitedUntil: row.rate_limited_until || null,
            errorMsg: row.error_msg || ''
          };
        });
      }
      userPool.initialized = true;
    } catch (err) {
      console.error(`[KeyPool] Failed to load keys for user ${uid}:`, err.message);
      userPool.initialized = true;
    }
  }

  userPoolCache.set(uid, { pool: userPool, lastAccess: now });
  return userPool;
}

/**
 * Add a single API key for a user.
 * Returns updated key status list.
 */
export async function addUserKey(userId, rawKey) {
  const uid = parseInt(userId, 10);
  if (!uid || uid <= 0) throw new Error('Invalid user ID. Dev account cannot add keys this way.');
  if (!rawKey || !rawKey.trim()) throw new Error('API key cannot be empty.');

  const cleanKey = rawKey.trim();

  // Check max 10 keys per user
  const [countRows] = await pool.query(
    'SELECT COUNT(*) as total FROM user_api_keys WHERE user_id = ?', [uid]
  );
  if (countRows[0].total >= 10) {
    throw new Error('Maximum 10 API keys per user.');
  }

  const hash = sha256Hash(cleanKey);
  const encrypted = encryptKey(cleanKey);
  const masked = `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`;

  await pool.query(
    `INSERT INTO user_api_keys (user_id, key_hash, encrypted_key, masked_key, status)
     VALUES (?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE encrypted_key = VALUES(encrypted_key), masked_key = VALUES(masked_key), status = 'active'`,
    [uid, hash, encrypted, masked]
  );

  // Invalidate cache
  userPoolCache.delete(uid);

  return getUserKeyStatus(uid);
}

/**
 * Remove a specific API key for a user.
 */
export async function removeUserKey(userId, keyId) {
  const uid = parseInt(userId, 10);
  if (!uid || uid <= 0) throw new Error('Invalid user ID.');

  await pool.query(
    'DELETE FROM user_api_keys WHERE id = ? AND user_id = ?',
    [keyId, uid]
  );

  // Invalidate cache
  userPoolCache.delete(uid);

  return getUserKeyStatus(uid);
}

/**
 * Get masked key status list for a user.
 */
export async function getUserKeyStatus(userId) {
  const uid = parseInt(userId, 10) || 0;
  const now = Date.now();

  if (uid === 0) {
    // Dev: use global pool
    const globalPool = await getPoolForUser(0);
    return globalPool.getStatus();
  }

  const [rows] = await pool.query(
    `SELECT id, key_hash, masked_key, status, call_count, request_count, rate_limit_count, last_used_at, rate_limited_until, error_msg
     FROM user_api_keys WHERE user_id = ? ORDER BY id ASC`,
    [uid]
  );

  return rows.map(k => {
    let effectiveStatus = k.status;
    if (effectiveStatus === 'rate_limited' && k.rate_limited_until && now > k.rate_limited_until) {
      effectiveStatus = 'active';
    }
    return {
      id: k.id,
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

/**
 * Reset all key statuses for a user.
 */
export async function resetUserKeys(userId) {
  const uid = parseInt(userId, 10) || 0;

  if (uid === 0) {
    const globalPool = await getPoolForUser(0);
    return globalPool.resetStatuses();
  }

  await pool.query(
    `UPDATE user_api_keys SET status = 'active', rate_limited_until = NULL, error_msg = NULL WHERE user_id = ?`,
    [uid]
  );

  // Invalidate cache
  userPoolCache.delete(uid);

  return getUserKeyStatus(uid);
}

export const keyPool = new GeminiKeyPool();
