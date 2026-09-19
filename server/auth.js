import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'intp_5w4_jwt_secret_fallback_key_do_not_use_in_prod';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_SALT_ROUNDS = 10;

// ==========================================
// JWT Helpers
// ==========================================

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ==========================================
// Auth Middleware
// ==========================================

/**
 * optionalAuth: Parse JWT if present, attach req.user.
 * If no token → req.user = { id: 0, username: 'dev' } (dev fallback).
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { id: 0, username: 'dev', displayName: 'INTP Dev Architect', role: 'developer' };
    return next();
  }

  const token = authHeader.split(' ')[1];

  // Dev token passthrough
  if (token.startsWith('dev_token_')) {
    req.user = { id: 0, username: 'dev', displayName: 'INTP Dev Architect', role: 'developer' };
    return next();
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    // Invalid token → fallback to dev
    req.user = { id: 0, username: 'dev', displayName: 'INTP Dev Architect', role: 'developer' };
    next();
  }
}

/**
 * requireAuth: Require valid JWT or dev token. Returns 401 if missing/invalid.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const token = authHeader.split(' ')[1];

  // Dev token passthrough
  if (token.startsWith('dev_token_')) {
    req.user = { id: 0, username: 'dev', displayName: 'INTP Dev Architect', role: 'developer' };
    return next();
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

// ==========================================
// Auth Routes
// ==========================================

const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // Validate username
    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
    }
    // Block reserved names
    if (['dev', 'admin', 'system', 'root', '0'].includes(cleanUsername.toLowerCase())) {
      return res.status(400).json({ error: 'This username is reserved.' });
    }

    // Validate password
    if (cleanPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    // Check duplicate
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_SALT_ROUNDS);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      [cleanUsername, passwordHash, cleanUsername]
    );

    const user = {
      id: result.insertId,
      username: cleanUsername,
      displayName: cleanUsername,
      role: 'user',
      avatar: null,
      language: 'vi'
    };

    const token = generateToken(user);

    res.status(201).json({ success: true, user, token });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const uStr = String(username).trim().toLowerCase();
    const pStr = String(password).trim();

    // Dev account passthrough (open-source test account, id:0, no API key)
    if ((uStr === '0' || uStr === 'dev') && pStr === '0000') {
      return res.json({
        success: true,
        user: {
          id: 0,
          username: 'dev',
          displayName: 'INTP Dev Architect',
          role: 'developer',
          avatar: null,
          language: 'vi'
        },
        token: `dev_token_${Date.now()}`
      });
    }

    // DB lookup
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, display_name, avatar_data, language FROM users WHERE LOWER(username) = ?',
      [uStr]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const dbUser = rows[0];
    const passwordMatch = await bcrypt.compare(pStr, dbUser.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name || dbUser.username,
      role: 'user',
      avatar: dbUser.avatar_data ? true : null,
      language: dbUser.language || 'vi'
    };

    const token = generateToken(user);

    res.json({ success: true, user, token });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out. Token discarded client-side.' });
});

// GET /api/auth/me (requires auth)
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    // Dev account
    if (req.user.id === 0) {
      return res.json({
        id: 0,
        username: 'dev',
        displayName: 'INTP Dev Architect',
        role: 'developer',
        avatar: null,
        language: 'vi'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, username, display_name, avatar_data, language, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const u = rows[0];
    res.json({
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      role: 'user',
      avatar: u.avatar_data ? true : null,
      language: u.language || 'vi',
      createdAt: u.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/avatar (get avatar image data)
authRouter.get('/avatar', requireAuth, async (req, res) => {
  try {
    if (req.user.id === 0) {
      return res.json({ avatar: null });
    }
    const [rows] = await pool.query('SELECT avatar_data FROM users WHERE id = ?', [req.user.id]);
    res.json({ avatar: rows[0]?.avatar_data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/avatar (upload avatar as base64)
authRouter.post('/avatar', requireAuth, async (req, res) => {
  try {
    if (req.user.id === 0) {
      return res.status(403).json({ error: 'Dev account cannot upload avatar. Register a real account.' });
    }

    const { avatar } = req.body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid avatar format. Must be a data:image/... base64 string.' });
    }

    // ~2MB limit check on the base64 string
    if (avatar.length > 2_800_000) {
      return res.status(400).json({ error: 'Avatar too large. Max ~2MB.' });
    }

    await pool.query('UPDATE users SET avatar_data = ? WHERE id = ?', [avatar, req.user.id]);

    res.json({ success: true, message: 'Avatar updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/language (update language preference)
authRouter.put('/language', requireAuth, async (req, res) => {
  try {
    const { language } = req.body;
    const validLangs = ['vi', 'en', 'zh', 'ko'];
    if (!validLangs.includes(language)) {
      return res.status(400).json({ error: `Invalid language. Must be one of: ${validLangs.join(', ')}` });
    }

    if (req.user.id > 0) {
      await pool.query('UPDATE users SET language = ? WHERE id = ?', [language, req.user.id]);
    }

    res.json({ success: true, language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { authRouter };
