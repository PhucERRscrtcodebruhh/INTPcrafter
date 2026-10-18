import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { keyPool } from './geminiPool.js';
import {
  dispatchStreamingGeneration,
  testProviderKey,
  getUserMultiProviderKeys,
  addUserMultiProviderKey,
  removeUserMultiProviderKey,
  resetUserMultiProviderStatuses,
  detectProviderFromModel
} from './llmProviders.js';
import { RAGEngine, parseAliases } from './ragEngine.js';
import {
  getModelContextLimit,
  estimateTokens,
  calculateContextTokens,
  applyRollingContext
} from './tokenUtils.js';
import { authRouter, requireAuth } from './auth.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * Aliases are canonicalised to CSV before they ever reach MySQL, so a JSON-array
 * payload can never silently break alias matching inside the RAG engine.
 */
const normalizeAliasesCsv = (raw) => parseAliases(raw).join(', ');

/**
 * mysql2 auto-parses JSON columns on read, so a value coming back from the DB can be
 * either an object or a string. Always hand MySQL a valid JSON *string*.
 */
const toJsonString = (value) => {
  if (value === null || value === undefined || value === '') return '{}';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

// Mount Auth Router
app.use('/api/auth', authRouter);

// Health Check (public)
app.get('/api/health', async (req, res) => {
  try {
    const [dbResult] = await pool.query('SELECT 1 as connected');
    const keyStatus = keyPool.getStatus();
    res.json({
      status: 'online',
      dbConnected: dbResult?.[0]?.connected === 1,
      keysConfigured: keyStatus.length,
      activeKeys: keyStatus.filter(k => k.status === 'active').length,
      engine: 'StoryContainer INTP Engine v2.0 (BYOK)'
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

// ==========================================
// CHAT SESSIONS & MESSAGES (user-scoped)
// ==========================================

app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Strictly the caller's own chronicles. Correlated subqueries keep the read on
    // the (session_id, id) / user indexes instead of aggregating every user's
    // messages, and avoid a non-deterministic GROUP BY under ONLY_FULL_GROUP_BY.
    const [sessions] = await pool.query(
      `SELECT s.id, s.title, s.user_id, s.book_id,
              COALESCE(s.rolling_threshold, 32768) as rolling_threshold,
              b.title as book_title, s.created_at,
              (SELECT COUNT(*) FROM chat_messages m
                WHERE m.session_id = s.id AND m.user_id = s.user_id) as message_count,
              (SELECT MAX(m.created_at) FROM chat_messages m
                WHERE m.session_id = s.id AND m.user_id = s.user_id) as last_message_at
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id AND b.user_id = s.user_id
       WHERE s.user_id = ?
       ORDER BY COALESCE(
         (SELECT MAX(m2.created_at) FROM chat_messages m2
           WHERE m2.session_id = s.id AND m2.user_id = s.user_id),
         s.created_at
       ) DESC`,
      [userId]
    );

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = (req.body.title || 'Untitled Chronicle').trim();
    const bookId = req.body.book_id ? parseInt(req.body.book_id, 10) : null;
    const rollingThreshold = req.body.rolling_threshold !== undefined
      ? parseInt(req.body.rolling_threshold, 10)
      : (req.body.rollingThreshold !== undefined ? parseInt(req.body.rollingThreshold, 10) : 32768);

    // A session may only be linked to a book the caller owns.
    if (bookId) {
      const [owned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [bookId, userId]);
      if (owned.length === 0) {
        return res.status(404).json({ error: 'Lore book not found for this account.' });
      }
    }

    await pool.query(
      `INSERT INTO chat_sessions (id, title, user_id, book_id, rolling_threshold) VALUES (?, ?, ?, ?, ?)`,
      [id, title, userId, bookId, rollingThreshold || 32768]
    );
    res.status(201).json({ id, title, user_id: userId, book_id: bookId, rolling_threshold: rollingThreshold || 32768, created_at: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, book_id, rolling_threshold, rollingThreshold } = req.body;
    const sessionId = req.params.id;

    const [owned] = await pool.query(`SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1`, [sessionId, userId]);
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }

    // Build update query dynamically
    const fields = [];
    const values = [];

    if (title !== undefined && title.trim()) {
      fields.push('title = ?');
      values.push(title.trim());
    }
    if (book_id !== undefined) {
      const nextBookId = book_id ? parseInt(book_id, 10) : null;
      if (nextBookId) {
        const [bookOwned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [nextBookId, userId]);
        if (bookOwned.length === 0) {
          return res.status(404).json({ error: 'Lore book not found for this account.' });
        }
      }
      fields.push('book_id = ?');
      values.push(nextBookId);
    }
    const targetThreshold = rolling_threshold !== undefined ? rolling_threshold : rollingThreshold;
    if (targetThreshold !== undefined) {
      fields.push('rolling_threshold = ?');
      values.push(parseInt(targetThreshold, 10) || 32768);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(sessionId, userId);
    await pool.query(`UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);

    // Fetch updated session
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.user_id, s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, s.created_at
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id AND b.user_id = s.user_id
       WHERE s.id = ? AND s.user_id = ?`,
      [sessionId, userId]
    );

    res.json({ success: true, session: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;
    const [result] = await pool.query(`DELETE FROM chat_sessions WHERE id = ? AND user_id = ?`, [sessionId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }
    res.json({ success: true, deletedId: sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;

    const [owned] = await pool.query(`SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1`, [sessionId, userId]);
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }

    const [messages] = await pool.query(
      `SELECT id, session_id, role, content, retrieved_lore_ids, created_at
       FROM chat_messages
       WHERE session_id = ? AND user_id = ?
       ORDER BY id ASC`,
      [sessionId, userId]
    );

    // Fetch details of retrieved lore for each message if present (scoped to the owner)
    const loreIdSet = new Set();
    messages.forEach(m => {
      if (m.retrieved_lore_ids) {
        m.retrieved_lore_ids.split(',').forEach(id => {
          const num = parseInt(id.trim(), 10);
          if (!isNaN(num)) loreIdSet.add(num);
        });
      }
    });

    let loreMap = {};
    if (loreIdSet.size > 0) {
      const placeholders = Array.from(loreIdSet).map(() => '?').join(',');
      const [loreRows] = await pool.query(
        `SELECT id, category, title, aliases, rules, content FROM lore_entries WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...Array.from(loreIdSet)]
      );
      loreRows.forEach(l => { loreMap[l.id] = l; });
    }

    const populatedMessages = messages.map(m => {
      const attachedLore = [];
      if (m.retrieved_lore_ids) {
        m.retrieved_lore_ids.split(',').forEach(id => {
          const num = parseInt(id.trim(), 10);
          if (loreMap[num]) attachedLore.push(loreMap[num]);
        });
      }
      return {
        ...m,
        retrievedLore: attachedLore
      };
    });

    res.json(populatedMessages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed the onboarding guide + first prompt for a brand-new chronicle.
// Idempotent: if the session already has messages, nothing is inserted.
app.post('/api/chat/first-session-seed', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, userMessage, guideMessage } = req.body || {};
    const cleanUserMessage = String(userMessage || '').trim();
    const cleanGuideMessage = String(guideMessage || '').trim();

    if (!sessionId || !cleanUserMessage) {
      return res.status(400).json({ error: 'sessionId and userMessage are required.' });
    }

    const [owned] = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
      [sessionId, userId]
    );
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }

    const [existing] = await pool.query(
      `SELECT id FROM chat_messages WHERE session_id = ? AND user_id = ? LIMIT 1`,
      [sessionId, userId]
    );
    if (existing.length > 0) {
      return res.json({ success: true, seeded: false });
    }

    const connection = await pool.getConnection();
    let insertedIds = [];
    try {
      await connection.beginTransaction();

      const [userInsert] = await connection.query(
        `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids)
         VALUES (?, ?, 'user', ?, '')`,
        [sessionId, userId, cleanUserMessage]
      );
      insertedIds.push(userInsert.insertId);

      if (cleanGuideMessage) {
        const [guideInsert] = await connection.query(
          `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids)
           VALUES (?, ?, 'model', ?, '')`,
          [sessionId, userId, cleanGuideMessage]
        );
        insertedIds.push(guideInsert.insertId);
      }

      await connection.commit();
    } catch (seedErr) {
      await connection.rollback().catch(() => {});
      throw seedErr;
    } finally {
      connection.release();
    }

    res.status(201).json({ success: true, seeded: true, ids: insertedIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update specific message content (edit prompt or story text)
app.put('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const [result] = await pool.query(`UPDATE chat_messages SET content = ? WHERE id = ? AND user_id = ?`, [content, messageId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found for this account.' });
    }
    res.json({ success: true, id: messageId, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete specific message
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;
    const [result] = await pool.query(`DELETE FROM chat_messages WHERE id = ? AND user_id = ?`, [messageId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found for this account.' });
    }
    res.json({ success: true, deletedId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Truncate session messages from a specific point onward (for edit & regenerate flow)
app.delete('/api/sessions/:sessionId/messages/from/:messageId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, messageId } = req.params;

    const [owned] = await pool.query(`SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1`, [sessionId, userId]);
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }

    await pool.query(`DELETE FROM chat_messages WHERE session_id = ? AND user_id = ? AND id >= ?`, [sessionId, userId, messageId]);
    res.json({ success: true, sessionId, fromMessageId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STRICT THREE-TIER LLM PREFIX CACHING ARCHITECTURE
// Tier 0 (Global Core - Completely Static across ALL requests)
// Tier 1 (World Core Rules - Static/Append-Only per World Container)
// Tier 2 (Dynamic RAG & User Input - Attached ONLY to terminal user message)
// ==========================================

export const TIER_0_GLOBAL_CORE = `You are a deterministic world simulator and master novel engine operating under strict causal consistency.
Role & Persona:
- Maintain uncompromising continuity, logical causality, and immersive psychological depth.
- Adhere strictly to established physical laws, magic/cultivation realm hierarchies, and world rules without arbitrary retcons.
- Write vivid, evocative, sensory-rich prose with natural pacing and authentic character voice.

Constraints & Formatting:
- When reasoning through invariants, logical constraints, or plot consequences, encapsulate cognitive trace inside <think>...</think> blocks.
- Ground all narrative assertions in the established world lore, active constraints, and prior chronicle events.
- Never violate established resource costs, physical limitations, or world invariants.`;

export function buildStableRequestEnvelope({
  historyMessages = [],
  tier0GlobalCore = TIER_0_GLOBAL_CORE,
  tier1WorldCore = '[WORLD CORE RULES - Default Invariants]\nMaintain logical causality, physical laws, and continuity across chronicle events.',
  tier2UserPrompt = ''
}) {
  const systemInstruction = `${tier0GlobalCore}\n\n${tier1WorldCore}`;

  const normalizedHistory = (Array.isArray(historyMessages) ? historyMessages : [])
    .filter(msg => msg && typeof msg === 'object' && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'model'))
    .map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : ''
    }));

  const messages = [...normalizedHistory, { role: 'user', content: tier2UserPrompt }];

  return {
    systemInstruction,
    messages
  };
}

app.post('/api/chat', requireAuth, async (req, res) => {
  const {
    sessionId,
    prompt,
    model = 'gemini-3.8-flash',
    temperature = 0.7,
    topP = 0.95,
    maxOutputTokens = 4096,
    contextRollingThreshold = 32768,
    singleKeyMode = false,

  } = req.body;

  if (!sessionId || !prompt?.trim()) {
    return res.status(400).json({ error: 'sessionId and prompt are required' });
  }

  const cleanPrompt = prompt.trim();
  const userId = req.user.id;
  let insertedUserMessageId = null;

  try {
    // Ownership first: no key, quota or lore work for sessions that are not ours.
    const [sessRows] = await pool.query(
      `SELECT s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, b.system_instruction as book_instruction
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id AND b.user_id = s.user_id
       WHERE s.id = ? AND s.user_id = ?`,
      [sessionId, userId]
    );
    const sessionBook = sessRows[0] || null;
    if (!sessionBook) {
      return res.status(404).json({ error: 'Session not found for this account.' });
    }
    const bookId = sessionBook.book_id || null;

    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY id ASC`,
      [sessionId, userId]
    );

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6,
      bookId,
      userId
    });

    const tier0GlobalCore = TIER_0_GLOBAL_CORE;
    const tier1WorldCore = sessionBook?.book_instruction?.trim()
      ? `[WORLD CORE RULES - ${sessionBook.book_title || 'Active Chronicle'}]\n${sessionBook.book_instruction.trim()}`
      : `[WORLD CORE RULES - Default Invariants]\nMaintain logical causality, physical laws, and continuity across chronicle events.`;

    const modelLimit = getModelContextLimit(model);
    const sessionThreshold = req.body.contextRollingThreshold !== undefined
      ? parseInt(req.body.contextRollingThreshold, 10)
      : (sessionBook?.rolling_threshold || 32768);
    const effectiveThreshold = Math.min(sessionThreshold, modelLimit - maxOutputTokens - 500);

    const tier2UserPrompt = RAGEngine.formatTier2Prompt(cleanPrompt, retrievedLore);

    // Anchored rolling window: the cut point only moves in one large batch, so the
    // prompt prefix (and therefore provider-side prefix cache hits) survives between
    // ordinary turns. The real Tier-2 payload is included in the token budget.
    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(
      historyRows,
      `${tier0GlobalCore}\n\n${tier1WorldCore}`,
      tier2UserPrompt,
      effectiveThreshold,
      { sessionKey: `${userId}:${sessionId}` }
    );
    const { systemInstruction: fullStaticSystemInstruction, messages } = buildStableRequestEnvelope({
      historyMessages: prunedMessages,
      tier0GlobalCore,
      tier1WorldCore,
      tier2UserPrompt
    });

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: tier2UserPrompt }]
    });

    const [userInsert] = await pool.query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids) VALUES (?, ?, 'user', ?, ?)`,
      [sessionId, userId, cleanPrompt, retrievedLoreIds]
    );
    insertedUserMessageId = userInsert.insertId;

    const result = await dispatchStreamingGeneration({
      userId,
      singleKeyMode: Boolean(singleKeyMode),
      requestedModel: model,
      messages,
      contents,
      systemInstruction: fullStaticSystemInstruction,
      generationConfig: {
        temperature: parseFloat(temperature),
        topP: parseFloat(topP),
        maxOutputTokens: parseInt(maxOutputTokens, 10),
      }
    });

    const replyText = result.text;

    await pool.query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids) VALUES (?, ?, 'model', ?, ?)`,
      [sessionId, userId, replyText, retrievedLoreIds]
    );

    const promptTokens = result.usageMetadata?.promptTokenCount || (totalTokens + estimateTokens(cleanPrompt));
    const outputTokens = result.usageMetadata?.candidatesTokenCount || estimateTokens(replyText);
    const totalContextTokens = promptTokens + outputTokens;
    const contextPercent = Math.min(100, (totalContextTokens / modelLimit) * 100).toFixed(2);

    res.json({
      reply: replyText,
      retrievedLore,
      retrievedLoreIds,
      tokenStats: {
        promptTokens,
        outputTokens,
        totalContextTokens,
        modelContextLimit: modelLimit,
        contextUsagePercent: contextPercent,
        isRolled,
        rollingThreshold: effectiveThreshold,
        historyStats: {
          originalMessages: originalCount,
          keptMessages: keptCount
        }
      },
      keyUsed: result.keyUsed,
      rotationLogs: result.rotationLogs,
      finishReason: result.finishReason
    });
  } catch (err) {
    console.error('[Chat API Error]:', err);
    const isKeyError = /NO_API_KEYS|NO_ACTIVE_KEY|ALL_KEYS_EXHAUSTED/.test(err.message || '');
    // The model never produced a reply: drop the optimistic user row so a retry
    // does not leave a duplicate turn behind.
    if (insertedUserMessageId) {
      await pool.query(
        `DELETE FROM chat_messages WHERE id = ? AND user_id = ? AND role = 'user'`,
        [insertedUserMessageId, userId]
      ).catch(() => {});
    }
    res.status(isKeyError ? 400 : 500).json({
      error: err.message,
      details: err.details || null
    });
  }
});

