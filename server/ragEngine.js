import { pool } from './db.js';

/**
 * Lightweight MySQL Keyword & Full-Text RAG Engine for StoryContainer
 */
export class RAGEngine {
  /**
   * Scans prompt and up to 3 recent messages to retrieve relevant lore
   */
  static async retrieveLore({ currentPrompt, recentMessages = [], maxResults = 5, bookId = undefined }) {
    // If explicitly null (unlinked session), return empty RAG context to respect world isolation
    if (bookId === null) {
      return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
    }

    const effectiveBookId = bookId !== undefined ? bookId : 1;

    // Combine current prompt and up to 3 previous messages
    const textPool = [
      currentPrompt || '',
      ...recentMessages.slice(-3).map(m => m.content || '')
    ].join('\n');

    if (!textPool.trim()) {
      return { retrievedLore: [], formattedContext: '', retrievedLoreIds: '' };
    }

    try {
      // 1. First, fetch all titles and aliases for direct mention matching in target book
      const [allEntries] = await pool.query(
        `SELECT id, book_id, category, title, aliases, content, rules FROM lore_entries WHERE book_id = ?`,
        [effectiveBookId]
      );
      const matchedMap = new Map();

      const lowerText = textPool.toLowerCase();

      // Check direct entity mentions in title or aliases
      for (const entry of allEntries) {
        const titleMatch = entry.title && lowerText.includes(entry.title.toLowerCase());
        let aliasMatch = false;

        if (entry.aliases) {
          const aliasList = Array.isArray(entry.aliases)
            ? entry.aliases
            : (typeof entry.aliases === 'string' ? entry.aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean) : []);
          aliasMatch = aliasList.some(alias => alias.length > 2 && lowerText.includes(alias.toLowerCase()));
        }

        if (titleMatch || aliasMatch) {
          matchedMap.set(entry.id, {
            ...entry,
            score: titleMatch ? 100 : 75,
            matchReason: titleMatch ? 'Direct title mention' : 'Alias mention'
          });
        }
      }

      // 2. Perform Keyword / Fulltext Search on Content
      const searchTerms = this.extractSearchTerms(currentPrompt);
      if (searchTerms.length > 0 && matchedMap.size < maxResults) {
        const fulltextQuery = searchTerms.join(' ');
        
        try {
          // Attempt MySQL Natural Language Fulltext query scoped to effectiveBookId
          const [ftRows] = await pool.query(
            `SELECT id, book_id, category, title, aliases, content, rules,
                    MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
             FROM lore_entries
             WHERE book_id = ? AND MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE) > 0.01
             ORDER BY relevance DESC
             LIMIT ?`,
            [fulltextQuery, effectiveBookId, fulltextQuery, maxResults]
          );

          for (const row of ftRows) {
            if (!matchedMap.has(row.id)) {
              matchedMap.set(row.id, {
                ...row,
                score: 50 + (row.relevance || 0),
                matchReason: 'Fulltext content relevance'
              });
            }
          }
        } catch (ftErr) {
          // Fallback to LIKE query if fulltext index is not available or query errors
          const likePattern = `%${searchTerms[0]}%`;
          const [likeRows] = await pool.query(
            `SELECT id, book_id, category, title, aliases, content, rules
             FROM lore_entries
             WHERE book_id = ? AND (title LIKE ? OR aliases LIKE ? OR content LIKE ?)
             LIMIT ?`,
            [effectiveBookId, likePattern, likePattern, likePattern, maxResults]
          );

          for (const row of likeRows) {
            if (!matchedMap.has(row.id)) {
              matchedMap.set(row.id, {
                ...row,
                score: 40,
                matchReason: 'Keyword LIKE match'
              });
            }
          }
        }
      }

      // Convert to array, sort by relevance score, limit to maxResults
      const results = Array.from(matchedMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      const retrievedLoreIds = results.map(r => r.id).join(',');
      const formattedContext = this.formatContextBlock(results);

      return {
        retrievedLore: results,
        formattedContext,
        retrievedLoreIds
      };
    } catch (err) {
      console.error('[RAG] Retrieval error:', err);
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
      const aliasesStr = entry.aliases ? `Aliases: ${entry.aliases}` : '';
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
   * Strictly formatted for terminal user message in prefix-caching architecture:
   * [Context Reference - Retrieved Entities]
   * - Characters: <rag_characters_with_tags>
   * - Magic/Power System: <rag_magic_system_tags>
   * - Relevant Plot Notes: <rag_plot_snippets>
   * 
   * [Generation Directive]
   * <user_prompt_instruction>
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
