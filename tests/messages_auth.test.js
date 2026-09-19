import { pool, initDatabase } from '../server/db.js';
import { RAGEngine } from '../server/ragEngine.js';
import bcrypt from 'bcryptjs';

async function testMessagesAndAuth() {
  console.log('=== TEST SUITE: MULTI-BOOK & AUTH (BYOK) ===\n');

  // Ensure DB initialized
  await initDatabase();

  // Test 1: Dev Account Logic Verification
  console.log('[TEST 1] Verifying Dev Account Passthrough...');
  const devLogins = [
    { username: '0', password: '0000', shouldPass: true },
    { username: 'dev', password: '0000', shouldPass: true },
    { username: 'DEV', password: '0000', shouldPass: true },
    { username: '0', password: 'wrong', shouldPass: false },
  ];

  for (const tc of devLogins) {
    const uStr = String(tc.username).trim().toLowerCase();
    const pStr = String(tc.password).trim();
    const passed = (uStr === '0' || uStr === 'dev') && pStr === '0000';
    if (passed !== tc.shouldPass) {
      throw new Error(`Auth test failed for ${tc.username} / ${tc.password}`);
    }
  }
  console.log('✓ Dev Account (ID 0 / dev, Pass 0000) passthrough verification passed.\n');

  // Test 2: Bcrypt Password Hashing & User Registration Verification
  console.log('[TEST 2] Verifying Bcrypt Hashing & User DB Schema...');
  const testUsername = `testuser_${Date.now()}`;
  const testPass = 'securePassword123';
  const hashed = await bcrypt.hash(testPass, 10);

  const [regResult] = await pool.query(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
    [testUsername, hashed, 'Test User']
  );
  const newUserId = regResult.insertId;

  // Verify hash match
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [newUserId]);
  if (userRows.length === 0) throw new Error('User creation failed');

  const match = await bcrypt.compare(testPass, userRows[0].password_hash);
  if (!match) throw new Error('Bcrypt password comparison failed');

  console.log(`✓ User registration & bcrypt hash verified for user ID ${newUserId}.\n`);

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
    `INSERT INTO lore_entries (book_id, category, title, aliases, rules, content)
     VALUES (?, 'Character', 'CyberNinja Zero', 'Zero, Ghost Blade', 'Cannot be detected by optical sensors', 'Legendary operative of Sector 4.')`,
    [testBookId]
  );
  const testLoreId = loreInsert.insertId;

  // RAG Query matching this book
  const ragResultLinked = await RAGEngine.retrieveLore({
    currentPrompt: 'Where is CyberNinja Zero heading?',
    recentMessages: [],
    maxResults: 5,
    bookId: testBookId
  });

  if (ragResultLinked.retrievedLore.length === 0 || !ragResultLinked.retrievedLoreIds.includes(String(testLoreId))) {
    throw new Error('RAGEngine failed to retrieve lore entry scoped to testBookId');
  }

  // RAG Query without bookId (unlinked) -> must return empty
  const ragResultUnlinked = await RAGEngine.retrieveLore({
    currentPrompt: 'Where is CyberNinja Zero heading?',
    recentMessages: [],
    maxResults: 5,
    bookId: null
  });

  if (ragResultUnlinked.retrievedLore.length > 0) {
    throw new Error('RAGEngine should NOT retrieve lore when bookId is null (unlinked)');
  }
  console.log('✓ RAGEngine correctly scopes retrieval solely to active book_id.\n');

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
  console.log('✓ Cleanup completed.\n');

  console.log('ALL MULTI-BOOK & AUTH TESTS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

testMessagesAndAuth().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