// SSE Streaming Generation Endpoint (Multi-Provider BYOK per-user)
app.post('/api/chat/stream', requireAuth, async (req, res) => {
  const {
    sessionId,
    prompt,
    model = 'gemini-3.8-flash',
    temperature = 0.7,
    topP = 0.95,
    maxOutputTokens = 4096,
    contextRollingThreshold = 32768,
    singleKeyMode = false,

  } = req.body;

  if (!sessionId || !prompt?.trim()) {
    return res.status(400).json({ error: 'sessionId and prompt are required' });
  }

  const cleanPrompt = prompt.trim();
  const userId = req.user.id;

  // Ownership gate before any stream headers are flushed.
  const [ownershipRows] = await pool.query(
    `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [sessionId, userId]
  );
  if (ownershipRows.length === 0) {
    return res.status(404).json({ error: 'Session not found for this account.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let hasStreamStarted = false;
  let insertedUserMessageId = null;
  let accumulatedReplyText = '';
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  const cleanupKeepAlive = () => {
    clearInterval(keepAliveInterval);
  };

  req.on('close', cleanupKeepAlive);
  req.on('error', cleanupKeepAlive);

  try {
    const [sessRows] = await pool.query(
      `SELECT s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, b.system_instruction as book_instruction
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id AND b.user_id = s.user_id
       WHERE s.id = ? AND s.user_id = ?`,
      [sessionId, userId]
    );
    const sessionBook = sessRows[0] || null;
    if (!sessionBook) {
      throw Object.assign(new Error('Session not found for this account.'), { status: 404 });
    }
    const bookId = sessionBook.book_id || null;

    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY id ASC`,
      [sessionId, userId]
    );

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6,
      bookId,
      userId
    });

    const tier0GlobalCore = TIER_0_GLOBAL_CORE;
    const tier1WorldCore = sessionBook?.book_instruction?.trim()
      ? `[WORLD CORE RULES - ${sessionBook.book_title || 'Active Chronicle'}]\n${sessionBook.book_instruction.trim()}`
      : `[WORLD CORE RULES - Default Invariants]\nMaintain logical causality, physical laws, and continuity across chronicle events.`;

    const modelLimit = getModelContextLimit(model);
    const sessionThreshold = req.body.contextRollingThreshold !== undefined
      ? parseInt(req.body.contextRollingThreshold, 10)
      : (sessionBook?.rolling_threshold || 32768);
    const effectiveThreshold = Math.min(sessionThreshold, modelLimit - maxOutputTokens - 500);

    const tier2UserPrompt = RAGEngine.formatTier2Prompt(cleanPrompt, retrievedLore);

    // Anchored rolling window: the cut point only moves in one large batch, so the
    // prompt prefix (and therefore provider-side prefix cache hits) survives between
    // ordinary turns. The real Tier-2 payload is included in the token budget.
    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(
      historyRows,
      `${tier0GlobalCore}\n\n${tier1WorldCore}`,
      tier2UserPrompt,
      effectiveThreshold,
      { sessionKey: `${userId}:${sessionId}` }
    );
    const { systemInstruction: fullStaticSystemInstruction, messages } = buildStableRequestEnvelope({
      historyMessages: prunedMessages,
      tier0GlobalCore,
      tier1WorldCore,
      tier2UserPrompt
    });

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: tier2UserPrompt }]
    });

    const [userInsert] = await pool.query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids) VALUES (?, ?, 'user', ?, ?)`,
      [sessionId, userId, cleanPrompt, retrievedLoreIds]
    );
    insertedUserMessageId = userInsert.insertId;

    res.write(`event: rag\ndata: ${JSON.stringify({ retrievedLore, retrievedLoreIds })}\n\n`);

    const result = await dispatchStreamingGeneration({
      userId,
      singleKeyMode: Boolean(singleKeyMode),
      requestedModel: model,
      messages,
      contents,
      systemInstruction: fullStaticSystemInstruction,
      generationConfig: {
        temperature: parseFloat(temperature),
        topP: parseFloat(topP),
        maxOutputTokens: parseInt(maxOutputTokens, 10),
      },
      onChunk: (chunkText) => {
        hasStreamStarted = true;
        accumulatedReplyText += chunkText;
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    });

    cleanupKeepAlive();

    const replyText = result.text;

    await pool.query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids) VALUES (?, ?, 'model', ?, ?)`,
      [sessionId, userId, replyText, retrievedLoreIds]
    );

    const promptTokens = result.usageMetadata?.promptTokenCount || (totalTokens + estimateTokens(cleanPrompt));
    const outputTokens = result.usageMetadata?.candidatesTokenCount || estimateTokens(replyText);
    const totalContextTokens = promptTokens + outputTokens;
    const contextPercent = Math.min(100, (totalContextTokens / modelLimit) * 100).toFixed(2);

    res.write(`event: done\ndata: ${JSON.stringify({
      fullReply: replyText,
      retrievedLore,
      retrievedLoreIds,
      tokenStats: {
        promptTokens,
        outputTokens,
        totalContextTokens,
        modelContextLimit: modelLimit,
        contextUsagePercent: contextPercent,
        isRolled,
        rollingThreshold: effectiveThreshold,
        historyStats: {
          originalMessages: originalCount,
          keptMessages: keptCount
        }
      },
      keyUsed: result.keyUsed,
      rotationLogs: result.rotationLogs,
      finishReason: result.finishReason
    })}\n\n`);

    res.end();
  } catch (err) {
    cleanupKeepAlive();
    console.error('[Stream API Error]:', err);
    // Roll back the user turn only when nothing was streamed yet; a mid-stream
    // failure keeps the prompt so the user can inspect/regenerate the turn.
    if (!hasStreamStarted && !err.hasStreamStarted && insertedUserMessageId) {
      await pool.query(
        `DELETE FROM chat_messages WHERE id = ? AND user_id = ? AND role = 'user'`,
        [insertedUserMessageId, userId]
      ).catch(() => {});
    }

    const partialToSave = accumulatedReplyText || err.partialText || '';
    if ((hasStreamStarted || err.hasStreamStarted) && partialToSave.trim()) {
      try {
        await pool.query(
          `INSERT INTO chat_messages (session_id, user_id, role, content, retrieved_lore_ids) VALUES (?, ?, 'model', ?, ?)`,
          [sessionId, userId, partialToSave, retrievedLoreIds]
        );
      } catch (insertErr) {
        console.warn('[Stream API Error] Failed to persist partial model reply:', insertErr.message);
      }
    }

    const errMsg = err.message || 'Stream generation failed';
    const status = err.status || 0;
    const lower = errMsg.toLowerCase();
    const isRateLimit = status === 429 || errMsg.includes('RESOURCE_EXHAUSTED');
    const isAuth = status === 401 || status === 403 || errMsg.includes('API_KEY_INVALID') || lower.includes('unauthorized') || lower.includes('incorrect api key') || errMsg.includes('UNAUTHENTICATED');
    const isNetworkError = err.code === 'STREAM_STALLED' || 
      err.code === 'NETWORK_TIMEOUT' || 
      err.code === 'STREAM_TIMEOUT' || 
      status === 504 || 
      /aborted|stalled|timeout|network|econnreset|socket hang up|fetch failed/i.test(errMsg);
    const networkCode = (err.code === 'NETWORK_TIMEOUT' || (!hasStreamStarted && !err.hasStreamStarted))
      ? 'NETWORK_TIMEOUT'
      : 'STREAM_STALLED';
    const errorType = isRateLimit ? 'rate_limit' : (isAuth ? 'auth' : (isNetworkError ? 'network' : 'server'));

    if (hasStreamStarted || err.hasStreamStarted) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: "Stream interrupted mid-generation",
        details: errMsg,
        status: status || (isRateLimit ? 429 : (isNetworkError ? 504 : 500)),
        code: isNetworkError ? networkCode : err.code,
        type: errorType,
        hasStreamStarted: true,
        partialText: partialToSave
      })}\n\n`);
      res.write(`event: end\ndata: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    res.write(`event: error\ndata: ${JSON.stringify({
      error: errMsg,
      type: errorType,
      code: isNetworkError ? networkCode : err.code,
      status: status || (isRateLimit ? 429 : (isAuth ? 401 : (isNetworkError ? 504 : 500))),
      hasStreamStarted: false
    })}\n\n`);
    res.end();
  }
});

