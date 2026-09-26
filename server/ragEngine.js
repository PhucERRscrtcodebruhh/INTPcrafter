import { pool } from './db.js';

// Cache nhẹ danh sách Title/Aliases trên RAM để né query DB liên tục
const bookMetaCache = new Map(); // bookId -> { entries: [{id, title, aliases, titleRegex, aliasMatchers}], lastUpdated }

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Biên dịch regex tìm kiếm với ranh giới từ chuẩn Unicode (\p{P}, \p{S}, \s)
 * Hỗ trợ Unicode typographic quotes, em-dash, emoji và CJK
 */
function buildBoundaryRegex(term) {
  const trimmed = term.trim();
  const isCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(trimmed);
  if (isCJK) {
    return new RegExp(escapeRegex(trimmed), 'iu');
  }
  return new RegExp(`(?<=^|[\\s\\p{P}\\p{S}])(${escapeRegex(trimmed)})(?=$|[\\s\\p{P}\\p{S}])`, 'iu');
}

/**
 * Sanitize tokens cho MySQL Fulltext Boolean Mode (+word1 +word2)
 * Loại bỏ các toán tử: + - < > ( ) ~ * " @ : \ /
 * Đảm bảo các từ có độ dài tối thiểu 2 ký tự
 */
function sanitizeBooleanSearchTerms(searchTerms) {
  if (!Array.isArray(searchTerms) || searchTerms.length === 0) return [];

  const cleanTokens = [];
  for (const raw of searchTerms) {
    if (!raw || typeof raw !== 'string') continue;
    const cleaned = raw.replace(/[+\-><()~*"@:\\/]/g, ' ').trim();
    if (!cleaned) continue;

    const subTokens = cleaned.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);
    cleanTokens.push(...subTokens);
  }

  return Array.from(new Set(cleanTokens));
}

export class RAGEngine {
  /**
   * Xóa cache RAM metadata của sách (hoặc xóa toàn bộ nếu không truyền bookId)
   * @param {number|string|null} [bookId]
   */
  static invalidateCache(bookId = null) {
    if (bookId !== null && bookId !== undefined) {
      const key = Number(bookId) || bookId;
      return bookMetaCache.delete(key);
    }
    bookMetaCache.clear();
    return true;
  }

  /**
   * Lấy danh sách nhẹ (id, title, aliases) có cache RAM và pre-compiled regex
   */
  static async getBookMetadata(bookId) {
    const cacheKey = Number(bookId) || bookId;
    const cached = bookMetaCache.get(cacheKey);

    // Cache 5 phút hoặc tự clear khi gọi invalidateCache
    if (cached && Date.now() - cached.lastUpdated < 300000) {
      return cached.entries;
    }

    const [rows] = await pool.query(
      `SELECT id, title, aliases FROM lore_entries WHERE book_id = ?`,
      [cacheKey]
    );

    // Pre-compile regex ngay khi nạp vào cache để tránh compile trong vòng lặp retrieval
    const parsed = rows.map(r => {
      const title = (r.title || '').trim();
      const rawAliases = Array.isArray(r.aliases)
        ? r.aliases
        : (typeof r.aliases === 'string' ? r.aliases.split(',').map(a => a.trim()).filter(Boolean) : []);

      const validAliases = rawAliases.filter(a => a && a.length > 1);

      return {
        id: r.id,
        title,
        aliases: validAliases,
        titleRegex: title ? buildBoundaryRegex(title) : null,
        aliasMatchers: validAliases.map(alias => ({
          alias,
          regex: buildBoundaryRegex(alias)
        }))
      };
    });

    bookMetaCache.set(cacheKey, { entries: parsed, lastUpdated: Date.now() });
    return parsed;
  }

  static async retrieveLore({ currentPrompt, recentMessages = [], maxResults = 5, bookId = undefined }) {
    if (bookId === null) {
      return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
    }

    const effectiveBookId = bookId !== undefined ? (Number(bookId) || bookId) : 1;
    const textPool = [currentPrompt || '', ...recentMessages.slice(-3).map(m => m.content || '')].join('\n');
    if (!textPool.trim()) {
      return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
    }

    try {
      const matchedScores = new Map(); // id -> { score, matchReason }

      // 1. Quét Title/Aliases bằng Regex Boundary pre-compiled trên RAM (O(1) compile, không query DB)
      const metaEntries = await this.getBookMetadata(effectiveBookId);

      for (const entry of metaEntries) {
        let isMatched = false;
        let score = 0;
        let reason = '';

        // Check Title với precompiled regex
        if (entry.titleRegex && entry.titleRegex.test(textPool)) {
          isMatched = true;
          score = 100;
          reason = 'Direct title mention';
        }

        // Check Aliases nếu chưa match Title
        if (!isMatched && entry.aliasMatchers.length > 0) {
          for (const { alias, regex } of entry.aliasMatchers) {
            if (regex.test(textPool)) {
              isMatched = true;
              score = 75;
              reason = `Alias mention (${alias})`;
              break;
            }
          }
        }

        if (isMatched) {
          matchedScores.set(entry.id, { score, matchReason: reason });
        }
      }

      // 2. Full-text Search nếu chưa đủ slot (Sanitize triệt để chống Boolean Mode injection)
      const searchTerms = this.extractSearchTerms(currentPrompt);
      const cleanFtsTerms = sanitizeBooleanSearchTerms(searchTerms);

      if (cleanFtsTerms.length > 0 && matchedScores.size < maxResults) {
        const ftQuery = cleanFtsTerms.map(w => `+${w}`).join(' ');

        try {
          const [ftRows] = await pool.query(
            `SELECT id, MATCH(content) AGAINST(? IN BOOLEAN MODE) as relevance
             FROM lore_entries
             WHERE book_id = ? AND MATCH(content) AGAINST(? IN BOOLEAN MODE)
             ORDER BY relevance DESC 
             LIMIT ?`,
            [ftQuery, effectiveBookId, ftQuery, maxResults]
          );

          for (const row of ftRows) {
            if (!matchedScores.has(row.id)) {
              matchedScores.set(row.id, {
                score: 50 + (row.relevance || 0),
                matchReason: 'Fulltext boolean match'
              });
            }
          }
        } catch {
          // Fallback an toàn: Tìm theo LIKE với các từ khóa đã sanitize và escape wildcard % _
          const topWords = cleanFtsTerms.slice(0, 3);
          if (topWords.length > 0) {
            const likeClauses = topWords.map(() => `content LIKE ?`).join(' OR ');
            const likeParams = topWords.map(w => `%${w.replace(/[%_\\]/g, '\\$&')}%`);

            const [likeRows] = await pool.query(
              `SELECT id FROM lore_entries WHERE book_id = ? AND (${likeClauses}) LIMIT ?`,
              [effectiveBookId, ...likeParams, maxResults]
            );

            for (const row of likeRows) {
              if (!matchedScores.has(row.id)) {
                matchedScores.set(row.id, { score: 40, matchReason: 'Keyword LIKE match' });
              }
            }
          }
        }
      }

      // 3. Sắp xếp rank & chỉ query Content/Rules cho các ID đã trúng tuyển
      const sortedEntries = Array.from(matchedScores.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, maxResults);

      if (sortedEntries.length === 0) {
        return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
      }

      const targetIds = sortedEntries.map(([id]) => id);
      // Vá parameterized query cho mệnh đề IN (?) tránh driver crash / mismatch
      const placeholders = targetIds.map(() => '?').join(', ');

      const [fullRecords] = await pool.query(
        `SELECT id, book_id, category, title, aliases, content, rules 
         FROM lore_entries 
         WHERE id IN (${placeholders})`,
        targetIds
      );

      // 4. Map lại chính xác thứ tự rank giảm dần theo sortedEntries (O(1) map lookup)
      const recordMap = new Map(fullRecords.map(r => [r.id, r]));
      const results = [];

      for (const [id, meta] of sortedEntries) {
        const row = recordMap.get(id);
        if (row) {
          results.push({
            ...row,
            score: meta.score,
            matchReason: meta.matchReason
          });
        }
      }

      return {
        retrievedLore: results,
        formattedContext: this.formatContextBlock(results),
        retrievedLoreIds: results.map(r => r.id).join(',')
      };

    } catch (err) {
      console.error('[RAG] Error:', err);
      return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
    }
  }

  /**
   * Extract meaningful keywords and entity names from text
   */
  static extractSearchTerms(text) {
    if (!text) return [];
    // Remove punctuation, special characters, and common conversational stop words
    const clean = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'for', 'with', 'by',
      'of', 'it', 'this', 'that', 'from', 'as', 'what', 'how', 'why', 'who', 'where', 'when',
      'là', 'và', 'của', 'ở', 'tại', 'với', 'cho', 'một', 'những', 'các', 'thì', 'mà', 'trong'
    ]);

    const words = clean.split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

    return Array.from(new Set(words)).slice(0, 8);
  }

  /**
   * Assemble structured [WORLD KNOWLEDGE BASE CONTEXT] block
   */
  static formatContextBlock(loreList) {
    if (!loreList || loreList.length === 0) return '';

    const entriesText = loreList.map((entry, idx) => {
      const aliasesStr = entry.aliases ? `Aliases: ${Array.isArray(entry.aliases) ? entry.aliases.join(', ') : entry.aliases}` : '';
      const rulesStr = entry.rules ? `[RULES & LOGICAL CONSTRAINTS]:\n${entry.rules}` : '';
      const contentStr = entry.content ? `[CANONICAL CONTENT]:\n${entry.content}` : '';

      return `=== [LORE RECORD #${idx + 1}] ${entry.title} (${entry.category || 'General'}) ===
${aliasesStr}
${rulesStr}
${contentStr}
=========================================================`;
    }).join('\n\n');

    return `\n\n[WORLD KNOWLEDGE BASE CONTEXT]
The following verified facts, entities, and invariant rules have been retrieved from the story universe database. You must rigorously enforce all logical constraints and continuity:

${entriesText}
[END OF WORLD KNOWLEDGE BASE CONTEXT]\n`;
  }

  /**
   * Assemble Tier 2 Dynamic RAG & User Input Suffix
   */
  static formatTier2Prompt(userPrompt, retrievedLore = []) {
    const cleanUserPrompt = (userPrompt || '').trim();
    if (!retrievedLore || retrievedLore.length === 0) {
      return `[Context Reference - Retrieved Entities]\n- Characters: None\n- Magic/Power System: None\n- Relevant Plot Notes: None\n\n[Generation Directive]\n${cleanUserPrompt}`;
    }

    const characters = [];
    const magicSystems = [];
    const plotNotes = [];

    for (const entry of retrievedLore) {
      const cat = (entry.category || '').toLowerCase();
      const aliasStr = entry.aliases 
        ? ` [Aliases: ${Array.isArray(entry.aliases) ? entry.aliases.join(', ') : entry.aliases}]` 
        : '';
      const rulesStr = entry.rules ? ` (Constraints: ${entry.rules.trim()})` : '';
      const contentRaw = entry.content || entry.canonicalLore || '';
      const snippet = contentRaw.length > 300 ? contentRaw.slice(0, 300) + '...' : contentRaw;
      const formattedEntry = `<${entry.category || 'Entity'}: ${entry.title || 'Untitled'}>${aliasStr}${rulesStr} -> ${snippet.trim()}`;

      if (cat.includes('char')) {
        characters.push(formattedEntry);
      } else if (cat.includes('magic') || cat.includes('power') || cat.includes('cultivat') || cat.includes('realm') || cat.includes('system')) {
        magicSystems.push(formattedEntry);
      } else {
        plotNotes.push(formattedEntry);
      }
    }

    const charText = characters.length > 0 ? characters.join('; ') : 'None';
    const magicText = magicSystems.length > 0 ? magicSystems.join('; ') : 'None';
    const plotText = plotNotes.length > 0 ? plotNotes.join('; ') : 'None';

    return `[Context Reference - Retrieved Entities]
- Characters: ${charText}
- Magic/Power System: ${magicText}
- Relevant Plot Notes: ${plotText}

[Generation Directive]
${cleanUserPrompt}`;
  }
}
