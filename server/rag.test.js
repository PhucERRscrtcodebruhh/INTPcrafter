// rag.test.js  —  vitest
// Chạy: npm i -D vitest && npx vitest run rag.test.js
// Giả định: engine nằm ở ./rag.js, import pool từ ./db.js (đổi path nếu khác)
//
// 4 persona:
//   1. Nhà văn AI bình thường        (lore có trước, viết đều đều)
//   2. Viết trước - lore sau         (AI gen xong mới nhét lore => invalidate liên tục)
//   3. Hệ OCD                        (alias đủ kiểu, sửa lore liên tục, soi từng ký tự)
//   4. Dân không kiên nhẫn           (prompt cụt ngủn, spam, burst song song)
// SLO: cache hit > 85% (payload + metadata) cho mọi session dài.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ------------------------------------------------------------------
// FAKE DB (in-memory) — giả lập đúng 6 loại query mà engine bắn ra
// ------------------------------------------------------------------
const db = vi.hoisted(() => {
  const state = { books: [], entries: [], queries: 0 };
  const hay = (e) => `${e.title} ${e.aliases} ${e.content}`.toLowerCase();
  const has = (e, w) => hay(e).includes(String(w).toLowerCase());
  const unlike = (p) => String(p).replace(/^%|%$/g, '').replace(/\\([%_\\])/g, '$1');
  const scoped = (uid, bid) => state.entries.filter(e => e.user_id === uid && e.book_id === bid);

  const query = async (sql, params = []) => {
    state.queries += 1;
    const s = sql.replace(/\s+/g, ' ');

    if (s.includes('FROM lore_books')) {
      const [id, uid] = params;
      return [state.books.filter(b => b.id === id && b.user_id === uid)];
    }
    if (s.includes('token_hits')) {
      const W = (s.match(/title LIKE \?/g) || []).length;
      const words = params.slice(0, W * 3).filter((_, i) => i % 3 === 0).map(unlike);
      const uid = params[W * 3];
      const bid = params[W * 3 + 1];
      const ids = params.slice(W * 3 + 2);
      return [scoped(uid, bid)
        .filter(e => ids.includes(e.id))
        .map(e => ({ id: e.id, token_hits: words.filter(w => has(e, w)).length }))];
    }
    if (s.includes('MATCH(')) {
      const [q, uid, bid, , limit] = params;
      const words = q.split(' ');
      return [scoped(uid, bid)
        .map(e => ({ id: e.id, relevance: words.filter(w => has(e, w)).length }))
        .filter(r => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit)];
    }
    if (s.includes('SELECT id, book_id, category')) {
      const [uid, bid, ...ids] = params;
      return [scoped(uid, bid).filter(e => ids.includes(e.id)).map(e => ({ ...e }))];
    }
    if (s.includes('SELECT id, title, aliases')) {
      const [uid, bid] = params;
      return [scoped(uid, bid).map(({ id, title, aliases }) => ({ id, title, aliases }))];
    }
    throw new Error(`unmocked query: ${s}`);
  };
  return { state, pool: { query } };
});

vi.mock('./db.js', () => ({ pool: db.pool }));

import { RAGEngine, ragStats, parseAliases, sanitizeFtsTerms } from './rag.js';

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
const U = 1;
const B = 10;
let nextId = 1;

function seed(entries, { uid = U, bid = B } = {}) {
  if (!db.state.books.some(b => b.id === bid && b.user_id === uid)) {
    db.state.books.push({ id: bid, user_id: uid });
  }
  return entries.map(e => {
    const row = { id: nextId++, user_id: uid, book_id: bid, category: 'Character', aliases: '', content: '', rules: '', ...e };
    db.state.entries.push(row);
    return row;
  });
}

const ask = (prompt, recent = [], extra = {}) =>
  RAGEngine.retrieveLore({
    currentPrompt: prompt,
    recentMessages: recent.map(content => ({ content })),
    userId: U,
    bookId: B,
    ...extra,
  });

const titles = (r) => r.retrievedLore.map(x => x.title);

async function runSession(prompts, { window = 3, onTurn } = {}) {
  const history = [];
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    const prompt = onTurn ? ((await onTurn(i)) ?? prompts[i]) : prompts[i];
    results.push(await ask(prompt, history.slice(-window)));
    history.push(prompt);
  }
  return results;
}