// ==========================================
// LORE BOOKS (MULTI-WORLD CONTAINER)
// ==========================================

app.get('/api/books', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [books] = await pool.query(
      `SELECT b.id, b.user_id, b.title, b.description, b.system_instruction, b.language, b.created_at,
              COUNT(e.id) as entry_count
       FROM lore_books b
       LEFT JOIN lore_entries e ON b.id = e.book_id AND e.user_id = b.user_id
       WHERE b.user_id = ?
       GROUP BY b.id
       ORDER BY b.created_at ASC`,
      [userId]
    );

    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description = '', system_instruction = '', language = 'vi' } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Book title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO lore_books (user_id, title, description, system_instruction, language)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title.trim(), description.trim(), system_instruction.trim(), language.trim()]
    );

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      system_instruction: system_instruction.trim(),
      language: language.trim(),
      entry_count: 0,
      created_at: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = parseInt(req.params.id, 10);
    const { title, description, system_instruction, language } = req.body;

    const [existing] = await pool.query(`SELECT * FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [bookId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lore Book not found for this account.' });
    }

    const updatedTitle = title !== undefined ? title.trim() : existing[0].title;
    const updatedDesc = description !== undefined ? description.trim() : existing[0].description;
    const updatedInst = system_instruction !== undefined ? system_instruction : existing[0].system_instruction;
    const updatedLang = language !== undefined ? language.trim() : existing[0].language;

    await pool.query(
      `UPDATE lore_books SET title = ?, description = ?, system_instruction = ?, language = ? WHERE id = ? AND user_id = ?`,
      [updatedTitle, updatedDesc, updatedInst, updatedLang, bookId, userId]
    );

    // Tier 1 (World Core) changed -> the cached RAG scope must be rebuilt.
    RAGEngine.invalidate({ userId, bookId });

    res.json({
      success: true,
      id: bookId,
      title: updatedTitle,
      description: updatedDesc,
      system_instruction: updatedInst,
      language: updatedLang
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = parseInt(req.params.id, 10);

    const [result] = await pool.query(`DELETE FROM lore_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Lore Book not found for this account.' });
    }

    // FK cascade removed the entries; drop the RAG scope so nothing stays cached.
    RAGEngine.invalidate({ userId, bookId });

    res.json({ success: true, deletedId: bookId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id/entries', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = parseInt(req.params.id, 10);
    const { category, search } = req.query;

    const [owned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [bookId, userId]);
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Lore Book not found for this account.' });
    }

    let sql = `SELECT id, user_id, book_id, world_id, category, title, aliases, rules, content, metadata, created_at, updated_at
               FROM lore_entries WHERE user_id = ? AND book_id = ?`;
    const params = [userId, bookId];

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ` AND (title LIKE ? OR aliases LIKE ? OR content LIKE ? OR rules LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY title ASC`;
    const [rows] = await pool.query(sql, params);
    const processed = rows.map(r => ({
      ...r,
      canonicalLore: r.content || '',
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {})
    }));
    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// LOREBOOK DATABASE CRUD (public / book-scoped)
