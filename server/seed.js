/**
 * SEED SCRIPT — provisions the schema, the dev Gmail account and (optionally) a demo
 * world with dummy lore entries for any Gmail account.
 *
 * Usage:
 *   node server/seed.js                          -> schema + dev@gmail.com + starter world
 *   node server/seed.js writer@gmail.com         -> also gives that account a demo world
 *   node server/seed.js writer@gmail.com 12      -> demo world with 12 generated lore entries
 *
 * Idempotent: safe to run many times (nothing is duplicated).
 */
import bcrypt from 'bcryptjs';
import { pool, initDatabase, ensureUserStarterWorld, DEV_USER_EMAIL, DEV_USER_PASSWORD } from './db.js';

const DEMO_CATEGORIES = ['Character', 'MagicSystem', 'Location', 'Faction', 'Event', 'General'];

function buildDemoLore(index) {
  const n = String(index).padStart(2, '0');
  const category = DEMO_CATEGORIES[index % DEMO_CATEGORIES.length];
  return {
    category,
    title: `Seed Entity ${n}`,
    aliases: `Sigil${n}, The ${n}th Echo`,
    content: `Seed Entity ${n} is a deterministic fixture used to validate retrieval, ranking and cache behaviour. It answers only to the sigil Sigil${n} and guards archive segment ${n}.`,
    rules: `RULE: Seed Entity ${n} cannot leave archive segment ${n} while its resonance anchor holds.`,
  };
}

/**
 * Creates (or reuses) a demo world for one Gmail account and fills it with dummy lore.
 * @param {string} email
 * @param {number} loreCount
 */
export async function seedDemoWorld(email, loreCount = 8) {
  const cleanEmail = String(email).trim().toLowerCase();
  const [users] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [cleanEmail]);
  if (users.length === 0) {
    throw new Error(`No account found for ${cleanEmail}. Register it first, then re-run the seeder.`);
  }
  const userId = users[0].id;

  const worldTitle = `Seed Demo World (${cleanEmail})`;
  let [books] = await pool.query(`SELECT id FROM lore_books WHERE user_id = ? AND title = ? LIMIT 1`, [userId, worldTitle]);
  let bookId = books[0]?.id;

  if (!bookId) {
    const [created] = await pool.query(
      `INSERT INTO lore_books (user_id, title, description, system_instruction, language)
       VALUES (?, ?, ?, ?, 'vi')`,
      [userId, worldTitle, 'Auto-generated demo world for RAG tests.', 'RULE: demo invariants only.']
    );
    bookId = created.insertId;
  }

  const [existing] = await pool.query(`SELECT COUNT(*) AS total FROM lore_entries WHERE user_id = ? AND book_id = ?`, [userId, bookId]);
  let inserted = 0;

  if (existing[0].total < loreCount) {
    for (let i = existing[0].total + 1; i <= loreCount; i++) {
      const entry = buildDemoLore(i);
      await pool.query(
        `INSERT INTO lore_entries (user_id, book_id, world_id, category, title, aliases, rules, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, bookId, String(bookId), entry.category, entry.title, entry.aliases, entry.rules, entry.content]
      );
      inserted += 1;
    }
  }

  console.log(`[SEED] ${cleanEmail}: demo world ${bookId} ready (lore entries: ${existing[0].total} existing, ${inserted} inserted).`);
  return { userId, bookId, inserted };
}

/** Creates the dev Gmail account if it does not exist yet and returns its id. */
export async function seedDevAccount() {
  const [rows] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [DEV_USER_EMAIL]);
  if (rows.length > 0) return rows[0].id;

  const hash = await bcrypt.hash(DEV_USER_PASSWORD, 10);
  const [created] = await pool.query(
    `INSERT INTO users (email, username, password_hash, display_name, language, auth_provider)
     VALUES (?, 'dev', ?, 'INTP Dev Architect', 'vi', 'local')`,
    [DEV_USER_EMAIL, hash]
  );
  console.log(`[SEED] Dev account created: ${DEV_USER_EMAIL} / ${DEV_USER_PASSWORD}`);
  return created.insertId;
}

async function main() {
  const email = process.argv[2] || null;
  const loreCount = parseInt(process.argv[3] || '8', 10) || 8;

  console.log('=== STORYCONTAINER SEED ===');
  await initDatabase();

  const devUserId = await seedDevAccount();
  await ensureUserStarterWorld(devUserId);
  console.log(`[SEED] ${DEV_USER_EMAIL}: starter world ready (user ${devUserId}).`);

  if (email) {
    await seedDemoWorld(email, loreCount);
  } else {
    console.log('[SEED] Tip: pass a Gmail address to also create a demo world, e.g. `node server/seed.js me@gmail.com 12`.');
  }

  console.log('=== SEED COMPLETED ===');
  await pool.end();
  process.exit(0);
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/seed.js');
if (isDirectRun) {
  main().catch(async (err) => {
    console.error('[SEED] FAILED:', err);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  });
}
