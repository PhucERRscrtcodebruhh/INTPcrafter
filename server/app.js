import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { keyPool, getPoolForUser, addUserKey, removeUserKey, getUserKeyStatus, resetUserKeys } from './geminiPool.js';
import { 
  dispatchStreamingGeneration, 
  testProviderKey, 
  getUserMultiProviderKeys, 
  addUserMultiProviderKey, 
  removeUserMultiProviderKey, 
  resetUserMultiProviderStatuses,
  detectProviderFromModel 
} from './llmProviders.js';
import { RAGEngine } from './ragEngine.js';
import {
  getModelContextLimit,
  estimateTokens,
  calculateContextTokens,
  applyRollingContext
} from './tokenUtils.js';
import { authRouter, optionalAuth, requireAuth } from './auth.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

app.get('/api/sessions', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    let sessions;

    if (userId > 0) {
      // Registered user: show only their sessions
      [sessions] = await pool.query(
        `SELECT s.id, s.title, s.user_id, s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, s.created_at, 
                COUNT(m.id) as message_count,
                MAX(m.created_at) as last_message_at
         FROM chat_sessions s
         LEFT JOIN lore_books b ON s.book_id = b.id
         LEFT JOIN chat_messages m ON s.id = m.session_id
         WHERE s.user_id = ?
         GROUP BY s.id
         ORDER BY COALESCE(MAX(m.created_at), s.created_at) DESC`,
        [userId]
      );
    } else {
      // Dev/anonymous: show sessions with NULL or 0 user_id
      [sessions] = await pool.query(
        `SELECT s.id, s.title, s.user_id, s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, s.created_at, 
                COUNT(m.id) as message_count,
                MAX(m.created_at) as last_message_at
         FROM chat_sessions s
         LEFT JOIN lore_books b ON s.book_id = b.id
         LEFT JOIN chat_messages m ON s.id = m.session_id
         WHERE s.user_id IS NULL OR s.user_id = 0
         GROUP BY s.id
         ORDER BY COALESCE(MAX(m.created_at), s.created_at) DESC`
      );
    }
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = (req.body.title || 'Untitled Chronicle').trim();
    const bookId = req.body.book_id ? parseInt(req.body.book_id, 10) : null;
    const rollingThreshold = req.body.rolling_threshold !== undefined 
      ? parseInt(req.body.rolling_threshold, 10) 
      : (req.body.rollingThreshold !== undefined ? parseInt(req.body.rollingThreshold, 10) : 32768);

    await pool.query(
      `INSERT INTO chat_sessions (id, title, user_id, book_id, rolling_threshold) VALUES (?, ?, ?, ?, ?)`,
      [id, title, userId > 0 ? userId : null, bookId, rollingThreshold || 32768]
    );
    res.status(201).json({ id, title, user_id: userId, book_id: bookId, rolling_threshold: rollingThreshold || 32768, created_at: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:id', optionalAuth, async (req, res) => {
  try {
    const { title, book_id, rolling_threshold, rollingThreshold } = req.body;
    const sessionId = req.params.id;

    // Build update query dynamically
    const fields = [];
    const values = [];

    if (title !== undefined && title.trim()) {
      fields.push('title = ?');
      values.push(title.trim());
    }
    if (book_id !== undefined) {
      fields.push('book_id = ?');
      values.push(book_id ? parseInt(book_id, 10) : null);
    }
    const targetThreshold = rolling_threshold !== undefined ? rolling_threshold : rollingThreshold;
    if (targetThreshold !== undefined) {
      fields.push('rolling_threshold = ?');
      values.push(parseInt(targetThreshold, 10) || 32768);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(sessionId);
    await pool.query(`UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
    
    // Fetch updated session
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.user_id, s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, s.created_at
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id
       WHERE s.id = ?`,
      [sessionId]
    );

    res.json({ success: true, session: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', optionalAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    await pool.query(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
    await pool.query(`DELETE FROM chat_sessions WHERE id = ?`, [sessionId]);
    res.json({ success: true, deletedId: sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/messages', optionalAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const [messages] = await pool.query(
      `SELECT id, session_id, role, content, retrieved_lore_ids, created_at
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    );

    // Fetch details of retrieved lore for each message if present
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
        `SELECT id, category, title, aliases, rules, content FROM lore_entries WHERE id IN (${placeholders})`,
        Array.from(loreIdSet)
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

// Update specific message content (edit prompt or story text)
app.put('/api/messages/:id', optionalAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    await pool.query(`UPDATE chat_messages SET content = ? WHERE id = ?`, [content, messageId]);
    res.json({ success: true, id: messageId, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete specific message
app.delete('/api/messages/:id', optionalAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    await pool.query(`DELETE FROM chat_messages WHERE id = ?`, [messageId]);
    res.json({ success: true, deletedId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Truncate session messages from a specific point onward (for edit & regenerate flow)
app.delete('/api/sessions/:sessionId/messages/from/:messageId', optionalAuth, async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    await pool.query(`DELETE FROM chat_messages WHERE session_id = ? AND id >= ?`, [sessionId, messageId]);
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

app.post('/api/chat', optionalAuth, async (req, res) => {
  const {
    sessionId,
    prompt,
    model = 'gemini-3.8-flash',
    temperature = 0.7,
    topP = 0.95,
    maxOutputTokens = 4096,
    contextRollingThreshold = 32768,
  } = req.body;

  if (!sessionId || !prompt?.trim()) {
    return res.status(400).json({ error: 'sessionId and prompt are required' });
  }

  const cleanPrompt = prompt.trim();
  const userId = req.user?.id || 0;

  try {
    // Load per-user key pool (BYOK)
    const userKeyPool = await getPoolForUser(userId);
    if (userKeyPool.keys.length === 0) {
      return res.status(400).json({
        error: 'NO_API_KEYS: Bạn chưa thêm Gemini API Key. Vào World Config & Lorebook → Key Pool để thêm key (BYOK).'
      });
    }

    const [sessRows] = await pool.query(
      `SELECT s.book_id, COALESCE(s.rolling_threshold, 32768) as rolling_threshold, b.title as book_title, b.system_instruction as book_instruction
       FROM chat_sessions s
       LEFT JOIN lore_books b ON s.book_id = b.id
       WHERE s.id = ?`,
      [sessionId]
    );
    const sessionBook = sessRows[0] || null;
    const bookId = sessionBook?.book_id || null;

    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6,
      bookId
    });

    // Tier 0: Global Core - Completely Static across ALL requests
    const tier0GlobalCore = TIER_0_GLOBAL_CORE;

    // Tier 1: World Core Rules - Static/Append-Only per active world
    const tier1WorldCore = sessionBook?.book_instruction?.trim()
      ? `[WORLD CORE RULES - ${sessionBook.book_title || 'Active Chronicle'}]\n${sessionBook.book_instruction.trim()}`
      : `[WORLD CORE RULES - Default Invariants]\nMaintain logical causality, physical laws, and continuity across chronicle events.`;

    const fullStaticSystemInstruction = `${tier0GlobalCore}\n\n${tier1WorldCore}`;

    const modelLimit = getModelContextLimit(model);
    const sessionThreshold = req.body.contextRollingThreshold !== undefined 
      ? parseInt(req.body.contextRollingThreshold, 10) 
      : (sessionBook?.rolling_threshold || 32768);
    const effectiveThreshold = Math.min(sessionThreshold, modelLimit - maxOutputTokens - 500);

    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(historyRows, fullStaticSystemInstruction, '', effectiveThreshold);

    // Tier 2: Dynamic RAG & User Input (Volatile Suffix) strictly on terminal user message
    const tier2UserPrompt = RAGEngine.formatTier2Prompt(cleanPrompt, retrievedLore);

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: tier2UserPrompt }]
    });

    // Reconstruct outbound messages with strict 3-tier prefix caching hierarchy
    const messages = [
      { role: 'system', content: tier0GlobalCore },
      { role: 'system', content: tier1WorldCore },
      ...prunedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      { role: 'user', content: tier2UserPrompt }
    ];

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'user', ?, ?)`,
      [sessionId, cleanPrompt, retrievedLoreIds]
    );

    const result = await dispatchStreamingGeneration({
      userId,
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
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'model', ?, ?)`,
      [sessionId, replyText, retrievedLoreIds]
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
    res.status(500).json({
      error: err.message,
      details: err.details || null
    });
  }
});

// SSE Streaming Generation Endpoint (Multi-Provider BYOK per-user)
app.post('/api/chat/stream', optionalAuth, async (req, res) => {
  const {
    sessionId,
    prompt,
    model = 'gemini-3.8-flash',
    temperature = 0.7,
    topP = 0.95,
    maxOutputTokens = 4096,
    contextRollingThreshold = 32768,
  } = req.body;

  if (!sessionId || !prompt?.trim()) {
    return res.status(400).json({ error: 'sessionId and prompt are required' });
  }

  const cleanPrompt = prompt.trim();
  const userId = req.user?.id || 0;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let hasStreamStarted = false;
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
       LEFT JOIN lore_books b ON s.book_id = b.id
       WHERE s.id = ?`,
      [sessionId]
    );
    const sessionBook = sessRows[0] || null;
    const bookId = sessionBook?.book_id || null;

    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6,
      bookId
    });

    // Tier 0: Global Core - Completely Static across ALL requests
    const tier0GlobalCore = TIER_0_GLOBAL_CORE;

    // Tier 1: World Core Rules - Static/Append-Only per active world
    const tier1WorldCore = sessionBook?.book_instruction?.trim()
      ? `[WORLD CORE RULES - ${sessionBook.book_title || 'Active Chronicle'}]\n${sessionBook.book_instruction.trim()}`
      : `[WORLD CORE RULES - Default Invariants]\nMaintain logical causality, physical laws, and continuity across chronicle events.`;

    const fullStaticSystemInstruction = `${tier0GlobalCore}\n\n${tier1WorldCore}`;

    const modelLimit = getModelContextLimit(model);
    const sessionThreshold = req.body.contextRollingThreshold !== undefined 
      ? parseInt(req.body.contextRollingThreshold, 10) 
      : (sessionBook?.rolling_threshold || 32768);
    const effectiveThreshold = Math.min(sessionThreshold, modelLimit - maxOutputTokens - 500);

    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(historyRows, fullStaticSystemInstruction, '', effectiveThreshold);

    // Tier 2: Dynamic RAG & User Input (Volatile Suffix) strictly on terminal user message
    const tier2UserPrompt = RAGEngine.formatTier2Prompt(cleanPrompt, retrievedLore);

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: tier2UserPrompt }]
    });

    // Reconstruct outbound messages with strict 3-tier prefix caching hierarchy
    const messages = [
      { role: 'system', content: tier0GlobalCore },
      { role: 'system', content: tier1WorldCore },
      ...prunedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      { role: 'user', content: tier2UserPrompt }
    ];

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'user', ?, ?)`,
      [sessionId, cleanPrompt, retrievedLoreIds]
    );

    res.write(`event: rag\ndata: ${JSON.stringify({ retrievedLore, retrievedLoreIds })}\n\n`);

    const result = await dispatchStreamingGeneration({
      userId,
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
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    });

    cleanupKeepAlive();

    const replyText = result.text;

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'model', ?, ?)`,
      [sessionId, replyText, retrievedLoreIds]
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
    const errMsg = err.message || 'Stream generation failed';
    const status = err.status || 0;
    const lower = errMsg.toLowerCase();
    const isRateLimit = status === 429 || errMsg.includes('429') || errMsg.includes('EXHAUSTED') || lower.includes('quota') || lower.includes('rate limit');
    const isAuth = status === 401 || status === 403 || errMsg.includes('API_KEY_INVALID') || lower.includes('unauthorized') || lower.includes('incorrect api key');
    const errorType = isRateLimit ? 'rate_limit' : (isAuth ? 'auth' : 'server');

    if (hasStreamStarted || err.hasStreamStarted) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: "Stream interrupted mid-generation",
        details: errMsg,
        status: status || (isRateLimit ? 429 : 500),
        type: errorType,
        hasStreamStarted: true
      })}\n\n`);
      res.write(`event: end\ndata: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    res.write(`event: error\ndata: ${JSON.stringify({
      error: errMsg,
      type: errorType,
      status: status || (isRateLimit ? 429 : (isAuth ? 401 : 500)),
      hasStreamStarted: false
    })}\n\n`);
    res.end();
  }
});