function expectSLO(label, min = 0.85) {
  const s = RAGEngine.getStats();
  expect(s.payloadHitRate, `${label}: payloadHitRate`).toBeGreaterThanOrEqual(min);
  expect(s.metadataHitRate, `${label}: metadataHitRate`).toBeGreaterThanOrEqual(min);
}

const BASE_LORE = () => [
  { title: 'Kael', aliases: 'Kael Thorne, Kiếm Sĩ Bóng Đêm', content: 'Kiếm sĩ trẻ mang dòng máu cổ đại. Anh sợ lửa.', rules: 'Không bao giờ dùng phép thuật.' },
  { title: 'Lyra', content: 'Pháp sư trẻ của hội Aether.' },
  { title: 'Mordain', content: 'Lãnh chúa phản bội.' },
  { title: 'Seraphine', content: 'Nữ tư tế giữ lời thề.' },
  { title: 'Tobren', content: 'Thợ rèn già ở biên giới.' },
  { title: 'Vex', content: 'Tên trộm nhanh tay.' },
  { title: 'Thành Eldoria', category: 'Location', content: 'Kinh đô bên bờ biển.' },
  { title: 'Aether Weaving', category: 'Magic', content: 'Dệt năng lượng thành lá chắn.' },
  { title: 'Blood Oath', category: 'Magic', content: 'Lời thề bằng máu, không thể phá.' },
  { title: 'The Ashen War', category: 'Plot', content: 'Cuộc chiến bốn mươi năm trước.' },
];

const SCENES = [
  'Kael bước vào Thành Eldoria, tay nắm chặt kiếm',
  'Lyra dùng Aether Weaving để chặn đòn của Mordain',
  'Kael và Lyra bàn về The Ashen War',
  'Seraphine kể lại Blood Oath cho Tobren',
  'Vex lẻn qua cổng lúc nửa đêm',
  'Mordain nhắc đến Kael với giọng khinh miệt',
];

beforeEach(() => {
  vi.useRealTimers();
  db.state.books = [];
  db.state.entries = [];
  db.state.queries = 0;
  nextId = 1;
  RAGEngine.invalidate();
  RAGEngine.resetStats();
});

afterEach(() => vi.useRealTimers());

// ==================================================================
// 0. UNIT NHỎ
// ==================================================================
describe('helpers', () => {
  it('parseAliases: array / JSON legacy / CSV / rác', () => {
    expect(parseAliases(['A', ' B ', ''])).toEqual(['A', 'B']);
    expect(parseAliases('["Zero","Archivist Prime"]')).toEqual(['Zero', 'Archivist Prime']);
    expect(parseAliases('Zero, Archivist Prime ,')).toEqual(['Zero', 'Archivist Prime']);
    expect(parseAliases('[abc, def')).toHaveLength(2); // JSON hỏng -> rơi về CSV, không throw
    expect(parseAliases(null)).toEqual([]);
    expect(parseAliases(undefined)).toEqual([]);
    expect(parseAliases('   ')).toEqual([]);
  });

  it('sanitizeFtsTerms: strip toán tử boolean-mode', () => {
    expect(sanitizeFtsTerms(['+evil', '-x', '"quote"', '(a)b', '*'])).toEqual(
      expect.not.arrayContaining(['+evil', '"quote"'])
    );
    expect(sanitizeFtsTerms([])).toEqual([]);
    expect(sanitizeFtsTerms('nope')).toEqual([]);
  });
});

