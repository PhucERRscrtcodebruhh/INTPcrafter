import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { keyPool } from './geminiPool.js';
import { RAGEngine } from './ragEngine.js';
import {
  getModelContextLimit,
  estimateTokens,
  calculateContextTokens,
  applyRollingContext
} from './tokenUtils.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const [dbResult] = await pool.query('SELECT 1 as connected');
    const keyStatus = keyPool.getStatus();
    res.json({
      status: 'online',
      dbConnected: dbResult?.[0]?.connected === 1,
      keysConfigured: keyStatus.length,
      activeKeys: keyStatus.filter(k => k.status === 'active').length,
      engine: 'StoryContainer INTP Engine v1.0'
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

// ==========================================
// CHAT SESSIONS & MESSAGES
// ==========================================

app.get('/api/sessions', async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT s.id, s.title, s.created_at, 
              COUNT(m.id) as message_count,
              MAX(m.created_at) as last_message_at
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON s.id = m.session_id
       GROUP BY s.id
       ORDER BY COALESCE(MAX(m.created_at), s.created_at) DESC`
    );
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = (req.body.title || 'Untitled Chronicle').trim();
    await pool.query(`INSERT INTO chat_sessions (id, title) VALUES (?, ?)`, [id, title]);
    res.status(201).json({ id, title, created_at: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    await pool.query(`UPDATE chat_sessions SET title = ? WHERE id = ?`, [title.trim(), req.params.id]);
    res.json({ success: true, id: req.params.id, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    await pool.query(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
    await pool.query(`DELETE FROM chat_sessions WHERE id = ?`, [sessionId]);
    res.json({ success: true, deletedId: sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/messages', async (req, res) => {
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
app.put('/api/messages/:id', async (req, res) => {
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
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    await pool.query(`DELETE FROM chat_messages WHERE id = ?`, [messageId]);
    res.json({ success: true, deletedId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Truncate session messages from a specific point onward (for edit & regenerate flow)
app.delete('/api/sessions/:sessionId/messages/from/:messageId', async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    await pool.query(`DELETE FROM chat_messages WHERE session_id = ? AND id >= ?`, [sessionId, messageId]);
    res.json({ success: true, sessionId, fromMessageId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authentication Endpoint (Default dev: ID 0 / 'dev', password '0000')
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/ID and password are required' });
  }

  const uStr = String(username).trim().toLowerCase();
  const pStr = String(password).trim();

  // Default dev account credentials
  if ((uStr === '0' || uStr === 'dev') && pStr === '0000') {
    return res.json({
      success: true,
      user: {
        id: 0,
        username: 'dev',
        displayName: 'INTP Dev Architect',
        role: 'developer',
        avatar: 'dev_0'
      },
      token: `dev_token_${Date.now()}`
    });
  }

  return res.status(401).json({
    error: 'Sai tài khoản hoặc mật khẩu. Mặc định là tài khoản ID: 0 (hoặc "dev") và mật khẩu: "0000".'
  });
});

// ==========================================
// CORE GENERATION & INTP RAG ENGINE
// ==========================================

app.post('/api/chat', async (req, res) => {
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

  try {
    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const [instRows] = await pool.query(
      `SELECT value FROM system_configs WHERE key_name = 'master_system_instruction'`
    );
    const masterInstruction = instRows[0]?.value || 'You are a deterministic world simulator and novel engine.';

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, formattedContext, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6
    });

    const fullSystemInstruction = `${masterInstruction}\n${formattedContext}`;
    const modelLimit = getModelContextLimit(model);
    const effectiveThreshold = Math.min(contextRollingThreshold, modelLimit - maxOutputTokens - 500);

    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(historyRows, fullSystemInstruction, '', effectiveThreshold);

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: cleanPrompt }]
    });

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'user', ?, ?)`,
      [sessionId, cleanPrompt, retrievedLoreIds]
    );

    const result = await keyPool.executeWithFallback({
      model,
      contents,
      systemInstruction: fullSystemInstruction,
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

// SSE Streaming Generation Endpoint
app.post('/api/chat/stream', async (req, res) => {
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const [historyRows] = await pool.query(
      `SELECT id, role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const [instRows] = await pool.query(
      `SELECT value FROM system_configs WHERE key_name = 'master_system_instruction'`
    );
    const masterInstruction = instRows[0]?.value || 'You are a deterministic world simulator and novel engine.';

    const recentMessages = historyRows.slice(-3);
    const { retrievedLore, formattedContext, retrievedLoreIds } = await RAGEngine.retrieveLore({
      currentPrompt: cleanPrompt,
      recentMessages,
      maxResults: 6
    });

    const fullSystemInstruction = `${masterInstruction}\n${formattedContext}`;
    const modelLimit = getModelContextLimit(model);
    const effectiveThreshold = Math.min(contextRollingThreshold, modelLimit - maxOutputTokens - 500);

    const {
      prunedMessages,
      isRolled,
      originalCount,
      keptCount,
      totalTokens
    } = applyRollingContext(historyRows, fullSystemInstruction, '', effectiveThreshold);

    const contents = prunedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: cleanPrompt }]
    });

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, retrieved_lore_ids) VALUES (?, 'user', ?, ?)`,
      [sessionId, cleanPrompt, retrievedLoreIds]
    );

    res.write(`event: rag\ndata: ${JSON.stringify({ retrievedLore, retrievedLoreIds })}\n\n`);

    const result = await keyPool.executeStreamWithFallback({
      model,
      contents,
      systemInstruction: fullSystemInstruction,
      generationConfig: {
        temperature: parseFloat(temperature),
        topP: parseFloat(topP),
        maxOutputTokens: parseInt(maxOutputTokens, 10),
      },
      onChunk: (chunkText) => {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunkText })}\n\n`);
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
    console.error('[Stream API Error]:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ==========================================
// LOREBOOK DATABASE CRUD
// ==========================================

app.get('/api/lore', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `SELECT id, category, title, aliases, rules, content, created_at FROM lore_entries WHERE 1=1`;
    const params = [];

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ` AND (title LIKE ? OR aliases LIKE ? OR content LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY title ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lore', async (req, res) => {
  try {
    const { category = 'General', title, aliases = '', rules = '', content = '' } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO lore_entries (category, title, aliases, rules, content) VALUES (?, ?, ?, ?, ?)`,
      [category.trim(), title.trim(), aliases.trim(), rules.trim(), content.trim()]
    );

    res.status(201).json({
      id: result.insertId,
      category,
      title: title.trim(),
      aliases: aliases.trim(),
      rules: rules.trim(),
      content: content.trim()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lore/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { category, title, aliases, rules, content } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    await pool.query(
      `UPDATE lore_entries SET category = ?, title = ?, aliases = ?, rules = ?, content = ? WHERE id = ?`,
      [category.trim(), title.trim(), aliases?.trim() || '', rules?.trim() || '', content?.trim() || '', id]
    );

    res.json({ id: parseInt(id, 10), category, title, aliases, rules, content });
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
// API KEY POOL & CONFIG
// ==========================================

app.get('/api/keys', async (req, res) => {
  try {
    await keyPool.init();
    res.json(keyPool.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys', async (req, res) => {
  try {
    const { keys } = req.body;
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys must be an array of strings' });
    }
    const updatedStatus = await keyPool.saveKeysToDB(keys);
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys/test', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    const result = await keyPool.testSingleKey(key);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys/reset', async (req, res) => {
  try {
    const updatedStatus = keyPool.resetStatuses();
    res.json({ success: true, keys: updatedStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Master System Instruction
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

export default app;