// ==========================================
// LORE BOOKS (MULTI-WORLD CONTAINER)
// ==========================================

app.get('/api/books', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    let books;

    if (userId > 0) {
      [books] = await pool.query(
        `SELECT b.id, b.user_id, b.title, b.description, b.system_instruction, b.language, b.created_at,
                COUNT(e.id) as entry_count
         FROM lore_books b
         LEFT JOIN lore_entries e ON b.id = e.book_id
         WHERE b.user_id = ? OR b.user_id IS NULL
         GROUP BY b.id
         ORDER BY (b.user_id = ?) DESC, b.created_at ASC`,
        [userId, userId]
      );
    } else {
      [books] = await pool.query(
        `SELECT b.id, b.user_id, b.title, b.description, b.system_instruction, b.language, b.created_at,
                COUNT(e.id) as entry_count
         FROM lore_books b
         LEFT JOIN lore_entries e ON b.id = e.book_id
         WHERE b.user_id IS NULL OR b.user_id = 0
         GROUP BY b.id
         ORDER BY b.created_at ASC`
      );
    }

    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const { title, description = '', system_instruction = '', language = 'vi' } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Book title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO lore_books (user_id, title, description, system_instruction, language)
       VALUES (?, ?, ?, ?, ?)`,
      [userId > 0 ? userId : null, title.trim(), description.trim(), system_instruction.trim(), language.trim()]
    );

    res.status(201).json({
      id: result.insertId,
      user_id: userId > 0 ? userId : null,
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

app.put('/api/books/:id', optionalAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    const { title, description, system_instruction, language } = req.body;

    const [existing] = await pool.query(`SELECT * FROM lore_books WHERE id = ?`, [bookId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lore Book not found' });
    }

    const updatedTitle = title !== undefined ? title.trim() : existing[0].title;
    const updatedDesc = description !== undefined ? description.trim() : existing[0].description;
    const updatedInst = system_instruction !== undefined ? system_instruction : existing[0].system_instruction;
    const updatedLang = language !== undefined ? language.trim() : existing[0].language;

    await pool.query(
      `UPDATE lore_books SET title = ?, description = ?, system_instruction = ?, language = ? WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedInst, updatedLang, bookId]
    );

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

