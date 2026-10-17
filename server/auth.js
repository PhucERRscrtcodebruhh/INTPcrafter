import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, ensureUserStarterWorld, DEV_USER_EMAIL, DEV_USER_PASSWORD } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'intp_5w4_jwt_secret_fallback_key_do_not_use_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = 10;

// ==========================================
// GMAIL IDENTITY HELPERS
// ==========================================

// Gmail accounts are dot-insensitive and +tag-insensitive, and googlemail.com is an alias
// of gmail.com. Canonicalising keeps 1 human = 1 account.
const GMAIL_RE = /^([a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?)@(gmail|googlemail)\.com$/;

/**
 * @param {string} rawEmail
 * @returns {{email:string, local:string}|null} canonical Gmail identity, or null when invalid
 */
export function canonicalizeGmail(rawEmail) {
  const email = String(rawEmail ?? '').trim().toLowerCase();
  const match = GMAIL_RE.exec(email);
  if (!match) return null;
  const local = match[1].replace(/\+.*$/, '').replace(/\./g, '');
  if (!local) return null;
  return { email: `${local}@gmail.com`, local };
}

/** Derives a safe, unique username from the Gmail local part. */
async function deriveUniqueUsername(local) {
  const base = local.replace(/[^a-z0-9_]/g, '_').slice(0, 40) || `user_${Date.now().toString(36)}`;
  const [taken] = await pool.query(`SELECT username FROM users WHERE username LIKE ?`, [`${base}%`]);
  if (taken.length === 0) return base;
  const seen = new Set(taken.map(r => r.username));
  if (!seen.has(base)) return base;
  let suffix = 1;
  while (seen.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

// ==========================================
// JWT HELPERS
// ==========================================

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email || null, username: user.username || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ==========================================
// AUTH MIDDLEWARE (strict: no anonymous / forged fallback)
// ==========================================

/**
 * requireAuth: valid JWT required. Every data route is user scoped, so there is
 * deliberately no anonymous or "dev_token" passthrough anymore.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login with your Gmail account.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = verifyToken(token);
    const userId = parseInt(decoded.userId, 10);
    if (!userId || userId <= 0) {
      return res.status(401).json({ error: 'Invalid token payload. Please login again.' });
    }
    req.user = { id: userId, email: decoded.email || null, username: decoded.username || null };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

/** Public user shape returned by every auth endpoint (never leaks the hash). */
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    emailMasked: String(row.email || '').replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => `${a}${'*'.repeat(Math.max(b.length - 1, 1))}${b.slice(-1)}${c}`),
    username: row.username,
    displayName: row.display_name || row.username || row.email,
    role: 'user',
    avatar: row.avatar_data ? true : null,
    language: row.language || 'vi',
  };
}


const authRouter = Router();

// ==========================================
// ROUTES
// ==========================================

// POST /api/auth/register  { email, password, displayName? }
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, displayName, username } = req.body || {};
    const identity = canonicalizeGmail(email ?? username);

    if (!identity) {
      return res.status(400).json({
        error: 'Đăng ký chỉ hỗ trợ địa chỉ Gmail (@gmail.com). Ví dụ: tenban@gmail.com',
        code: 'GMAIL_REQUIRED',
      });
    }

    const cleanPassword = String(password ?? '').trim();
    if (cleanPassword.length < 4) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
    }
    if (cleanPassword.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu tối đa 128 ký tự.' });
    }

    const [existing] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [identity.email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Gmail này đã được đăng ký. Hãy đăng nhập.', code: 'EMAIL_TAKEN' });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_SALT_ROUNDS);
    const finalUsername = await deriveUniqueUsername(identity.local);
    const finalDisplayName = String(displayName ?? '').trim().slice(0, 100) || identity.local;

    const [result] = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name, language, auth_provider)
       VALUES (?, ?, ?, ?, 'vi', 'gmail')`,
      [identity.email, finalUsername, passwordHash, finalDisplayName]
    );

    // Every new account starts with its OWN private lore book (never shared).
    try {
      await ensureUserStarterWorld(result.insertId);
    } catch (seedErr) {
      console.warn('[Auth Register] Starter world seeding skipped:', seedErr.message);
    }

    const [rows] = await pool.query(`SELECT * FROM users WHERE id = ?`, [result.insertId]);
    const user = publicUser(rows[0]);

    res.status(201).json({ success: true, user, token: generateToken(user) });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// POST /api/auth/login  { email | username, password }
authRouter.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const rawIdentity = email ?? username;
    const pStr = String(password ?? '').trim();

    if (!rawIdentity || !pStr) {
      return res.status(400).json({ error: 'Vui lòng nhập Gmail và mật khẩu.' });
    }

    // Open-source quick test account: mapped onto its REAL db row (no forged dev token).
    const shortcut = String(rawIdentity).trim().toLowerCase();
    const isDevShortcut = (shortcut === '0' || shortcut === 'dev') && pStr === DEV_USER_PASSWORD;

    const identity = canonicalizeGmail(rawIdentity);
    const lookupEmail = isDevShortcut ? DEV_USER_EMAIL : identity?.email;

    let rows;
    if (lookupEmail) {
      [rows] = await pool.query(`SELECT * FROM users WHERE email = ? LIMIT 1`, [lookupEmail]);
    } else {
      [rows] = await pool.query(`SELECT * FROM users WHERE username = ? LIMIT 1`, [shortcut]);
    }

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Gmail hoặc mật khẩu không đúng.' });
    }

    const dbUser = rows[0];
    const passwordMatch = isDevShortcut || await bcrypt.compare(pStr, dbUser.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Gmail hoặc mật khẩu không đúng.' });
    }

    const user = publicUser(dbUser);
    res.json({ success: true, user, token: generateToken(user) });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out. Token discarded client-side.' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM users WHERE id = ? LIMIT 1`, [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/avatar
authRouter.get('/avatar', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT avatar_data FROM users WHERE id = ?', [req.user.id]);
    res.json({ avatar: rows[0]?.avatar_data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/avatar
authRouter.post('/avatar', requireAuth, async (req, res) => {
  try {
    const { avatar } = req.body || {};
    if (!avatar || !String(avatar).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid avatar format. Must be a data:image/... base64 string.' });
    }
    if (String(avatar).length > 2_800_000) {
      return res.status(400).json({ error: 'Avatar too large. Max ~2MB.' });
    }

    await pool.query('UPDATE users SET avatar_data = ? WHERE id = ?', [avatar, req.user.id]);
    res.json({ success: true, message: 'Avatar updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/language
authRouter.put('/language', requireAuth, async (req, res) => {
  try {
    const { language } = req.body || {};
    const validLangs = ['vi', 'en', 'zh', 'ko'];
    if (!validLangs.includes(language)) {
      return res.status(400).json({ error: `Invalid language. Must be one of: ${validLangs.join(', ')}` });
    }
    await pool.query('UPDATE users SET language = ? WHERE id = ?', [language, req.user.id]);
    res.json({ success: true, language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { authRouter };