// ==================================================================
// 1. NHÀ VĂN AI BÌNH THƯỜNG
// ==================================================================
describe('persona 1: nhà văn AI bình thường', () => {
  beforeEach(() => seed(BASE_LORE()));

  it('match đúng entity theo title, score 100', async () => {
    const r = await ask(SCENES[0]);
    expect(r.reason).toBe('ok');
    expect(titles(r)).toEqual(expect.arrayContaining(['Kael', 'Thành Eldoria']));
    const kael = r.retrievedLore.find(x => x.title === 'Kael');
    expect(kael.matchReason).toBe('Direct title mention');
    expect(kael.score).toBe(100);
  });

  it('không dump cả lore book: chỉ trả entity liên quan', async () => {
    const r = await ask(SCENES[3]);
    expect(titles(r)).toEqual(expect.arrayContaining(['Seraphine', 'Blood Oath', 'Tobren']));
    expect(titles(r)).not.toContain('Kael');
    expect(r.retrievedLore.length).toBeLessThan(10);
  });

  it('alias match (score 85)', async () => {
    const r = await ask('Kiếm Sĩ Bóng Đêm rút kiếm');
    const kael = r.retrievedLore.find(x => x.title === 'Kael');
    expect(kael).toBeTruthy();
    expect(kael.matchReason).toContain('Alias mention');
    expect(kael.score).toBe(85);
  });

  it('context từ 3 tin gần nhất còn hiệu lực, tin thứ 4 thì không', async () => {
    const within = await ask('tiếp đi', ['Kael bước vào', 'x', 'y']);
    expect(titles(within)).toContain('Kael');
    const outside = await ask('tiếp đi', ['Kael bước vào', 'x', 'y', 'z']);
    expect(titles(outside)).not.toContain('Kael');
  });

  it('prompt không nhắc tên -> FTS fallback tìm theo nội dung (>=2 keyword chung)', async () => {
    const r = await ask('Anh sợ lửa nên lùi lại');
    expect(titles(r)).toEqual(['Kael']);
    expect(r.retrievedLore[0].matchReason).toMatch(/^Content match/);
    expect(r.retrievedLore[0].score).toBeLessThan(65);
  });

  it('FTS không bắt rác: chỉ 1 từ chung thì bị gate loại', async () => {
    const r = await ask('Cuộc sống thật yên bình');
    expect(r.retrievedLore).toEqual([]);
    expect(r.reason).toBe('no_match');
  });

  it('formatContextBlock + formatTier2Prompt có rules, alias, và khoá read-only', async () => {
    const r = await ask(SCENES[0]);
    expect(r.formattedContext).toContain('[WORLD KNOWLEDGE BASE CONTEXT]');
    expect(r.formattedContext).toContain('Không bao giờ dùng phép thuật');
    const t2 = RAGEngine.formatTier2Prompt('Viết tiếp chương 5', r.retrievedLore);
    expect(t2).toContain('READ-ONLY CANON DATA');
    expect(t2.endsWith('Viết tiếp chương 5')).toBe(true);
    expect(RAGEngine.formatTier2Prompt('hi', [])).toContain('Characters: None');
  });

  it('cô lập tenant: user khác không đọc được book của mình', async () => {
    const r = await ask(SCENES[0], [], { userId: 999 });
    expect(r.reason).toBe('book_not_owned');
    expect(r.retrievedLore).toEqual([]);
    expect(ragStats.ownershipDenied).toBe(1);
  });

  it('SLO: 100 turn xoay 6 cảnh => cache hit >= 85%', async () => {
    const prompts = Array.from({ length: 100 }, (_, i) => SCENES[i % SCENES.length]);
    await runSession(prompts);
    expectSLO('normal writer');
    expect(RAGEngine.getStats().dbFreeTurnRate).toBeGreaterThan(0.85);
  });
});