app.delete('/api/books/:id', optionalAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM lore_entries WHERE book_id = ?`, [bookId]);
    await pool.query(`DELETE FROM lore_books WHERE id = ?`, [bookId]);
    res.json({ success: true, deletedId: bookId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id/entries', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    const { category, search } = req.query;
    let sql = `SELECT id, book_id, world_id, category, title, aliases, rules, content, metadata, created_at, updated_at FROM lore_entries WHERE (book_id = ? OR world_id = ?)`;
    const params = [bookId, String(bookId)];

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

app.get('/api/lore', async (req, res) => {
  try {
    const { category, search, book_id, worldId } = req.query;
    let sql = `SELECT id, book_id, world_id, category, title, aliases, rules, content, metadata, created_at, updated_at FROM lore_entries WHERE 1=1`;
    const params = [];

    const targetWorld = worldId || book_id;
    if (targetWorld) {
      sql += ` AND (book_id = ? OR world_id = ?)`;
      params.push(parseInt(targetWorld, 10) || targetWorld, String(targetWorld));
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
      canonicalLore: r.content || '',
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {})
    }));
    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lore', async (req, res) => {
  try {
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

    const targetWorldId = worldId || (book_id ? String(book_id) : null);
    let targetBookId = book_id ? parseInt(book_id, 10) : (targetWorldId ? parseInt(targetWorldId, 10) : null);
    if (!targetBookId && !targetWorldId) {
      const [firstBook] = await pool.query(`SELECT id FROM lore_books ORDER BY id ASC LIMIT 1`);
      targetBookId = firstBook[0]?.id || null;
    }

    const finalContent = (canonicalLore || content || '').trim();
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');
    const aliasesStr = Array.isArray(aliases) ? JSON.stringify(aliases) : String(aliases).trim();

    const [result] = await pool.query(
      `INSERT INTO lore_entries (book_id, world_id, category, title, aliases, rules, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetBookId, targetWorldId || (targetBookId ? String(targetBookId) : null), category.trim(), title.trim(), aliasesStr, rules.trim(), finalContent, metadataStr]
    );

    res.status(201).json({
      id: result.insertId,
      book_id: targetBookId,
      world_id: targetWorldId || (targetBookId ? String(targetBookId) : null),
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

app.put('/api/lore/:id', async (req, res) => {
  try {
    const id = req.params.id;
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
    const aliasesStr = aliases !== undefined
      ? (Array.isArray(aliases) ? JSON.stringify(aliases) : String(aliases).trim())
      : null;

    const targetWorldId = worldId || (book_id ? String(book_id) : null);
    const targetBookId = book_id ? parseInt(book_id, 10) : (targetWorldId ? parseInt(targetWorldId, 10) : null);

    const [existing] = await pool.query(`SELECT * FROM lore_entries WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lore entry not found' });
    }

    const updatedCategory = category !== undefined ? category.trim() : existing[0].category;
    const updatedTitle = title !== undefined ? title.trim() : existing[0].title;
    const updatedAliases = aliasesStr !== null ? aliasesStr : existing[0].aliases;
    const updatedRules = rules !== undefined ? rules.trim() : existing[0].rules;
    const updatedContent = finalContent !== undefined ? finalContent.trim() : existing[0].content;
    const updatedMetadata = metadataStr !== null ? metadataStr : (existing[0].metadata || '{}');
    const updatedBookId = targetBookId !== null ? targetBookId : existing[0].book_id;
    const updatedWorldId = targetWorldId !== null ? targetWorldId : existing[0].world_id;

    await pool.query(
      `UPDATE lore_entries 
       SET category = ?, title = ?, aliases = ?, rules = ?, content = ?, metadata = ?, book_id = ?, world_id = ? 
       WHERE id = ?`,
      [updatedCategory, updatedTitle, updatedAliases, updatedRules, updatedContent, updatedMetadata, updatedBookId, updatedWorldId, id]
    );

    res.json({
      id: parseInt(id, 10),
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

app.delete('/api/lore/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query(`DELETE FROM lore_entries WHERE id = ?`, [id]);
    res.json({ success: true, deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GRAPH STATE & CANVAS CONNECTIONS API
// ==========================================

app.get('/api/graph/:worldId', async (req, res) => {
  try {
    const worldId = String(req.params.worldId);
    const [rows] = await pool.query(
      `SELECT id, world_id, nodes, edges, updated_at FROM graph_states WHERE world_id = ? LIMIT 1`,
      [worldId]
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

app.post('/api/graph/:worldId', async (req, res) => {
  try {
    const worldId = String(req.params.worldId);
    const { nodes = [], edges = [] } = req.body;

    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);
    const graphId = `graph_${worldId}`;

    await pool.query(
      `INSERT INTO graph_states (id, world_id, nodes, edges) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP`,
      [graphId, worldId, nodesJson, edgesJson, nodesJson, edgesJson]
    );

    // Sync individual wiring into node_connections table
    try {
      await pool.query(`DELETE FROM node_connections WHERE world_id = ?`, [worldId]);
      if (Array.isArray(edges) && edges.length > 0) {
        for (const e of edges) {
          const edgeId = e.id || `e_${e.source}_${e.target}_${Date.now()}`;
          const edgeType = e.type || e.data?.relationshipType || 'relationship';
          const label = e.label || e.data?.label || '';
          const dataJson = JSON.stringify(e.data || {});
          await pool.query(
            `INSERT INTO node_connections (id, world_id, source_node_id, target_node_id, edge_type, label, data)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [edgeId, worldId, e.source, e.target, edgeType, label, dataJson]
          );
        }
      }
    } catch (connErr) {
      console.warn('[Graph DB Sync Warning]:', connErr.message);
    }

    res.json({
      success: true,
      worldId,
      nodesCount: nodes.length,
      edgesCount: edges.length,
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
app.get('/api/keys', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const provider = req.query.provider || null;
    const status = await getUserMultiProviderKeys(userId, provider);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a key for user (Multi-Provider BYOK)
app.post('/api/keys', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
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
app.delete('/api/keys/:keyId', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
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
app.post('/api/keys/reset', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const provider = req.body.provider || req.query.provider || null;
    const updatedStatus = await resetUserMultiProviderStatuses(userId, provider);
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Master System Instruction (public)
app.get('/api/config/instruction', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT value FROM system_configs WHERE key_name = 'master_system_instruction'`);
    res.json({ instruction: rows[0]?.value || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/instruction', async (req, res) => {
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