// ==========================================

app.get('/api/lore', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, search, book_id, worldId } = req.query;
    let sql = `SELECT id, user_id, book_id, world_id, category, title, aliases, rules, content, metadata, created_at, updated_at
               FROM lore_entries WHERE user_id = ?`;
    const params = [userId];

    const targetBook = book_id || worldId;
    if (targetBook !== undefined && targetBook !== null && String(targetBook).trim() !== '') {
      const targetBookId = parseInt(targetBook, 10);
      if (!Number.isFinite(targetBookId) || targetBookId <= 0) {
        return res.status(400).json({ error: 'book_id must be a positive integer.' });
      }
      sql += ` AND book_id = ?`;
      params.push(targetBookId);
    }
    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ` AND (title LIKE ? OR aliases LIKE ? OR content LIKE ? OR rules LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY title ASC`;
    const [rows] = await pool.query(sql, params);
    const processed = rows.map(r => ({
      ...r,
      aliases: normalizeAliasesCsv(r.aliases),
      canonicalLore: r.content || '',
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {})
    }));
    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lore', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      category = 'General',
      title,
      aliases = '',
      rules = '',
      content = '',
      canonicalLore = '',
      metadata = {},
      book_id,
      worldId
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Every entry must belong to one of the caller's own books (no global fallback).
    const targetBookId = parseInt(book_id ?? worldId, 10);
    if (!targetBookId) {
      return res.status(400).json({ error: 'book_id is required to create a lore entry.' });
    }

    const [owned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [targetBookId, userId]);
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Lore Book not found for this account.' });
    }

    const finalContent = (canonicalLore || content || '').trim();
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');
    const aliasesStr = normalizeAliasesCsv(aliases);

    const [result] = await pool.query(
      `INSERT INTO lore_entries (user_id, book_id, world_id, category, title, aliases, rules, content, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, targetBookId, String(targetBookId), category.trim(), title.trim(), aliasesStr, rules.trim(), finalContent, metadataStr]
    );

    // New canon available: rebuild the RAG scope so it is retrievable immediately.
    RAGEngine.invalidate({ userId, bookId: targetBookId });

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      book_id: targetBookId,
      world_id: String(targetBookId),
      category,
      title: title.trim(),
      aliases: aliasesStr,
      rules: rules.trim(),
      content: finalContent,
      canonicalLore: finalContent,
      metadata: typeof metadata === 'string' ? JSON.parse(metadataStr) : metadata
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lore/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    const {
      category,
      title,
      aliases,
      rules,
      content,
      canonicalLore,
      metadata,
      book_id,
      worldId
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const finalContent = canonicalLore !== undefined ? canonicalLore : content;
    const metadataStr = metadata !== undefined
      ? (typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata))
      : null;
    const aliasesStr = aliases !== undefined ? normalizeAliasesCsv(aliases) : null;

    // Ownership check first: entry must already belong to the caller.
    const [existing] = await pool.query(`SELECT * FROM lore_entries WHERE id = ? AND user_id = ? LIMIT 1`, [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lore entry not found for this account.' });
    }

    // `world_id` is a nullable free-form scope (graph world), NOT a synonym for the
    // owning book. Only rewrite it when the caller explicitly supplies a new scope;
    // otherwise editing an entry used to silently destroy its world binding.
    const hasBookTarget = book_id !== undefined || worldId !== undefined;
    const requestedBookId = book_id !== undefined ? book_id : worldId;
    const nextBookId = requestedBookId !== undefined && requestedBookId !== null && String(requestedBookId).trim() !== ''
      ? parseInt(requestedBookId, 10)
      : null;
    if (nextBookId) {
      const [bookOwned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [nextBookId, userId]);
      if (bookOwned.length === 0) {
        return res.status(404).json({ error: 'Target Lore Book not found for this account.' });
      }
    }

    const updatedCategory = category !== undefined ? category.trim() : existing[0].category;
    const updatedTitle = title !== undefined ? title.trim() : existing[0].title;
    const updatedAliases = aliasesStr !== null ? aliasesStr : normalizeAliasesCsv(existing[0].aliases);
    const updatedRules = rules !== undefined ? rules.trim() : existing[0].rules;
    const updatedContent = finalContent !== undefined ? finalContent.trim() : existing[0].content;
    const updatedMetadata = metadataStr !== null ? metadataStr : toJsonString(existing[0].metadata);
    const updatedBookId = hasBookTarget && nextBookId ? nextBookId : existing[0].book_id;
    const updatedWorldId = worldId !== undefined && worldId !== null && String(worldId).trim() !== ''
      ? String(worldId)
      : (hasBookTarget ? String(updatedBookId) : (existing[0].world_id || String(updatedBookId)));

    await pool.query(
      `UPDATE lore_entries
       SET category = ?, title = ?, aliases = ?, rules = ?, content = ?, metadata = ?, book_id = ?, world_id = ?
       WHERE id = ? AND user_id = ?`,
      [updatedCategory, updatedTitle, updatedAliases, updatedRules, updatedContent, updatedMetadata, updatedBookId, updatedWorldId, id, userId]
    );

    // Canon changed: drop the stale RAG scope (both the old and the new book).
    RAGEngine.invalidate({ userId, bookId: existing[0].book_id });
    if (updatedBookId !== existing[0].book_id) {
      RAGEngine.invalidate({ userId, bookId: updatedBookId });
    }

    res.json({
      id,
      user_id: userId,
      book_id: updatedBookId,
      world_id: updatedWorldId,
      category: updatedCategory,
      title: updatedTitle,
      aliases: updatedAliases,
      rules: updatedRules,
      content: updatedContent,
      canonicalLore: updatedContent,
      metadata: JSON.parse(updatedMetadata || '{}')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lore/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);

    const [rows] = await pool.query(`SELECT id, book_id FROM lore_entries WHERE id = ? AND user_id = ? LIMIT 1`, [id, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lore entry not found for this account.' });
    }

    await pool.query(`DELETE FROM lore_entries WHERE id = ? AND user_id = ?`, [id, userId]);

    // Deleted canon must disappear from RAG immediately (no 5-minute ghost lore).
    RAGEngine.invalidate({ userId, bookId: rows[0].book_id });

    res.json({ success: true, deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GRAPH STATE & CANVAS CONNECTIONS API
// ==========================================

app.get('/api/graph/:worldId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const worldId = String(req.params.worldId);
    const [rows] = await pool.query(
      `SELECT id, world_id, nodes, edges, updated_at FROM graph_states WHERE user_id = ? AND world_id = ? LIMIT 1`,
      [userId, worldId]
    );

    if (rows.length === 0) {
      return res.json({
        worldId,
        nodes: [],
        edges: [],
        isDefault: true
      });
    }

    const row = rows[0];
    const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes || '[]') : (row.nodes || []);
    const edges = typeof row.edges === 'string' ? JSON.parse(row.edges || '[]') : (row.edges || []);

    res.json({
      id: row.id,
      worldId: row.world_id,
      nodes,
      edges,
      updatedAt: row.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/graph/:worldId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const worldId = String(req.params.worldId);
    const { nodes, edges } = req.body || {};
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeEdges = Array.isArray(edges) ? edges : [];

    const nodesJson = JSON.stringify(safeNodes);
    const edgesJson = JSON.stringify(safeEdges);
    const graphId = `graph_${userId}_${worldId}`;

    await pool.query(
      `INSERT INTO graph_states (id, user_id, world_id, nodes, edges)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP`,
      [graphId, userId, worldId, nodesJson, edgesJson, nodesJson, edgesJson]
    );

    // Sync individual wiring into node_connections atomically. A partially applied
    // edge list would silently corrupt graph traversal for the next reads.
    const connection = await pool.getConnection();
    const seenEdgeIds = new Set();
    try {
      await connection.beginTransaction();
      await connection.query(
        `DELETE FROM node_connections WHERE user_id = ? AND world_id = ?`,
        [userId, worldId]
      );

      for (let i = 0; i < safeEdges.length; i += 1) {
        const e = safeEdges[i] || {};
        if (!e.source || !e.target) continue;

        // node_connections.id is VARCHAR(64): truncate deterministic ids and make
        // sure duplicates inside a single payload cannot abort the transaction.
        const baseId = e.id ? `${userId}_${e.id}` : `e_${userId}_${i}`;
        let edgeId = String(baseId).slice(0, 64);
        let suffix = 1;
        while (seenEdgeIds.has(edgeId)) {
          const tail = `_${suffix}`;
          edgeId = `${String(baseId).slice(0, 64 - tail.length)}${tail}`;
          suffix += 1;
        }
        seenEdgeIds.add(edgeId);

        const edgeType = String(e.type || e.data?.relationshipType || 'relationship').slice(0, 50);
        const label = String(e.label || e.data?.label || '').slice(0, 255);

        await connection.query(
          `INSERT INTO node_connections (id, user_id, world_id, source_node_id, target_node_id, edge_type, label, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [edgeId, userId, worldId, String(e.source), String(e.target), edgeType, label, JSON.stringify(e.data || {})]
        );
      }

      await connection.commit();
    } catch (connErr) {
      await connection.rollback().catch(() => {});
      console.warn('[Graph DB Sync Warning]:', connErr.message);
    } finally {
      connection.release();
    }

    res.json({
      success: true,
      worldId,
      nodesCount: safeNodes.length,
      edgesCount: safeEdges.length,
      updatedAt: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API KEY POOL & CONFIG (Multi-Provider BYOK)
// ==========================================

// Get user's keys (filtered optionally by ?provider=gemini|deepseek|openrouter|huggingface)
app.get('/api/keys', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const provider = req.query.provider || null;
    const status = await getUserMultiProviderKeys(userId, provider);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a key for user (Multi-Provider BYOK)
app.post('/api/keys', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key, keys, provider = 'gemini', baseUrl } = req.body;

    // Support batch of keys
    if (Array.isArray(keys) && keys.length > 0) {
      const validKeys = keys.map(k => String(k).trim()).filter(Boolean);
      if (validKeys.length === 0) {
        return res.status(400).json({ error: 'At least one valid API key is required.' });
      }
      let finalStatus = null;
      for (const k of validKeys) {
        finalStatus = await addUserMultiProviderKey(userId, k, provider, baseUrl);
      }
      return res.json({ success: true, keys: finalStatus || await getUserMultiProviderKeys(userId, provider) });
    }

    const rawKey = key;
    if (!rawKey || !String(rawKey).trim()) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const updatedStatus = await addUserMultiProviderKey(userId, String(rawKey).trim(), provider, baseUrl);
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a specific key for user
app.delete('/api/keys/:keyId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedStatus = await removeUserMultiProviderKey(userId, parseInt(req.params.keyId, 10));
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test a single key for any provider (no auth needed)
app.post('/api/keys/test', async (req, res) => {
  try {
    const { key, provider = 'gemini', baseUrl } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    const result = await testProviderKey({ provider, key, baseUrl });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset user's key statuses (optionally per provider)
app.post('/api/keys/reset', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const provider = req.body.provider || req.query.provider || null;
    const updatedStatus = await resetUserMultiProviderStatuses(userId, provider);
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Master System Instruction
app.get('/api/config/instruction', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT value FROM system_configs WHERE key_name = 'master_system_instruction'`);
    res.json({ instruction: rows[0]?.value || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/instruction', requireAuth, async (req, res) => {
  try {
    const { instruction } = req.body;
    if (typeof instruction !== 'string') {
      return res.status(400).json({ error: 'instruction must be a string' });
    }
    await pool.query(
      `INSERT INTO system_configs (key_name, value) VALUES ('master_system_instruction', ?)
       ON DUPLICATE KEY UPDATE value = ?`,
      [instruction, instruction]
    );
    res.json({ success: true, instruction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RAG CACHE TELEMETRY & MANUAL INVALIDATION
// ==========================================

// GET /api/rag/stats — cache hit-rate telemetry (target: payload hit + DB-free turns >= 80%)
app.get('/api/rag/stats', requireAuth, (req, res) => {
  const stats = RAGEngine.getStats();
  res.json({
    ...stats,
    target: { payloadHitRate: 0.8, dbFreeTurnRate: 0.8 },
    meetsTarget: stats.payloadHitRate >= 0.8 && stats.dbFreeTurnRate >= 0.8
  });
});

// POST /api/rag/invalidate — flush one owned scope, or the whole cache
app.post('/api/rag/invalidate', requireAuth, async (req, res) => {
  try {
    const bookId = req.body?.bookId ? parseInt(req.body.bookId, 10) : null;

    if (bookId) {
      const [owned] = await pool.query(`SELECT id FROM lore_books WHERE id = ? AND user_id = ? LIMIT 1`, [bookId, req.user.id]);
      if (owned.length === 0) {
        return res.status(404).json({ error: 'Lore Book not found for this account.' });
      }
      return res.json({ success: true, ...RAGEngine.invalidate({ userId: req.user.id, bookId }) });
    }

    return res.json({ success: true, ...RAGEngine.invalidate() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static build assets from 'dist'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

export default app;