// ==================================================================
// 2. VIẾT TRƯỚC - LORE SAU
// ==================================================================
describe('persona 2: viết trước, lore sau', () => {
  beforeEach(() => seed(BASE_LORE()));

  it('entity chưa có lore -> no_match; thêm lore + invalidate -> thấy ngay', async () => {
    const before = await ask('Draven chặn đường Kael');
    expect(titles(before)).not.toContain('Draven');

    seed([{ title: 'Draven', content: 'Sát thủ của Hội Bóng Tối.' }]);
    RAGEngine.invalidate({ userId: U, bookId: B });

    const after = await ask('Draven chặn đường Kael');
    expect(titles(after)).toEqual(expect.arrayContaining(['Draven', 'Kael']));
    expect(after.cache.payload).toBe('miss'); // phải build lại payload
  });

  it('CONTRACT: quên invalidate => cache cũ phục vụ lore stale (tới khi hết TTL)', async () => {
    await ask('Draven xuất hiện');
    seed([{ title: 'Draven', content: 'Sát thủ.' }]);
    const stale = await ask('Draven xuất hiện'); // KHÔNG invalidate
    expect(titles(stale)).not.toContain('Draven');
    // => mọi write path (thêm/sửa/xoá entry, đổi alias) BẮT BUỘC gọi RAGEngine.invalidate
  });

  it('sửa content entity cũ: không invalidate = stale, có invalidate = mới', async () => {
    const [kael] = db.state.entries;
    const first = await ask(SCENES[0]);
    expect(first.formattedContext).toContain('Anh sợ lửa');

    kael.content = 'Kiếm sĩ trẻ. Anh đã vượt qua nỗi sợ lửa.';
    const stale = await ask(SCENES[0]);
    expect(stale.formattedContext).toContain('Anh sợ lửa');

    RAGEngine.invalidate({ userId: U, bookId: B });
    const fresh = await ask(SCENES[0]);
    expect(fresh.formattedContext).toContain('vượt qua nỗi sợ lửa');
  });

  it('thêm alias sau khi AI đã gen (alias mới phải match sau invalidate)', async () => {
    const [kael] = db.state.entries;
    expect(titles(await ask('Thanh Kiếm Câm bước ra'))).not.toContain('Kael');
    kael.aliases += ', Thanh Kiếm Câm';
    RAGEngine.invalidate({ userId: U, bookId: B });
    expect(titles(await ask('Thanh Kiếm Câm bước ra'))).toContain('Kael');
  });

  it('invalidate scoped: không phá cache của user/book khác', async () => {
    seed([{ title: 'Kael' }], { uid: 2, bid: 20 });
    const other = (p) => ask(p, [], { userId: 2, bookId: 20 });
    await other('Kael đây');
    RAGEngine.invalidate({ userId: U, bookId: B });
    const again = await other('Kael đây');
    expect(again.cache.payload).toBe('hit');
  });

  it('invalidateCache(bookId) legacy: chỉ xoá book đó; id rác thì xoá sạch', async () => {
    seed([{ title: 'Kael' }], { uid: 2, bid: 20 });
    await ask(SCENES[0]);
    await ask('Kael đây', [], { userId: 2, bookId: 20 });

    const res = RAGEngine.invalidateCache(B);
    expect(res.scope).toBe(`book:${B}`);
    expect((await ask('Kael đây', [], { userId: 2, bookId: 20 })).cache.payload).toBe('hit');

    expect(RAGEngine.invalidateCache('abc').scope).toBe('all');
    expect(RAGEngine.getStats().cachedKeys).toBe(0);
  });

  it('invalidate() dọn luôn ftsCache (không còn "ghost lore")', async () => {
    await ask('Anh sợ lửa nên lùi lại'); // dựng ftsCache
    const [kael] = db.state.entries;
    kael.content = 'Kiếm sĩ trẻ. Anh không còn sợ gì cả.';
    RAGEngine.invalidate({ userId: U, bookId: B });
    const r = await ask('Anh sợ lửa nên lùi lại');
    expect(r.retrievedLore).toEqual([]);
  });

  it('SLO: 400 turn, thêm lore + invalidate ở turn 100/200/300 => hit >= 85%', async () => {
    const prompts = Array.from({ length: 400 }, (_, i) => SCENES[i % SCENES.length]);
    let added = 0;
    const results = await runSession(prompts, {
      onTurn: async (i) => {
        if (i > 0 && i % 100 === 0) {
          added += 1;
          seed([{ title: `Nhân vật mới ${added}`, content: 'Vừa được thêm sau khi AI gen.' }]);
          RAGEngine.invalidate({ userId: U, bookId: B });
          return `Nhân vật mới ${added} xuất hiện cùng Kael`;
        }
        return undefined;
      },
    });
    // entity vừa thêm phải có mặt ngay turn kế tiếp
    for (const i of [100, 200, 300]) {
      expect(titles(results[i]).some(t => t.startsWith('Nhân vật mới'))).toBe(true);
    }
    expectSLO('lore-later writer');
  });
});

