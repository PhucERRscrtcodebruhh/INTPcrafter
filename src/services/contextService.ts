import { openDB, type IDBPDatabase } from 'idb';

export interface ChatMessage {
  id: string | number;
  session_id: string;
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
  retrieved_lore_ids?: string;
  retrievedLore?: any[];
  created_at?: string;
  [key: string]: any;
}

export interface AssembleContextOptions {
  userPrompt?: string;
  tier1Core?: string;
  tier2Arc?: string;
  blankRagLore?: string;
  retrievedLore?: any[];
  slidingWindowSize?: number;
}

const DB_NAME = 'INTPcrafter_ChatDB';
const DB_VERSION = 1;
const STORE_NAME = 'chat_messages';

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Ensures indexedDB is available in Node/testing environments
 */
async function ensureIndexedDB() {
  if (typeof globalThis.indexedDB === 'undefined' || typeof globalThis.IDBRequest === 'undefined') {
    try {
      const fake = await import('fake-indexeddb');
      for (const [key, val] of Object.entries(fake)) {
        if (key !== 'default' && typeof (globalThis as any)[key] === 'undefined') {
          (globalThis as any)[key] = val;
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Initializes and returns the persistent IndexedDB database instance.
 */
export async function getDB(): Promise<IDBPDatabase> {
  await ensureIndexedDB();
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_session', 'session_id', { unique: false });
          store.createIndex('by_created_at', 'created_at', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Persists an array of chat messages into IndexedDB.
 * Never mutates or slices the master store.
 */
export async function saveMessagesToStore(messages: ChatMessage[]): Promise<void> {
  if (!Array.isArray(messages) || messages.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const msg of messages) {
    if (!msg || msg.id === undefined || msg.id === null) continue;
    await tx.store.put({
      ...msg,
      id: String(msg.id),
      session_id: String(msg.session_id || 'default'),
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: typeof msg.content === 'string' ? msg.content : '',
      created_at: msg.created_at || new Date().toISOString()
    });
  }
  await tx.done;
}

/**
 * Persists a single chat message into IndexedDB.
 */
export async function saveMessageToStore(message: ChatMessage): Promise<void> {
  return saveMessagesToStore([message]);
}

/**
 * Retrieves all chat messages for a specific session directly from IndexedDB.
 */
export async function getMessagesFromStore(sessionId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  const sid = String(sessionId);
  const rawList = await db.getAllFromIndex(STORE_NAME, 'by_session', sid);

  // Chronologically stable sort
  return [...rawList].sort((a, b) => {
    if (a.created_at && b.created_at) {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (diff !== 0) return diff;
    }
    const numA = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

/**
 * Clears all messages for a specific session from IndexedDB.
 */
export async function clearSessionMessagesFromStore(sessionId: string): Promise<void> {
  const db = await getDB();
  const sid = String(sessionId);
  const records = await db.getAllFromIndex(STORE_NAME, 'by_session', sid);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const r of records) {
    await tx.store.delete(r.id);
  }
  await tx.done;
}

/**
 * Wipes the entire chat_messages store (used for test teardown / reset).
 */
export async function clearAllMessagesStore(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Seeds the store with mock chat messages (e.g. 320 messages for testing).
 */
export async function seedChatMessages(
  sessionId: string,
  countOrMessages: number | ChatMessage[]
): Promise<ChatMessage[]> {
  const sid = String(sessionId);
  let messagesToSeed: ChatMessage[] = [];

  if (Array.isArray(countOrMessages)) {
    messagesToSeed = countOrMessages.map(m => ({ ...m, session_id: sid }));
  } else {
    const count = typeof countOrMessages === 'number' ? countOrMessages : 320;
    const baseTime = Date.now() - count * 60000;
    for (let i = 1; i <= count; i++) {
      const isUser = i % 2 !== 0;
      messagesToSeed.push({
        id: `msg_${sid}_${String(i).padStart(4, '0')}`,
        session_id: sid,
        role: isUser ? 'user' : 'assistant',
        content: isUser
          ? `[Turn ${i}] Chapter ${(Math.floor((i - 1) / 20)) + 1} Directive: Advance chronicle narrative step ${i}.`
          : `[Turn ${i}] Chapter ${(Math.floor((i - 1) / 20)) + 1} Chronicle Log: INTP World Simulator generated event response for turn ${i}. All world constraints hold.`,
        created_at: new Date(baseTime + i * 60000).toISOString()
      });
    }
  }

  await saveMessagesToStore(messagesToSeed);
  return messagesToSeed;
}

/**
 * Tier 3 Context Assembly:
 * Strictly reads from the persistent IndexedDB store (Data Layer),
 * completely isolated and decoupled from whatever slice is rendered in the Virtual DOM.
 *
 * All past messages (e.g., 320+ messages) remain intact and accessible to the context builder.
 */
export async function assembleTier3Context(
  sessionId: string,
  options?: AssembleContextOptions
): Promise<ChatMessage[]> {
  if (!sessionId) {
    throw new Error('assembleTier3Context requires a valid sessionId');
  }

  // 1. Always query the complete IndexedDB session records as the single source of truth
  const fullHistory = await getMessagesFromStore(sessionId);

  // 2. Normalize conversation turns for context pipeline
  const normalizedContext: ChatMessage[] = fullHistory.map(msg => ({
    id: msg.id,
    session_id: msg.session_id,
    role: (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user',
    content: typeof msg.content === 'string' ? msg.content : '',
    retrieved_lore_ids: msg.retrieved_lore_ids || '',
    retrievedLore: msg.retrievedLore || [],
    created_at: msg.created_at
  }));

  // 3. If a current prompt is passed, assemble the terminal turn directive
  if (options?.userPrompt && options.userPrompt.trim()) {
    const promptParts: string[] = [];

    if (options.blankRagLore && options.blankRagLore.trim()) {
      promptParts.push(`[USER CHRONICLE JOURNAL // BLANK RAG LORE]\n${options.blankRagLore.trim()}\n[END OF USER CHRONICLE JOURNAL]`);
    }

    if (Array.isArray(options.retrievedLore) && options.retrievedLore.length > 0) {
      promptParts.push(`[Context Reference - Retrieved Entities]\n${JSON.stringify(options.retrievedLore)}`);
    }

    promptParts.push(`[Generation Directive]\n${options.userPrompt.trim()}`);
    const terminalPrompt = promptParts.join('\n\n');

    normalizedContext.push({
      id: `terminal_${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: terminalPrompt,
      created_at: new Date().toISOString()
    });
  }

  // Entire session history (all 320 items) remains intact without truncation or DOM pollution
  return normalizedContext;
}
