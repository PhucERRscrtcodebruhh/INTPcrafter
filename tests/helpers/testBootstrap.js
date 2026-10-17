/**
 * TEST BOOTSTRAP — the equivalent of a `beforeAll()` hook for this project's plain-node
 * test scripts (no Jest, no Prisma). Every suite that touches the DB should start with:
 *
 *   import { bootstrapTestEnv, createGmailTestUser, seedDummyLore, teardownTestEnv } from './helpers/testBootstrap.js';
 *   const env = await bootstrapTestEnv();               // schema + dev account + starter world
 *   const { token, userId, bookId } = await createGmailTestUser();  // throwaway Gmail account
 *   const loreIds = await seedDummyLore(userId, bookId, 6);         // dummy canon for RAG tests
 *   ...
 *   await teardownTestEnv([userId]);                    // FK cascade removes all their data
 */
import bcrypt from 'bcryptjs';
import { pool, initDatabase, ensureUserStarterWorld, DEV_USER_EMAIL, DEV_USER_PASSWORD, STARTER_BOOK } from '../../server/db.js';
import { RAGEngine } from '../../server/ragEngine.js';
import { seedDevAccount, seedDemoWorld } from '../../server/seed.js';

let basePort = 5620 + (process.pid % 200);

/**
 * Provisions the schema and guarantees the dev account + its starter world exist.
 * @returns {Promise<{devUserId:number, devBookId:number, devEmail:string, devPassword:string}>}
 */
export async function bootstrapTestEnv() {
  await initDatabase();

  const devUserId = await seedDevAccount();
  const devBookId = await ensureUserStarterWorld(devUserId);
  RAGEngine.invalidate({ userId: devUserId, bookId: devBookId });

  return { devUserId, devBookId, devEmail: DEV_USER_EMAIL, devPassword: DEV_USER_PASSWORD, starterBookTitle: STARTER_BOOK.title };
}

/** Registers a unique throwaway Gmail account straight against the DB (bcrypt-hashed). */
export async function createGmailTestUser(label = 'user', { withStarterWorld = true } = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `seed.${label}.${stamp}@gmail.com`;
  const username = `seed_${label}_${stamp}`;
  const hash = await bcrypt.hash('1234', 10);

  const [created] = await pool.query(
    `INSERT INTO users (email, username, password_hash, display_name, language, auth_provider)
     VALUES (?, ?, ?, ?, 'vi', 'gmail')`,
    [email, username, hash, `Seed ${label}`]
  );

  const userId = created.insertId;
  let bookId;

  if (withStarterWorld) {
    bookId = await ensureUserStarterWorld(userId);
  } else {
    // Bare owned world (no starter canon) so suites can control their exact entry set.
    const [book] = await pool.query(
      `INSERT INTO lore_books (user_id, title, description, language) VALUES (?, ?, ?, 'vi')`,
      [userId, `Test World (${label})`, 'Isolated fixture world without starter canon.']
    );
    bookId = book.insertId;
  }

  RAGEngine.invalidate({ userId, bookId });

  return { userId, bookId, email, username, password: '1234' };
}

/** Inserts `count` deterministic dummy lore entries into one owned book. */
export async function seedDummyLore(userId, bookId, count = 6) {
  const ids = [];
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(2, '0');
    const [row] = await pool.query(
      `INSERT INTO lore_entries (user_id, book_id, world_id, category, title, aliases, rules, content)
       VALUES (?, ?, ?, 'Character', ?, ?, ?, ?)`,
      [
        userId,
        bookId,
        String(bookId),
        `Seed Hero ${n}`,
        `Hero${n}, The ${n}th Vanguard`,
        `RULE: Seed Hero ${n} cannot break the fixture invariants.`,
        `Seed Hero ${n} is a test fixture guarding archive segment ${n} of the seeded world.`,
      ]
    );
    ids.push(row.insertId);
  }
  RAGEngine.invalidate({ userId, bookId });
  return ids;
}

/** Demo world using the production seeder (same code path as `npm run seed`). */
export async function seedDemoWorldFor(email, loreCount = 8) {
  return seedDemoWorld(email, loreCount);
}

/** Removes throwaway accounts (FK cascade wipes their books, lore, sessions, messages). */
export async function teardownTestEnv(userIds = []) {
  for (const id of userIds) {
    await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
  }
  RAGEngine.invalidate();
}

/** Allocates a distinct port per process so parallel suites never clash. */
export function nextTestPort() {
  basePort += 1;
  return basePort;
}

/** Minimal HTTP helper with bearer-token support (matches the suites' existing shape). */
export async function apiRequest(port, path, { token, ...options } = {}) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

export { pool, RAGEngine };