// ==================================================================
// 3. HỆ OCD
// ==================================================================
describe('persona 3: hệ OCD', () => {
  beforeEach(() => {
    seed([
      {
        title: 'Kael Thorne',
        aliases: '["Ke-Ke","Black Blade","黑刃"]', // legacy JSON array
        content: 'Kiếm sĩ.',
      },
      { title: 'Archivist Prime', aliases: 'Zero', content: 'Người giữ thư viện.' },
    ]);
  });

  it.each([
    ['kael thorne', true],
    ['KAEL THORNE!', true],
    ["Kael Thorne's sword", true],
    ['(Ke-Ke) cười', true],
    ['“black blade”', true],
    ['他拿起黑刃冲了上去', true],          // CJK không có khoảng trắng
    ['Kaelthorne', false],                  // dính liền => không match
    ['xKe-Kex', false],
    ['Zeroes everywhere', false],           // "Zero" không được ăn vào "Zeroes"
  ])('boundary regex: %s -> %s', async (prompt, expected) => {
    const r = await ask(prompt);
    const hit = r.retrievedLore.length > 0;
    expect(hit).toBe(expected);
  });

  it('title-token match (65) vẫn bắt "Prime" lẻ — ghi nhận hành vi, có thể là false-positive', async () => {
    const r = await ask('đây là prime time của đêm nay');
    const hit = r.retrievedLore.find(x => x.title === 'Archivist Prime');
    expect(hit?.matchReason).toMatch(/^Title token mention/);
    expect(hit?.score).toBe(65);
  });

  it('hỏi lại y chang 50 lần => 1 miss + 49 hit, 49 turn không đụng DB', async () => {
    for (let i = 0; i < 50; i++) await ask('Kael Thorne cầm Black Blade');
    const s = RAGEngine.getStats();
    expect(s.payloadHits).toBe(49);
    expect(s.payloadMisses).toBe(1);
    expect(s.dbFreeTurns).toBe(49);
    expectSLO('ocd repeat');
  });

  it('maxResults khác nhau = key khác nhau; giá trị bị clamp thì dùng chung key', async () => {
    const p = 'Kael Thorne và Zero';
    await ask(p, [], { maxResults: 3 });
    await ask(p, [], { maxResults: 4 });
    expect((await ask(p, [], { maxResults: 3 })).cache.payload).toBe('hit');
    expect((await ask(p, [], { maxResults: 4 })).cache.payload).toBe('hit');

    await ask(p, [], { maxResults: 99 });                     // clamp -> 8
    expect((await ask(p, [], { maxResults: 8 })).cache.payload).toBe('hit');
    await ask(p, [], { maxResults: 0 });                      // fallback -> 6
    expect((await ask(p, [], { maxResults: 6 })).cache.payload).toBe('hit');
    await ask(p, [], { maxResults: -5 });                     // clamp -> 1
    expect((await ask(p, [], { maxResults: 1 })).cache.payload).toBe('hit');
  });

  it('sửa lore 20 lần liên tục + invalidate: 100% luôn đọc được bản mới nhất', async () => {
    const [kael] = db.state.entries;
    for (let i = 0; i < 20; i++) {
      kael.content = `Kiếm sĩ. Phiên bản v${i}.`;
      RAGEngine.invalidate({ userId: U, bookId: B });
      const r = await ask('Kael Thorne bước vào');
      expect(r.formattedContext).toContain(`v${i}.`);
      expect(r.formattedContext).not.toContain(`v${i - 1}.`);
    }
  });

  it('budget: content bị clamp ở ~1500, rules ~400, cắt ở ranh giới câu, có dấu …', async () => {
    const longContent = Array.from({ length: 400 }, (_, i) => `Câu số ${i}.`).join(' ');
    const longRules = Array.from({ length: 200 }, (_, i) => `Luật ${i}.`).join(' ');
    seed([{ title: 'Siêu Dài', content: longContent, rules: longRules }]);
    RAGEngine.invalidate({ userId: U, bookId: B });

    const r = await ask('Siêu Dài xuất hiện');
    const block = r.formattedContext;
    const content = block.split('[CANONICAL CONTENT]:\n')[1].split('\n====')[0];
    const rules = block.split('[RULES & LOGICAL CONSTRAINTS]:\n')[1].split('\n[CANONICAL')[0];
    expect(content.length).toBeLessThanOrEqual(1501);
    expect(rules.length).toBeLessThanOrEqual(401);
    expect(content.endsWith('…') || content.endsWith('.')).toBe(true);
  });

  it('TOTAL_CHAR_BUDGET: 8 entity khổng lồ => usedChars <= 6000, phần dư bị drop và đếm stats', async () => {
    const big = 'Một câu khá dài để lấp đầy budget của entry này. '.repeat(100);
    const rows = seed(Array.from({ length: 8 }, (_, i) => ({ title: `Khổng Lồ ${i}`, content: big, rules: big })));
    RAGEngine.invalidate({ userId: U, bookId: B });

    const r = await ask(rows.map(x => x.title).join(' và '), [], { maxResults: 8 });
    expect(r.retrievedLore).toHaveLength(8);
    const sections = RAGEngine.buildEntitySections(r.retrievedLore);
    expect(sections.usedChars).toBeLessThanOrEqual(6000);
    expect(sections.dropped).toBeGreaterThan(0);
    expect(ragStats.droppedByBudget).toBeGreaterThan(0);
  });

  it('tenant isolation: query dính SQL-ish/regex-ish vẫn không crash', async () => {
    const nasty = ["Kael'; DROP TABLE lore_entries;--", '.*', '(?<=a)', '\\', '%_%', '[[[', '+ - > < ( ) ~ * "'];
    for (const p of nasty) {
      const r = await ask(p);
      expect(['ok', 'no_match']).toContain(r.reason);
    }
    expect(db.state.entries.length).toBe(2);
  });
});

