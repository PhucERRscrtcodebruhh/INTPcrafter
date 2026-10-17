/**
 * TEST SUITE: GMAIL REGISTRATION + FULL USER SCOPE + RAG CACHE HIT RATE
 * Chạy: node tests/gmail_scope_rag.test.js
 *
 * Tiêu chí được kiểm chứng:
 *  1. RAG đúng chỗ (không dump toàn bộ lorebook)
 *  2. Cache hit > 80%
 *  3. User scope đầy đủ (mọi bảng + mọi endpoint)
 *  4. Đăng ký theo Gmail (@gmail.com), chống trùng bằng canonical hoá Gmail
 */
import assert from 'assert';
import http from 'http';
import { pool, initDatabase } from '../server/db.js';
import app from '../server/app.js';
import { RAGEngine } from '../server/ragEngine.js';
import { bootstrapTestEnv, createGmailTestUser, seedDummyLore, teardownTestEnv, nextTestPort } from './helpers/testBootstrap.js';

const PORT = nextTestPort();

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
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

const stamp = Date.now();
const emailA = `scope.a.${stamp}@gmail.com`;
const emailB = `scope.b.${stamp}@gmail.com`;
// The engine stores the canonical Gmail identity (local-part dots/+tags stripped).
const canonicalize = (email) => {
  const [local] = String(email).toLowerCase().split('@');
  return `${local.replace(/\+.*$/, '').replace(/\./g, '')}@gmail.com`;
};
const canonicalA = canonicalize(emailA);
const canonicalB = canonicalize(emailB);

