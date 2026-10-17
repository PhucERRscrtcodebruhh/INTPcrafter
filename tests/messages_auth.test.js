import { pool, initDatabase } from '../server/db.js';
import { RAGEngine } from '../server/ragEngine.js';
import bcrypt from 'bcryptjs';

async function testMessagesAndAuth() {
  console.log('=== TEST SUITE: MULTI-BOOK & AUTH (BYOK) ===\n');

  // Ensure DB initialized
  await initDatabase();

  // Test 1: Dev account is a REAL user row (no forged dev_token passthrough anymore)
  console.log('[TEST 1] Verifying Dev Account is a real, bcrypt-backed DB row...');
  const [devAccounts] = await pool.query(`SELECT id, email, password_hash FROM users WHERE email = 'dev@gmail.com'`);
  if (devAccounts.length === 0) throw new Error('Dev account dev@gmail.com was not seeded');
  const devPasswordMatch = await bcrypt.compare('0000', devAccounts[0].password_hash);
  if (!devPasswordMatch) throw new Error('Dev account quick-login password must be bcrypt("0000")');
  if (devAccounts[0].id <= 0) throw new Error('Dev account must own a real positive user id (never id 0)');
  console.log(`✓ Dev account verified (id=${devAccounts[0].id}, bcrypt hash of "0000", real DB row).\n`);

  // Test 2: Bcrypt Password Hashing & Gmail User Registration Verification
  console.log('[TEST 2] Verifying Bcrypt Hashing & Gmail user schema...');
  const testEmail = `testuser_${Date.now()}@gmail.com`;
  const testUsername = `testuser_${Date.now()}`;
  const testPass = 'securePassword123';
  const hashed = await bcrypt.hash(testPass, 10);

  const [regResult] = await pool.query(
    'INSERT INTO users (email, username, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [testEmail, testUsername, hashed, 'Test User']
  );
  const newUserId = regResult.insertId;

  // Verify hash match
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [newUserId]);
  if (userRows.length === 0) throw new Error('User creation failed');

  const match = await bcrypt.compare(testPass, userRows[0].password_hash);
  if (!match) throw new Error('Bcrypt password comparison failed');

  console.log(`✓ User registration & bcrypt hash verified for user ID ${newUserId}.\n`);

  // Test 2b: a legacy row WITHOUT email must be insertable (email is nullable, never defaulted)
  console.log('[TEST 2b] Verifying legacy users without email are accepted...');
  const legacyUsername = `legacy_${Date.now()}`;
  const [legacyRes] = await pool.query(
    'INSERT INTO users (username, password_hash, display_name, auth_provider) VALUES (?, ?, ?, ?)',
    [legacyUsername, await bcrypt.hash('legacyPass', 10), 'Legacy Account', 'local']
  );
  const legacyUserId = legacyRes.insertId;

  const [legacyRows] = await pool.query('SELECT email, username FROM users WHERE id = ?', [legacyUserId]);
  if (legacyRows.length === 0 || legacyRows[0].email !== null) {
    throw new Error('Legacy user without email must be insertable with email = NULL');
  }
  console.log(`✓ Legacy user without email accepted (id=${legacyUserId}, email=NULL) — no default-value error.\n`);

  // Test 3: Multi-World lore_books Schema & CRUD
  console.log('[TEST 3] Verifying lore_books & System Instruction...');
  const [bookInsert] = await pool.query(
    `INSERT INTO lore_books (user_id, title, description, system_instruction, language)
     VALUES (?, 'Cyberpunk 2099 Test World', 'Neon dystopia and cybernetics', 'RULE: All tech requires battery', 'vi')`,
    [newUserId]
  );
  const testBookId = bookInsert.insertId;

  const [bookRows] = await pool.query(`SELECT * FROM lore_books WHERE id = ?`, [testBookId]);
  if (bookRows.length === 0 || !bookRows[0].system_instruction.includes('battery')) {
    throw new Error('lore_books insertion or system_instruction verification failed');
  }
  console.log(`✓ lore_books schema & system_instruction verified for Book ID ${testBookId}.\n`);

  // Test 4: Lore Entries with book_id & RAGEngine Scoping
  console.log('[TEST 4] Verifying Lore Entries with book_id & RAGEngine filtering...');
  const [loreInsert] = await pool.query(
    `INSERT INTO lore_entries (user_id, book_id, world_id, category, title, aliases, rules, content)
     VALUES (?, ?, ?, 'Character', 'CyberNinja Zero', 'Zero, Ghost Blade', 'Cannot be detected by optical sensors', 'Legendary operative of Sector 4.')`,
    [newUserId, testBookId, String(testBookId)]
  );
  const testLoreId = loreInsert.insertId;

  // RAG Query matching this book (user + book scope required)
  const ragResultLinked = await RAGEngine.retrieveLore({
    currentPrompt: 'Where is CyberNinja Zero heading?',
    recentMessages: [],
    maxResults: 5,
    bookId: testBookId,
    userId: newUserId
  });

  if (ragResultLinked.retrievedLore.length === 0 || !ragResultLinked.retrievedLoreIds.includes(String(testLoreId))) {
    throw new Error('RAGEngine failed to retrieve lore entry scoped to testBookId');
  }

  // RAG Query without userId/bookId -> must refuse (no default scope)
  const ragResultUnlinked = await RAGEngine.retrieveLore({
    currentPrompt: 'Where is CyberNinja Zero heading?',
    recentMessages: [],
    maxResults: 5,
    bookId: null
  });

  if (ragResultUnlinked.retrievedLore.length > 0 || ragResultUnlinked.reason !== 'missing_scope') {
    throw new Error('RAGEngine must NOT retrieve lore when the user/book scope is missing');
  }

  // RAG Query bound to book but for another user -> refused as well
  const ragResultForeign = await RAGEngine.retrieveLore({
    currentPrompt: 'Where is CyberNinja Zero heading?',
    recentMessages: [],
    maxResults: 5,
    bookId: testBookId,
    userId: 999999
  });

  if (ragResultForeign.retrievedLore.length > 0 || ragResultForeign.reason !== 'book_not_owned') {
    throw new Error('RAGEngine must refuse a book that belongs to another user');
  }
  console.log('✓ RAGEngine scopes retrieval to (user_id, book_id) and refuses foreign scopes.\n');

  // Test 5: Chat Session with book_id Binding
  console.log('[TEST 5] Verifying Chat Session book_id Binding...');
  const testSessionId = `test_sess_${Date.now()}`;
  await pool.query(
    `INSERT INTO chat_sessions (id, title, user_id, book_id) VALUES (?, 'Test Chronicle', ?, ?)`,
    [testSessionId, newUserId, testBookId]
  );

  const [sessCheck] = await pool.query(
    `SELECT s.*, b.title as book_title, b.system_instruction as book_instruction
     FROM chat_sessions s
     LEFT JOIN lore_books b ON s.book_id = b.id
     WHERE s.id = ?`,
    [testSessionId]
  );

  if (sessCheck.length === 0 || sessCheck[0].book_id !== testBookId || !sessCheck[0].book_title) {
    throw new Error('Chat session book_id binding verification failed');
  }
  console.log(`✓ Session successfully bound to World "${sessCheck[0].book_title}".\n`);

  // Cleanup test data
  await pool.query(`DELETE FROM chat_messages WHERE session_id = ?`, [testSessionId]);
  await pool.query(`DELETE FROM chat_sessions WHERE id = ?`, [testSessionId]);
  await pool.query(`DELETE FROM lore_entries WHERE id = ?`, [testLoreId]);
  await pool.query(`DELETE FROM lore_books WHERE id = ?`, [testBookId]);
  await pool.query(`DELETE FROM users WHERE id = ?`, [newUserId]);
  await pool.query(`DELETE FROM users WHERE id = ?`, [legacyUserId]);
  console.log('✓ Cleanup completed.\n');

  console.log('ALL MULTI-BOOK & AUTH TESTS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

testMessagesAndAuth().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