// ==================================================================
// 4. DÂN KHÔNG KIÊN NHẪN
// ==================================================================
describe('persona 4: dân không kiên nhẫn', () => {
  beforeEach(() => seed(BASE_LORE()));

  it('prompt rỗng / toàn khoảng trắng: trả empty_prompt, 0 query, không tính turn', async () => {
    for (const p of ['', '   ', '\n\n', null, undefined]) {
      const r = await ask(p);
      expect(r.reason).toBe('empty_prompt');
    }
    expect(ragStats.turns).toBe(0);
  });

  it('thiếu scope: missing_scope, 0 query tới DB', async () => {
    const r1 = await ask('Kael', [], { bookId: undefined });
    const r2 = await ask('Kael', [], { userId: 'abc' });
    const r3 = await ask('Kael', [], { bookId: 0 });
    expect([r1.reason, r2.reason, r3.reason]).toEqual(['missing_scope', 'missing_scope', 'missing_scope']);
    expect(ragStats.scopeRejected).toBe(3);
    expect(db.state.queries).toBe(0);
  });

  it.each(['tiếp', 'ok', '?', '...', 'viết tiếp đi', 'đi', '👍', 'tiếp tiếp tiếp tiếp'])(
    'prompt cụt "%s" không crash, trả payload hợp lệ',
    async (p) => {
      const r = await ask(p);
      expect(['ok', 'no_match']).toContain(r.reason);
      expect(typeof r.formattedContext).toBe('string');
    }
  );

  it('prompt cụt chỉ tốn DB lần đầu (FTS cache), lần sau 0 query', async () => {
    await ask('tiếp');
    const second = await ask('tiếp');
    expect(second.cache.dbQueries).toBe(0);
    expect(second.cache.payload).toBe('hit');
  });

  it('prompt cụt nhưng 3 tin trước nhắc Kael => vẫn kéo đúng Kael', async () => {
    const r = await ask('tiếp', ['Kael bước vào Thành Eldoria', 'ok', 'ừ']);
    expect(titles(r)).toContain('Kael');
  });

  it('burst 30 request song song lúc cache lạnh: kết quả nhất quán, không throw', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => ask(SCENES[0])));
    const first = results[0].retrievedLoreIds;
    expect(first).not.toBe('');
    for (const r of results) expect(r.retrievedLoreIds).toBe(first);
    // Engine KHÔNG dedup in-flight => cold start có thể bắn ~N lần ownership+metadata.
    // Log ra để theo dõi; nếu sau này thêm in-flight promise cache thì siết assert này lại.
    console.info(`[burst] cold-start db queries: ${db.state.queries} (30 concurrent)`);

    const before = db.state.queries;
    for (let i = 0; i < 50; i++) await ask(SCENES[0]);
    expect(db.state.queries).toBe(before); // nóng rồi thì 0 query
  });

  it('SLO: 200 turn spam prompt cụt xen kẽ => hit >= 85%', async () => {
    const lazy = ['tiếp', 'ok', 'viết tiếp đi', 'Kael đâu rồi', 'tiếp', '?'];
    const prompts = Array.from({ length: 200 }, (_, i) => lazy[i % lazy.length]);
    await runSession(prompts);
    expectSLO('impatient');
    expect(RAGEngine.getStats().dbFreeTurnRate).toBeGreaterThan(0.85);
  });
});