async function runTests() {
  console.log('=== TEST SUITE: GMAIL SCOPE + RAG PRECISION/CACHE ===\n');
  await initDatabase();
  const server = await startServer();
  const createdUsers = [];

  try {
    // ---------------- 0. TEST BOOTSTRAP (beforeAll equivalent) ----------------
    console.log('[TEST 0] Bootstrapping test fixture (schema + dev account + dummy lore)');
    const env = await bootstrapTestEnv();
    assert.ok(env.devUserId > 0 && env.devBookId > 0, 'Bootstrap must provision a dev account and starter world');
    console.log(`  ✓ Bootstrap ready: dev user ${env.devUserId}, starter book ${env.devBookId} "${env.starterBookTitle}"`);

    const fixture = await createGmailTestUser('fixture');
    createdUsers.push(fixture.userId);
    const dummyIds = await seedDummyLore(fixture.userId, fixture.bookId, 6);
    assert.strictEqual(dummyIds.length, 6, 'Seeder must insert the requested dummy lore entries');

    const [dummyRows] = await pool.query(`SELECT COUNT(*) AS total FROM lore_entries WHERE user_id = ? AND book_id = ?`, [fixture.userId, fixture.bookId]);
    assert.ok(dummyRows[0].total >= 6, 'Dummy lore must be readable right after seeding');

    const seededHit = await RAGEngine.retrieveLore({
      currentPrompt: 'Seed Hero 03 guards archive segment 03.',
      bookId: fixture.bookId,
      userId: fixture.userId,
    });
    assert.ok(seededHit.retrievedLore.some(l => l.title === 'Seed Hero 03'), 'Seeded dummy lore must be retrievable by RAG');
    console.log(`  ✓ Seeded 6 dummy entries + starter world for ${fixture.email}; RAG retrieved "${seededHit.retrievedLore[0].title}" (${seededHit.retrievedLore[0].matchReason})`);

    // ---------------- 4. GMAIL REGISTRATION ----------------
    console.log('[TEST 1] Gmail-only registration');
    const notGmail = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `user.${stamp}@yahoo.com`, password: '1234' }),
    });
    assert.strictEqual(notGmail.status, 400, 'Non-gmail domain must be rejected');
    assert.strictEqual(notGmail.data.code, 'GMAIL_REQUIRED');
    console.log('  ✓ Non-Gmail domain rejected (400 GMAIL_REQUIRED)');

    const regA = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: '1234', displayName: 'Author A' }),
    });
    assert.strictEqual(regA.status, 201, `Register A failed: ${JSON.stringify(regA.data)}`);
    assert.ok(regA.data.token, 'Register must return a JWT');
    assert.strictEqual(regA.data.user.email, canonicalA, 'Stored identity must be the canonical Gmail address');
    createdUsers.push(regA.data.user.id);
    console.log(`  ✓ Registered ${emailA} (id=${regA.data.user.id}) with JWT`);

    const regB = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: emailB, password: '1234' }),
    });
    assert.strictEqual(regB.status, 201);
    createdUsers.push(regB.data.user.id);
    console.log(`  ✓ Registered ${emailB} (id=${regB.data.user.id})`);

    const dup = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: '1234' }),
    });
    assert.strictEqual(dup.status, 409, 'Duplicate Gmail must map to 409');
    console.log('  ✓ Duplicate Gmail rejected (409)');

    // Gmail treats dots and +tags as aliases of the same mailbox -> must not fork accounts.
    const alias1 = canonicalA;                                       // dots removed
    const alias2 = emailA.replace('@gmail.com', '+promo@gmail.com'); // +tag added
    for (const [label, candidate] of [['dots removed', alias1], ['plus-tag', alias2]]) {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: candidate, password: '1234' }),
      });
      assert.strictEqual(res.status, 409, `Gmail alias (${label}) must map onto the existing account`);
    }
    console.log('  ✓ Gmail canonicalisation blocks dot/plus-tag duplicate accounts');

    const tokenA = regA.data.token;
    const tokenB = regB.data.token;

    const loginA = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA.toUpperCase(), password: '1234' }),
    });
    assert.strictEqual(loginA.status, 200, 'Login by Gmail (case-insensitive) must work');
    console.log('  ✓ Login by Gmail works (case insensitive)');

    // ---------------- 3. FULL USER SCOPE ----------------
    console.log('\n[TEST 2] User scope enforcement');
    const anon = await request('/api/lore');
    assert.strictEqual(anon.status, 401, 'Anonymous access must be rejected');
    const anonSessions = await request('/api/sessions');
    assert.strictEqual(anonSessions.status, 401);
    const anonBooks = await request('/api/books');
    assert.strictEqual(anonBooks.status, 401);
    console.log('  ✓ /api/lore, /api/sessions, /api/books all require auth (401)');

    const booksA = await request('/api/books', { token: tokenA });
    assert.strictEqual(booksA.status, 200);
    assert.ok(booksA.data.length >= 1, 'Starter book must exist for a new Gmail account');
    assert.ok(booksA.data.every(b => b.user_id === regA.data.user.id), 'Only own books are returned');
    const bookA = booksA.data[0];
    console.log(`  ✓ User A sees only own books (${booksA.data.length}) — starter: "${bookA.title}"`);

    const booksB = await request('/api/books', { token: tokenB });
    assert.ok(booksB.data.every(b => b.user_id === regB.data.user.id), 'User B must not see A books');
    assert.ok(!booksB.data.some(b => b.id === bookA.id), 'User B cannot see A starter book');
    console.log('  ✓ User B cannot see any of User A books');

    const entriesCross = await request(`/api/books/${bookA.id}/entries`, { token: tokenB });
    assert.strictEqual(entriesCross.status, 404, 'Cross-user lore listing must 404');
    console.log('  ✓ GET /api/books/:idOfA/entries as B -> 404');

    const entriesOwn = await request(`/api/books/${bookA.id}/entries`, { token: tokenA });
    assert.strictEqual(entriesOwn.status, 200);
    assert.ok(entriesOwn.data.length >= 4, 'Starter world must include seeded lore');
    console.log(`  ✓ Owner reads own entries (${entriesOwn.data.length} seeded)`);

    // Array aliases must be stored canonically as CSV (JSON arrays used to break matching).
    const created = await request('/api/lore', {
      token: tokenA,
      method: 'POST',
      body: JSON.stringify({
        book_id: bookA.id,
        category: 'Character',
        title: 'Nyra Solace',
        aliases: ['Nyra', 'The Void Cartographer'],
        content: 'Navigates collapsed dimensions with a fractured compass.',
        rules: 'RULE: cannot survive more than 10 minutes outside a dimension anchor.',
      }),
    });
    assert.strictEqual(created.status, 201, `Create lore failed: ${JSON.stringify(created.data)}`);
    assert.strictEqual(created.data.aliases, 'Nyra, The Void Cartographer', 'Aliases must be stored as CSV');
    console.log('  ✓ Array aliases stored as canonical CSV');

    const noBook = await request('/api/lore', {
      token: tokenA,
      method: 'POST',
      body: JSON.stringify({ title: 'Ghost entry', content: 'x' }),
    });
    assert.strictEqual(noBook.status, 400, 'Lore creation without book_id must be rejected');
    console.log('  ✓ Lore creation without book_id rejected (400)');

    const stealCreate = await request('/api/lore', {
      token: tokenB,
      method: 'POST',
      body: JSON.stringify({ book_id: bookA.id, title: 'Intrusion', content: 'x' }),
    });
    assert.strictEqual(stealCreate.status, 404, 'User B cannot write into A book');
    const stealUpdate = await request(`/api/lore/${created.data.id}`, {
      token: tokenB,
      method: 'PUT',
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    assert.strictEqual(stealUpdate.status, 404, `User B cannot update A lore -> got ${stealUpdate.status} ${JSON.stringify(stealUpdate.data)}`);
    const stealDelete = await request(`/api/lore/${created.data.id}`, { token: tokenB, method: 'DELETE' });
    assert.strictEqual(stealDelete.status, 404, 'User B cannot delete A lore');
    console.log('  ✓ Cross-user create/update/delete on lore -> 404');

    const sessionA = await request('/api/sessions', {
      token: tokenA,
      method: 'POST',
      body: JSON.stringify({ title: 'Chronicle A', book_id: bookA.id }),
    });
    assert.strictEqual(sessionA.status, 201);
    const sessionsB = await request('/api/sessions', { token: tokenB });
    assert.ok(!sessionsB.data.some(s => s.id === sessionA.data.id), 'B must not list A sessions');
    const crossMsgs = await request(`/api/sessions/${sessionA.data.id}/messages`, { token: tokenB });
    assert.strictEqual(crossMsgs.status, 404, 'B cannot read A messages');
    const crossChat = await request('/api/chat', {
      token: tokenB,
      method: 'POST',
      body: JSON.stringify({ sessionId: sessionA.data.id, prompt: 'steal the story' }),
    });
    assert.strictEqual(crossChat.status, 404, 'B cannot chat inside A session');
    console.log('  ✓ Cross-user session list/messages/chat -> blocked');

    const stealBook = await request(`/api/books/${bookA.id}`, {
      token: tokenB,
      method: 'PUT',
      body: JSON.stringify({ title: 'Hijacked world' }),
    });
    assert.strictEqual(stealBook.status, 404, 'B cannot update A book');
    console.log('  ✓ Cross-user book update -> 404');


    const me = await request('/api/auth/me', { token: tokenA });
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.data.email, canonicalA);
    console.log('  ✓ /api/auth/me returns the Gmail identity');

    // ---------------- 1. RAG PRECISION (no full-lorebook dump) ----------------
    console.log('\n[TEST 3] RAG precision & scope at engine level');
    RAGEngine.resetStats();

    const offTopic = await RAGEngine.retrieveLore({
      currentPrompt: 'The weather over the northern market district is mild today.',
      bookId: bookA.id,
      userId: regA.data.user.id,
    });
    assert.strictEqual(offTopic.retrievedLore.length, 0, 'Off-topic prompt must not dump the lorebook');
    console.log('  ✓ Off-topic prompt -> 0 entries (no full dump)');

    const onTopic = await RAGEngine.retrieveLore({
      currentPrompt: 'Nyra Solace folds her fractured compass.',
      bookId: bookA.id,
      userId: regA.data.user.id,
    });
    assert.ok(onTopic.retrievedLore.length >= 1 && onTopic.retrievedLore.length <= 6, 'Top-K only');
    assert.ok(onTopic.retrievedLore.some(l => l.title === 'Nyra Solace'), 'Mentioned entity must be retrieved');
    console.log(`  ✓ On-topic prompt -> ${onTopic.retrievedLore.length} entries (max 6): ${onTopic.retrievedLore.map(l => l.title).join(' + ')}`);

    const partial = await RAGEngine.retrieveLore({
      currentPrompt: 'Kaelen waits in the dark.',
      bookId: bookA.id,
      userId: regA.data.user.id,
    });
    assert.ok(partial.retrievedLore.some(l => l.title === 'Kaelen Vance'), 'Partial name mention must match');
    console.log('  ✓ Partial name ("Kaelen") retrieves "Kaelen Vance"');

    const crossEngine = await RAGEngine.retrieveLore({
      currentPrompt: 'Nyra Solace folds her compass.',
      bookId: bookA.id,
      userId: regB.data.user.id,
    });
    assert.strictEqual(crossEngine.reason, 'book_not_owned', 'Engine must deny cross-user book access');
    assert.strictEqual(crossEngine.retrievedLore.length, 0);
    console.log('  ✓ Engine refuses cross-user book scope (book_not_owned)');

    const tier2 = RAGEngine.formatTier2Prompt('Nyra Solace folds her compass.', onTopic.retrievedLore);
    assert.ok(tier2.length < 8000, 'Tier 2 block must stay budgeted');
    assert.ok(tier2.includes('- Characters: None') === false, 'Matched character section must be populated');
    console.log(`  ✓ Tier 2 prompt stays budgeted (${tier2.length} chars)`);

    // ---------------- 2. CACHE HIT > 80% ----------------
    console.log('\n[TEST 4] RAG cache hit-rate telemetry');
    RAGEngine.resetStats();
    const rotation = [
      'Nyra Solace folds her fractured compass.',
      'Nyra steps through the collapsed dimension.',
      'Kaelen waits in the dark tunnel.',
      'Kaelen draws his obsidian rapier.',
      'Aether floods the conduit again.',
      'Flux Burn spreads through his hand.',
      'Nobody speaks in the silent vault.',
      'The weather stays mild today.',
    ];
    const turns = 200;
    for (let i = 0; i < turns; i++) {
      await RAGEngine.retrieveLore({
        currentPrompt: `${rotation[i % rotation.length]} Turn ${i}.`,
        recentMessages: [{ role: 'user', content: rotation[(i + 3) % rotation.length] }],
        bookId: bookA.id,
        userId: regA.data.user.id,
      });
    }
    const stats = RAGEngine.getStats();
    assert.ok(stats.payloadHitRate > 0.8, `payloadHitRate must exceed 80% (got ${(stats.payloadHitRate * 100).toFixed(1)}%)`);
    assert.ok(stats.dbFreeTurnRate > 0.8, `dbFreeTurnRate must exceed 80% (got ${(stats.dbFreeTurnRate * 100).toFixed(1)}%)`);
    console.log(`  ✓ payloadHitRate = ${(stats.payloadHitRate * 100).toFixed(1)}% (>80%)`);
    console.log(`  ✓ dbFreeTurnRate = ${(stats.dbFreeTurnRate * 100).toFixed(1)}% (>80%) — ${(stats.dbQueries / stats.turns).toFixed(3)} query/turn`);

    const httpStats = await request('/api/rag/stats', { token: tokenA });
    assert.strictEqual(httpStats.status, 200);
    assert.strictEqual(httpStats.data.meetsTarget, true, '/api/rag/stats must report the target as met');
    console.log('  ✓ GET /api/rag/stats reports meetsTarget=true');

    // Invalidation through the real write path (PUT lore -> immediate freshness)
    const updated = await request(`/api/lore/${created.data.id}`, {
      token: tokenA,
      method: 'PUT',
      body: JSON.stringify({ title: 'Nyra Solace', content: 'NEW-CANON: Nyra burned her compass.' }),
    });
    assert.strictEqual(updated.status, 200, `PUT lore failed -> ${updated.status} ${JSON.stringify(updated.data)}`);
    const afterEdit = await RAGEngine.retrieveLore({
      currentPrompt: 'Nyra Solace folds her fractured compass.',
      bookId: bookA.id,
      userId: regA.data.user.id,
    });
    assert.ok(afterEdit.retrievedLore[0].content.includes('NEW-CANON'), 'Edited canon must be live immediately');
    console.log('  ✓ PUT /api/lore invalidates the RAG scope (no stale canon)');

    const deleted = await request(`/api/lore/${created.data.id}`, { token: tokenA, method: 'DELETE' });
    assert.strictEqual(deleted.status, 200);
    const afterDelete = await RAGEngine.retrieveLore({
      currentPrompt: 'Nyra Solace folds her fractured compass.',
      bookId: bookA.id,
      userId: regA.data.user.id,
    });
    assert.strictEqual(afterDelete.retrievedLore.some(l => l.title === 'Nyra Solace'), false, 'Deleted canon must disappear');
    console.log('  ✓ DELETE /api/lore removes the entry from RAG instantly');

    console.log('\n=== ALL GMAIL SCOPE + RAG TESTS PASSED ===');
    server.close();
  } finally {
    // FK cascade removes books, lore, sessions, messages, graph state for these accounts.
    await teardownTestEnv(createdUsers);
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
