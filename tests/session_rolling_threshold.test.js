import { initDatabase, pool } from '../server/db.js';

async function runTests() {
  console.log('=== TEST SUITE: PERSIST ROLLING CONTEXT THRESHOLD PER SESSION ===\n');

  try {
    // 1. Initialize DB and verify column presence
    console.log('[TEST 1] Initializing Database & Verifying chat_sessions schema...');
    await initDatabase();

    const [columns] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'rolling_threshold'`
    );

    if (columns.length === 0) {
      throw new Error('FAILED: rolling_threshold column missing on chat_sessions table!');
    }
    console.log('✔ PASS: rolling_threshold column exists:', columns[0]);

    // 2. Create multiple sessions with distinct rolling thresholds
    console.log('\n[TEST 2] Creating sessions with custom rolling thresholds...');
    const session1Id = `test_sess_1_${Date.now()}`;
    const session2Id = `test_sess_2_${Date.now()}`;

    // Session 1 with 16,384 tokens
    await pool.query(
      `INSERT INTO chat_sessions (id, title, rolling_threshold) VALUES (?, ?, ?)`,
      [session1Id, 'Session One: 16k Context', 16384]
    );

    // Session 2 with 65,536 tokens
    await pool.query(
      `INSERT INTO chat_sessions (id, title, rolling_threshold) VALUES (?, ?, ?)`,
      [session2Id, 'Session Two: 64k Context', 65536]
    );

    // Session 3 with default threshold (32768)
    const session3Id = `test_sess_3_${Date.now()}`;
    await pool.query(
      `INSERT INTO chat_sessions (id, title) VALUES (?, ?)`,
      [session3Id, 'Session Three: Default Context']
    );

    // Verify fetched values
    const [fetched] = await pool.query(
      `SELECT id, title, rolling_threshold FROM chat_sessions WHERE id IN (?, ?, ?)`,
      [session1Id, session2Id, session3Id]
    );

    const s1 = fetched.find(s => s.id === session1Id);
    const s2 = fetched.find(s => s.id === session2Id);
    const s3 = fetched.find(s => s.id === session3Id);

    if (s1.rolling_threshold !== 16384) {
      throw new Error(`FAILED: Session 1 threshold expected 16384, got ${s1.rolling_threshold}`);
    }
    if (s2.rolling_threshold !== 65536) {
      throw new Error(`FAILED: Session 2 threshold expected 65536, got ${s2.rolling_threshold}`);
    }
    if (s3.rolling_threshold !== 32768) {
      throw new Error(`FAILED: Session 3 threshold expected default 32768, got ${s3.rolling_threshold}`);
    }
    console.log('✔ PASS: Sessions created with independent rolling thresholds:');
    console.log(`  - Session 1: ${s1.title} -> ${s1.rolling_threshold} tokens`);
    console.log(`  - Session 2: ${s2.title} -> ${s2.rolling_threshold} tokens`);
    console.log(`  - Session 3: ${s3.title} -> ${s3.rolling_threshold} tokens`);

    // 3. Update session threshold (simulating slider / preset change)
    console.log('\n[TEST 3] Updating session 1 threshold to 131,072 tokens...');
    await pool.query(
      `UPDATE chat_sessions SET rolling_threshold = ? WHERE id = ?`,
      [131072, session1Id]
    );

    const [updatedS1] = await pool.query(
      `SELECT rolling_threshold FROM chat_sessions WHERE id = ?`,
      [session1Id]
    );
    if (updatedS1[0].rolling_threshold !== 131072) {
      throw new Error(`FAILED: Session 1 updated threshold expected 131072, got ${updatedS1[0].rolling_threshold}`);
    }
    console.log('✔ PASS: Session 1 rolling_threshold updated to 131072 successfully.');

    // 4. Verify session isolation (session 2 & 3 remained intact)
    console.log('\n[TEST 4] Verifying session isolation...');
    const [checkIsolated] = await pool.query(
      `SELECT id, rolling_threshold FROM chat_sessions WHERE id IN (?, ?)`,
      [session2Id, session3Id]
    );
    const checkS2 = checkIsolated.find(s => s.id === session2Id);
    const checkS3 = checkIsolated.find(s => s.id === session3Id);
    if (checkS2.rolling_threshold !== 65536 || checkS3.rolling_threshold !== 32768) {
      throw new Error('FAILED: Session isolation compromised! Other sessions were affected.');
    }
    console.log('✔ PASS: Session 2 and Session 3 thresholds remained unchanged and isolated.');

    // Cleanup
    await pool.query(`DELETE FROM chat_sessions WHERE id IN (?, ?, ?)`, [session1Id, session2Id, session3Id]);
    console.log('\n✔ Cleanup test sessions completed.');

    console.log('\n======================================================');
    console.log('🎉 ALL PERSIST ROLLING CONTEXT THRESHOLD TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
