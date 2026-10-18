/**
 * TEST SUITE: LIVE EMERGENT ENTITY & WORLD STATE OVERLAY (ZERO-CACHE-INVALIDATION)
 *
 * Acceptance Criteria verified:
 *  1. Updating an entity's Live State immediately reflects in formattedContext and formatTier2Prompt on the very next turn.
 *  2. Updating an entity's Live State results in 0 L1/L2 cache invalidations (ragStats.payloadHits increments on subsequent turns).
 *  3. In-memory liveStateCache is populated without polluting payloadCache with transient states.
 *  4. Clearing Live State reverts the entity back to pure Base Canon.
 *  5. Cross-user ownership checks strictly reject unauthorized bookId state reads/writes (404).
 */

import assert from 'assert';
import http from 'http';
import { pool, initDatabase } from '../server/db.js';
import app from '../server/app.js';
import { generateToken } from '../server/auth.js';
import { RAGEngine, ragStats } from '../server/ragEngine.js';
import {
  bootstrapTestEnv,
  createGmailTestUser,
  teardownTestEnv,
  nextTestPort,
} from './helpers/testBootstrap.js';

const PORT = nextTestPort ? nextTestPort() : 5780;

async function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(PORT, () => resolve(server));
  });
}

async function request(path, { token, ...options } = {}) {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== TEST SUITE: LIVE STATE OVERLAY (ZERO-CACHE-INVALIDATION) ===\n');

  await initDatabase();
  const server = await startServer();

  let userA, userB;
  let bookAId, entryAId;

  try {
    // -------------------------------------------------------------
    // SETUP: Provision User A and User B
    // -------------------------------------------------------------
    console.log('[TEST 1] Setup isolated test users and canon lore');
    userA = await createGmailTestUser('liveA', { withStarterWorld: false });
    userB = await createGmailTestUser('liveB', { withStarterWorld: false });

    const tokenA = generateToken({ id: userA.userId, email: userA.email, username: userA.username });
    const tokenB = generateToken({ id: userB.userId, email: userB.email, username: userB.username });

    // Create a book for User A
    const [bookRes] = await pool.query(
      `INSERT INTO lore_books (user_id, title, description, language) VALUES (?, ?, ?, 'vi')`,
      [userA.userId, 'Đấu Phá Thương Khung Test Book', 'World container for Live State testing']
    );
    bookAId = bookRes.insertId;

    // Create Base Canon entry for Xiao Yan
    const [entryRes] = await pool.query(
      `INSERT INTO lore_entries (user_id, book_id, world_id, category, title, aliases, rules, content)
       VALUES (?, ?, ?, 'Character', ?, ?, ?, ?)`,
      [
        userA.userId,
        bookAId,
        String(bookAId),
        'Xiao Yan',
        'Viêm Đế, Tiêu Viêm, Kẻ Phá Kỷ Lục',
        'RULE: Cần dị hỏa để tiến cấp công pháp Phần Quyết. Không thể vi phạm giới hạn linh hồn.',
        'Thiên tài Tiêu gia thành Ô Thản, tu luyện Phần Quyết, sở hữu Huyền Trọng Xích và dị hỏa Thanh Liên Địa Tâm Hỏa.',
      ]
    );
    entryAId = entryRes.insertId;

    RAGEngine.invalidate({ userId: userA.userId, bookId: bookAId });
    RAGEngine.resetStats();

    console.log(`  ✓ Provisioned User A (${userA.userId}), Book (${bookAId}), Entry (${entryAId})`);

    // -------------------------------------------------------------
    // TURN 1: Cold start retrieval (Pure Base Canon)
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Turn 1: Cold start retrieval (L1/L2 Cache Miss)');
    const turn1 = await RAGEngine.retrieveLore({
      currentPrompt: 'Tiêu Viêm đang chuẩn bị luyện đan.',
      userId: userA.userId,
      bookId: bookAId,
    });

    assert.strictEqual(turn1.retrievedLore.length, 1, 'Should match Xiao Yan');
    assert.strictEqual(turn1.retrievedLore[0].title, 'Xiao Yan');
    assert.strictEqual(turn1.retrievedLore[0].liveState, undefined, 'Base canon has no liveState attached yet');
    assert.ok(!turn1.formattedContext.includes('[LIVE HEAD STATE'), 'Turn 1 context must not contain live state block');

    const tier2Turn1 = RAGEngine.formatTier2Prompt('Tiêu Viêm xuất chiêu.', turn1.retrievedLore);
    assert.ok(!tier2Turn1.includes('[NOW:'), 'Tier 2 prompt must not contain [NOW: ...]');
    assert.strictEqual(ragStats.payloadMisses, 1, 'Turn 1 should be a payload cache miss');
    assert.strictEqual(ragStats.payloadHits, 0, 'Turn 1 should have 0 payload hits');
    console.log('  ✓ Turn 1 successfully hydrated base canon without live state');

    // -------------------------------------------------------------
    // TURN 2: L2 Cache Hit (Payload Cache Baseline)
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Turn 2: Exact repeat prompt (L2 Cache Hit)');
    const turn2 = await RAGEngine.retrieveLore({
      currentPrompt: 'Tiêu Viêm đang chuẩn bị luyện đan.',
      userId: userA.userId,
      bookId: bookAId,
    });

    assert.strictEqual(turn2.retrievedLore.length, 1);
    assert.strictEqual(ragStats.payloadHits, 1, 'Turn 2 must be an L2 payloadCache HIT');
    console.log(`  ✓ Turn 2 hit L2 payloadCache (payloadHits=${ragStats.payloadHits})`);

    // -------------------------------------------------------------
    // MUTATION: Upsert Live State Delta (HEAD state)
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Mutate Live State via RAGEngine.upsertLiveState()');
    const liveDelta = {
      status_summary: 'Đấu Vương đỉnh phong, trọng thương tại Hắc Giác Vực',
      active_conditions: 'Mất đấu khí tạm thời, bị Hồn Điện truy nã',
      inventory_or_traits: 'Huyền Trọng Xích nứt gãy, Dược Lão linh hồn ngủ say',
      rules_override: 'Tuyệt đối không thể thi triển Đấu Khí Hóa Dực trong 7 ngày tới',
    };

    const savedState = await RAGEngine.upsertLiveState({
      userId: userA.userId,
      bookId: bookAId,
      entryId: entryAId,
      delta: liveDelta,
    });

    assert.strictEqual(savedState.entry_id, entryAId);
    assert.strictEqual(savedState.status_summary, liveDelta.status_summary);

    // Verify DB persistence in lore_live_states
    const [dbRows] = await pool.query(
      `SELECT status_summary, active_conditions, inventory_or_traits, rules_override FROM lore_live_states WHERE user_id = ? AND entry_id = ?`,
      [userA.userId, entryAId]
    );
    assert.strictEqual(dbRows.length, 1, 'lore_live_states must contain 1 row');
    assert.strictEqual(dbRows[0].status_summary, liveDelta.status_summary);
    assert.strictEqual(dbRows[0].rules_override, liveDelta.rules_override);
    console.log('  ✓ Live State persisted in MySQL and in-memory liveStateCache');

    // -------------------------------------------------------------
    // TURN 3: Zero-Cache-Invalidation Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Turn 3: Verify Zero-Cache-Invalidation & Live State Overlay');
    const payloadHitsBefore = ragStats.payloadHits;

    const turn3 = await RAGEngine.retrieveLore({
      currentPrompt: 'Tiêu Viêm đang chuẩn bị luyện đan.',
      userId: userA.userId,
      bookId: bookAId,
    });

    // 1. Zero Cache Invalidation: L2 payloadCache STILL HITS!
    assert.strictEqual(
      ragStats.payloadHits,
      payloadHitsBefore + 1,
      'CRITICAL: payloadHits MUST increment on Turn 3 (0 cache invalidations!)'
    );

    // 2. State delta overlaid in-memory
    assert.strictEqual(turn3.retrievedLore.length, 1);
    const entryWithOverlay = turn3.retrievedLore[0];
    assert.ok(entryWithOverlay.liveState, 'Retrieved entry must now have liveState attached');
    assert.strictEqual(entryWithOverlay.liveState.status_summary, liveDelta.status_summary);
    assert.strictEqual(entryWithOverlay.liveState.active_conditions, liveDelta.active_conditions);

    // 3. formatContextBlock injection
    assert.ok(
      turn3.formattedContext.includes('[LIVE HEAD STATE - OVERRIDES BASE CANON WHERE CONFLICTING]'),
      'formattedContext must contain prominent LIVE HEAD STATE header'
    );
    assert.ok(
      turn3.formattedContext.includes(`- Status: ${liveDelta.status_summary}`),
      'formattedContext must contain status summary'
    );
    assert.ok(
      turn3.formattedContext.includes(`- Active Conditions: ${liveDelta.active_conditions}`),
      'formattedContext must contain active conditions'
    );
    assert.ok(
      turn3.formattedContext.includes(`[PRIORITY RULES OVERRIDE]: ${liveDelta.rules_override}`),
      'formattedContext must merge rules_override with priority enforcement'
    );

    // 4. formatTier2Prompt one-liner injection
    const tier2Turn3 = RAGEngine.formatTier2Prompt('Tiêu Viêm quan sát xung quanh.', turn3.retrievedLore);
    assert.ok(
      tier2Turn3.includes(`[NOW: ${liveDelta.status_summary} | ${liveDelta.active_conditions}] ->`),
      'Tier 2 one-liner must append [NOW: status_summary | active_conditions] right before the -> arrow'
    );
    console.log('  ✓ L2 payloadCache hit preserved with 0 invalidations');
    console.log('  ✓ Live State overlay immediately reflected in formattedContext and formatTier2Prompt');

    // -------------------------------------------------------------
    // CLEAR LIVE STATE: Revert back to Pure Base Canon
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Revert entity to Base Canon via RAGEngine.clearLiveState()');
    await RAGEngine.clearLiveState({
      userId: userA.userId,
      bookId: bookAId,
      entryId: entryAId,
    });

    const [dbRowsAfterClear] = await pool.query(
      `SELECT id FROM lore_live_states WHERE user_id = ? AND entry_id = ?`,
      [userA.userId, entryAId]
    );
    assert.strictEqual(dbRowsAfterClear.length, 0, 'lore_live_states row must be deleted');

    const payloadHitsBeforeClear = ragStats.payloadHits;
    const turn4 = await RAGEngine.retrieveLore({
      currentPrompt: 'Tiêu Viêm đang chuẩn bị luyện đan.',
      userId: userA.userId,
      bookId: bookAId,
    });

    assert.strictEqual(
      ragStats.payloadHits,
      payloadHitsBeforeClear + 1,
      'payloadHits MUST still increment after clearing live state'
    );
    assert.strictEqual(turn4.retrievedLore[0].liveState, undefined, 'liveState must be undefined after clear');
    assert.ok(!turn4.formattedContext.includes('[LIVE HEAD STATE'), 'Context must be pure base canon again');
    console.log('  ✓ Reverted cleanly to Base Canon with 0 cache invalidation');

    // -------------------------------------------------------------
    // REST API ENDPOINTS & CROSS-USER SECURITY
    // -------------------------------------------------------------
    console.log('\n[TEST 7] REST API Endpoints & Cross-User Ownership Gates');

    // 1. User B tries to read User A's book states -> 404
    const getResB = await request(`/api/lore/${bookAId}/states`, { token: tokenB });
    assert.strictEqual(getResB.status, 404, 'User B cannot read User A book states (404 expected)');

    // 2. User B tries to mutate User A's entry state -> 404
    const putResB = await request(`/api/lore/${bookAId}/entries/${entryAId}/state`, {
      token: tokenB,
      method: 'PUT',
      body: JSON.stringify({ status_summary: 'Hacker state override' }),
    });
    assert.strictEqual(putResB.status, 404, 'User B cannot mutate User A entry state (404 expected)');

    // 3. User B tries to delete User A's entry state -> 404
    const delResB = await request(`/api/lore/${bookAId}/entries/${entryAId}/state`, {
      token: tokenB,
      method: 'DELETE',
    });
    assert.strictEqual(delResB.status, 404, 'User B cannot delete User A entry state (404 expected)');

    // 4. User A (owner) PUTs live state via REST API -> 200
    const putResA = await request(`/api/lore/${bookAId}/entries/${entryAId}/state`, {
      token: tokenA,
      method: 'PUT',
      body: JSON.stringify({
        status_summary: 'API Update: Đấu Tôn, Dược Lão thức tỉnh',
        active_conditions: 'Có dị hỏa mới: Cốt Lãnh Lôi Hỏa',
        inventory_or_traits: 'Đan dược cấp 7',
        rules_override: 'Công pháp Phần Quyết tiến cấp Địa Giai Trung Cấp',
      }),
    });
    assert.strictEqual(putResA.status, 200);
    assert.strictEqual(putResA.data.success, true);
    assert.strictEqual(putResA.data.state.status_summary, 'API Update: Đấu Tôn, Dược Lão thức tỉnh');

    // 5. User A GETs active states -> 200 (array containing the active state)
    const getResA = await request(`/api/lore/${bookAId}/states`, { token: tokenA });
    assert.strictEqual(getResA.status, 200);
    assert.ok(Array.isArray(getResA.data));
    assert.strictEqual(getResA.data.length, 1);
    assert.strictEqual(getResA.data[0].status_summary, 'API Update: Đấu Tôn, Dược Lão thức tỉnh');

    // 6. User A DELETEs live state -> 200
    const delResA = await request(`/api/lore/${bookAId}/entries/${entryAId}/state`, {
      token: tokenA,
      method: 'DELETE',
    });
    assert.strictEqual(delResA.status, 200);
    assert.strictEqual(delResA.data.success, true);

    const getResAAfterDel = await request(`/api/lore/${bookAId}/states`, { token: tokenA });
    assert.strictEqual(getResAAfterDel.data.length, 0, 'Active states should now be empty');
    console.log('  ✓ Cross-user security strictly enforced (User B rejected with 404)');
    console.log('  ✓ GET, PUT, DELETE REST API endpoints functioning accurately');

    console.log('\n=== ALL LIVE STATE TESTS PASSED SUCCESSFULLY! ===\n');
    server.close();
    if (userA || userB) {
      await teardownTestEnv([userA?.userId, userB?.userId].filter(Boolean));
    }
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    server.close();
    if (userA || userB) {
      await teardownTestEnv([userA?.userId, userB?.userId].filter(Boolean));
    }
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