// ==================================================================
// 5. CACHE INFRA (TTL / cap)
// ==================================================================
describe('cache infra', () => {
  beforeEach(() => seed(BASE_LORE()));

  it('payload TTL 10 phút, metadata TTL 30 phút', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    await ask(SCENES[0]);
    expect((await ask(SCENES[0])).cache.payload).toBe('hit');

    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    const afterPayloadTtl = await ask(SCENES[0]);
    expect(afterPayloadTtl.cache.payload).toBe('miss');
    expect(ragStats.metadataMisses).toBe(1); // metadata vẫn còn sống

    vi.advanceTimersByTime(31 * 60 * 1000);
    await ask(SCENES[0]);
    expect(ragStats.metadataMisses).toBe(2); // quá 30' => load lại
  });

  it('payloadCache không vượt RAG_CACHE_MAX_ENTRIES (800) dù 900 book khác nhau', async () => {
    for (let i = 0; i < 900; i++) {
      const bid = 1000 + i;
      seed([{ title: 'Kael' }], { uid: U, bid });
      await ask('Kael đây', [], { bookId: bid });
    }
    expect(RAGEngine.getStats().cachedKeys).toBeLessThanOrEqual(800);
  });

  it.todo('bookMetaCache KHÔNG có size cap (chỉ TTL) — nhiều tenant sẽ phình RAM, cân nhắc LRU');
  it.todo('result.cache.metadata luôn là "hit"/"n/a" dù metadata vừa miss — field gây hiểu nhầm khi debug');
});

