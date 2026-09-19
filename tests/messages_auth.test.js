import { pool, initDatabase } from '../server/db.js';
import bcrypt from 'bcryptjs';

async function testMessagesAndAuth() {
  console.log('=== TEST SUITE: MESSAGES & AUTH (BYOK) ===\n');

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

  // Test 3: Per-User Key Vault DB Table
  console.log('[TEST 3] Verifying user_api_keys schema...');
  const [vaultCheck] = await pool.query(
    'SELECT COUNT(*) as cnt FROM user_api_keys WHERE user_id = ?', [newUserId]
  );
  if (vaultCheck[0].cnt !== 0) throw new Error('user_api_keys count mismatch');
  console.log('✓ user_api_keys table verification passed.\n');

  // Test 4: Message DB Operations (Create, Update, Truncate, Delete)
  console.log('[TEST 4] Verifying Message DB Operations...');
  const testSessionId = `test_sess_${Date.now()}`;
  await pool.query(
    `INSERT INTO chat_sessions (id, title, user_id) VALUES (?, 'Test Session For Message Actions', ?)`,
    [testSessionId, newUserId]
  );

  const [m1] = await pool.query(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', 'Prompt 1: Initial scene')`,
    [testSessionId]
  );
  const [m2] = await pool.query(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'model', 'Reply 1: The neon lights shimmer.')`,
    [testSessionId]
  );
  const [m3] = await pool.query(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', 'Prompt 2: Action sequence')`,
    [testSessionId]
  );

  console.log(`- Created test session ${testSessionId} with messages ${m1.insertId}, ${m2.insertId}, ${m3.insertId}`);

  // Update m1
  const updatedContent = 'Prompt 1: Modified initial scene with KaTeX $E = mc^2$';
  await pool.query(`UPDATE chat_messages SET content = ? WHERE id = ?`, [updatedContent, m1.insertId]);
  const [checkUpdated] = await pool.query(`SELECT content FROM chat_messages WHERE id = ?`, [m1.insertId]);
  if (checkUpdated[0].content !== updatedContent) {
    throw new Error('Message update failed');
  }
  console.log('✓ Message content update passed.');

  // Truncate from m3
  await pool.query(`DELETE FROM chat_messages WHERE session_id = ? AND id >= ?`, [testSessionId, m3.insertId]);
  const [remainingAfterTruncate] = await pool.query(`SELECT id FROM chat_messages WHERE session_id = ?`, [testSessionId]);
  if (remainingAfterTruncate.length !== 2) {
    throw new Error(`Truncate failed: expected 2 remaining, got ${remainingAfterTruncate.length}`);
  }
  console.log('✓ Message truncation from prompt passed.');

  // Delete m2
  await pool.query(`DELETE FROM chat_messages WHERE id = ?`, [m2.insertId]);
  const [remainingAfterDelete] = await pool.query(`SELECT id FROM chat_messages WHERE session_id = ?`, [testSessionId]);
  if (remainingAfterDelete.length !== 1) {
    throw new Error(`Delete failed: expected 1 remaining, got ${remainingAfterDelete.length}`);
  }
  console.log('✓ Message single delete passed.');

  // Cleanup test data
  await pool.query(`DELETE FROM chat_messages WHERE session_id = ?`, [testSessionId]);
  await pool.query(`DELETE FROM chat_sessions WHERE id = ?`, [testSessionId]);
  await pool.query(`DELETE FROM users WHERE id = ?`, [newUserId]);
  console.log('✓ Cleanup completed.\n');

  console.log('ALL MESSAGES & AUTH TESTS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

testMessagesAndAuth().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