// ==================================================================
// 6. DÂN COI CONTEXT WINDOW LÀ Ổ SSD
//    (nhét cả tiểu thuyết vào lore, prompt dài như sớ, gọi tên 500 nhân vật cùng lúc,
//     "nhớ hết giùm tao" — engine phải giữ budget, không nổ RAM, không nổ DB)
// ==================================================================
describe('persona 6: coi context window là SSD', () => {
  const bigText = (chars) => 'Một câu lore dài lê thê để lấp đầy ổ đĩa tưởng tượng. '.repeat(Math.ceil(chars / 52)).slice(0, chars);

  it('book 2000 entry x 5k ký tự: metadata chỉ load id/title/aliases, hydrate đúng 1 row', async () => {
    seed(Array.from({ length: 2000 }, (_, i) => ({ title: `Entity${i}x`, content: bigText(5000) })));
    const t0 = performance.now();
    const r = await ask('Entity1234x vừa xuất hiện');
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(titles(r)).toEqual(['Entity1234x']);
    expect(r.formattedContext.length).toBeLessThan(3000);
    expect(r.cache.dbQueries).toBeLessThanOrEqual(3); // owner + metadata + hydrate
  });

  it('gọi tên 500 nhân vật trong 1 prompt + maxResults=1000: cap 8, prompt Tier2 vẫn trong budget', async () => {
    const rows = seed(Array.from({ length: 500 }, (_, i) => ({ title: `Hero${i}x`, content: bigText(3000), rules: bigText(800) })));
    const prompt = rows.map(r => r.title).join(', ');
    const r = await ask(prompt, [], { maxResults: 1000 });
    expect(r.retrievedLore.length).toBeLessThanOrEqual(8);

    const t2 = RAGEngine.formatTier2Prompt('Viết tiếp', r.retrievedLore);
    // 6000 budget cho entity + khung/header; không được phình theo số entity trong DB
    expect(t2.length).toBeLessThan(7500);
  });

  it('tie 500 entity cùng score: top-K ổn định giữa các lần gọi (signature không nhảy => vẫn cache hit)', async () => {
    const rows = seed(Array.from({ length: 500 }, (_, i) => ({ title: `Tie${i}x` })));
    const prompt = rows.map(r => r.title).join(' ');
    const a = await ask(prompt);
    const b = await ask(prompt);
    expect(b.retrievedLoreIds).toBe(a.retrievedLoreIds);
    expect(b.cache.payload).toBe('hit');
  });

  it('prompt 200k ký tự có tên entity ở cuối: vẫn match, không lag', async () => {
    seed(BASE_LORE());
    const prompt = `${bigText(200_000)} rồi Kael xuất hiện`;
    const t0 = performance.now();
    const r = await ask(prompt);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(titles(r)).toContain('Kael');
  });

  it('prompt 200k ký tự KHÔNG có entity: FTS chỉ lấy tối đa 10 token => số query bị chặn', async () => {
    seed(BASE_LORE());
    await ask(bigText(200_000));
    expect(db.state.queries).toBeLessThanOrEqual(5); // owner + metadata + fts (+confirm)
  });

  it('recentMessages 10.000 tin: chỉ 3 tin cuối được đọc, tin rác không crash', async () => {
    seed(BASE_LORE());
    const recent = Array.from({ length: 10_000 }, (_, i) => ({ content: i === 0 ? 'Kael ở tít đầu' : 'x' }));
    const r = await RAGEngine.retrieveLore({ currentPrompt: 'tiếp', recentMessages: recent, userId: U, bookId: B });
    expect(titles(r)).not.toContain('Kael');

    const weird = await RAGEngine.retrieveLore({
      currentPrompt: 'Kael',
      recentMessages: [null, {}, { content: 123 }, undefined],
      userId: U,
      bookId: B,
    });
    expect(titles(weird)).toContain('Kael');
    const notArray = await RAGEngine.retrieveLore({ currentPrompt: 'Kael', recentMessages: 'lol', userId: U, bookId: B });
    expect(titles(notArray)).toContain('Kael');
  });

  it('1 entity có 500 alias: compile OK, match alias cuối cùng', async () => {
    const aliases = Array.from({ length: 500 }, (_, i) => `Biệt Danh ${i}`).join(', ');
    seed([{ title: 'Đa Danh', aliases }]);
    const t0 = performance.now();
    const r = await ask('mọi người gọi hắn là Biệt Danh 499');
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.retrievedLore[0]?.title).toBe('Đa Danh');
  });

  it('formattedContext (block audit) không vượt quá trần per-entry x số entry', async () => {
    const rows = seed(Array.from({ length: 8 }, (_, i) => ({ title: `Khổng${i}x`, content: bigText(50_000), rules: bigText(5_000) })));
    const r = await ask(rows.map(x => x.title).join(' '), [], { maxResults: 8 });
    // mỗi entry: 1500 content + 400 rules + header ~200
    expect(r.formattedContext.length).toBeLessThan(8 * 2200);
  });

  // ---- 2 test dưới đây mô tả hành vi MONG MUỐN nhưng code hiện tại chưa làm được.
  // it.fails = suite vẫn xanh; khi fix xong thì test này đỏ => đổi thành it() thường.

  it.fails('formattedContext phải bị chặn bởi TOTAL_CHAR_BUDGET (hiện chỉ Tier2 có trần tổng, block audit thì không)', async () => {
    const rows = seed(Array.from({ length: 8 }, (_, i) => ({ title: `Tổng${i}x`, content: bigText(50_000), rules: bigText(5_000) })));
    const r = await ask(rows.map(x => x.title).join(' '), [], { maxResults: 8 });
    expect(r.formattedContext.length).toBeLessThanOrEqual(6000 + 800);
  });

  it.fails('payload cache không được giữ nguyên content 1MB (hydrate SELECT content nguyên cột rồi cache luôn)', async () => {
    seed([{ title: 'Cả Cuốn Tiểu Thuyết', content: bigText(1_000_000) }]);
    const r = await ask('Cả Cuốn Tiểu Thuyết');
    // 800 entry cache x 8 row x 1MB = có thể >6GB RAM. Mong muốn: clamp trước khi cache.
    expect(r.retrievedLore[0].content.length).toBeLessThanOrEqual(1500);
  });

  it('SLO: 150 turn xen kẽ "gọi hết 500 nhân vật" và "tiếp" => hit >= 85%', async () => {
    const rows = seed(Array.from({ length: 500 }, (_, i) => ({ title: `Hero${i}x`, content: bigText(2000) })));
    const dumpAll = rows.map(r => r.title).join(' ');
    const prompts = Array.from({ length: 150 }, (_, i) => (i % 3 === 0 ? dumpAll : 'tiếp'));
    await runSession(prompts);
    expectSLO('ssd-guy');
  });
});