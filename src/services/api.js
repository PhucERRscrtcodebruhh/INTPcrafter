const BASE_URL = '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const token = localStorage.getItem('storycontainer_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('storycontainer_token');
      localStorage.removeItem('storycontainer_user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  return response.json();
}

export const api = {
  // System Health
  getHealth: () => request('/health'),

  // Sessions
  getSessions: () => request('/sessions'),
  createSession: (title, book_id = null) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, book_id }),
  }),
  updateSession: (id, data) => request(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(typeof data === 'string' ? { title: data } : data),
  }),
  deleteSession: (id) => request(`/sessions/${id}`, {
    method: 'DELETE',
  }),
  getSessionMessages: (id) => request(`/sessions/${id}/messages`),
  seedFirstSession: (sessionId, userMessage, guideMessage) => request('/chat/first-session-seed', {
    method: 'POST',
    body: JSON.stringify({ sessionId, userMessage, guideMessage }),
  }),

  // Messages CRUD
  updateMessage: (id, content) => request(`/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
  deleteMessage: (id) => request(`/messages/${id}`, {
    method: 'DELETE',
  }),
  truncateMessagesFrom: (sessionId, messageId) => request(`/sessions/${sessionId}/messages/from/${messageId}`, {
    method: 'DELETE',
  }),

  // Auth (Gmail account based)
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (email, password, displayName = '') => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  }),
  getMe: () => request('/auth/me'),
  uploadAvatar: (avatar) => request('/auth/avatar', {
    method: 'POST',
    body: JSON.stringify({ avatar })
  }),
  getAvatar: () => request('/auth/avatar'),
  updateLanguage: (language) => request('/auth/language', {
    method: 'PUT',
    body: JSON.stringify({ language })
  }),

  // Chat Execution
  sendChat: (payload) => request('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  sendChatStream: async (payload, { onRag, onChunk, onDone, onError, signal }) => {
    try {
      const token = localStorage.getItem('storycontainer_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('storycontainer_token');
          localStorage.removeItem('storycontainer_user');
          window.dispatchEvent(new Event('auth:logout'));
        }
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error || `HTTP error ${response.status}`);
        err.status = response.status;
        const is429 = response.status === 429 || (errorData.error && String(errorData.error).includes('RESOURCE_EXHAUSTED'));
        err.type = is429 ? 'rate_limit' : (response.status === 401 ? 'auth' : (response.status === 504 ? 'network' : 'server'));
        throw err;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let didFinishOrError = false;
      let accumulatedChunks = '';

      const processPart = (part) => {
        const lines = part.split('\n');
        let eventType = 'message';
        const dataLines = [];

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6));
          } else if (line === 'data:') {
            dataLines.push('');
          }
        }

        const eventData = dataLines.join('\n').trim();

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData);
            if (eventType === 'rag' && onRag) {
              onRag(parsed);
            } else if (eventType === 'chunk') {
              accumulatedChunks += (parsed.text || '');
              if (onChunk) onChunk(parsed.text);
            } else if (eventType === 'done') {
              didFinishOrError = true;
              if (onDone) onDone(parsed);
            } else if (eventType === 'error') {
              didFinishOrError = true;
              const streamErr = new Error(parsed.error || 'Generation stream error');
              streamErr.type = parsed.type || (parsed.status === 429 ? 'rate_limit' : 'server');
              streamErr.code = parsed.code;
              streamErr.status = parsed.status || 500;
              streamErr.details = parsed.details;
              streamErr.hasStreamStarted = parsed.hasStreamStarted;
              streamErr.partialText = parsed.partialText;
              if (onError) onError(streamErr);
            }
          } catch (e) {
            console.warn('Failed to parse SSE event data:', e);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            const remainingParts = buffer.split('\n\n');
            for (const part of remainingParts) {
              if (part.trim()) processPart(part);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          processPart(part);
        }
      }

      if (!didFinishOrError) {
        if (accumulatedChunks.trim()) {
          if (onDone) onDone({ fullReply: accumulatedChunks });
        } else {
          const cutErr = new Error('Stream connection closed unexpectedly (timeout or network interruption).');
          cutErr.type = 'network';
          cutErr.status = 504;
          cutErr.code = 'NETWORK_TIMEOUT';
          if (onError) onError(cutErr);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        // Stream aborted gracefully by user or navigation
        return;
      }
      if (onError) onError(err);
      else throw err;
    }
  },

  // Multi-World / Lore Books
  getBooks: () => request('/books'),
  createBook: (bookData) => request('/books', {
    method: 'POST',
    body: JSON.stringify(bookData),
  }),
  updateBook: (id, bookData) => request(`/books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(bookData),
  }),
  deleteBook: (id) => request(`/books/${id}`, {
    method: 'DELETE',
  }),
  getBookEntries: (bookId, params = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    const queryString = query.toString();
    return request(`/books/${bookId}/entries${queryString ? `?${queryString}` : ''}`);
  },

  // Lorebook
  getLore: (params = {}) => {
    const query = new URLSearchParams();
    if (params.book_id) query.set('book_id', params.book_id);
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    const queryString = query.toString();
    return request(`/lore${queryString ? `?${queryString}` : ''}`);
  },
  createLore: (loreData) => request('/lore', {
    method: 'POST',
    body: JSON.stringify(loreData),
  }),
  updateLore: (id, loreData) => request(`/lore/${id}`, {
    method: 'PUT',
    body: JSON.stringify(loreData),
  }),
  deleteLore: (id) => request(`/lore/${id}`, {
    method: 'DELETE',
  }),

  // Live State (HEAD) Overlay API
  getLiveStates: (bookId) => request(`/lore/${bookId}/states`),
  upsertLiveState: (bookId, entryId, delta) => request(`/lore/${bookId}/entries/${entryId}/state`, {
    method: 'PUT',
    body: JSON.stringify(delta),
  }),
  clearLiveState: (bookId, entryId) => request(`/lore/${bookId}/entries/${entryId}/state`, {
    method: 'DELETE',
  }),

  // RAG cache telemetry & manual invalidation
  getRagStats: () => request('/rag/stats'),
  invalidateRagCache: (bookId = null) => request('/rag/invalidate', {
    method: 'POST',
    body: JSON.stringify({ bookId }),
  }),

  // Graph State & Canvas Persistence
  getGraphState: (worldId) => request(`/graph/${worldId}`),
  saveGraphState: (worldId, graphData) => request(`/graph/${worldId}`, {
    method: 'POST',
    body: JSON.stringify(graphData),
  }),

  // API Key Pool (Multi-Provider: gemini, deepseek, openrouter, huggingface)
  getKeys: (provider = null) => {
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    return request(`/keys${query}`);
  },
  updateKeys: (keys, provider = 'gemini', baseUrl = null) => request('/keys', {
    method: 'POST',
    body: JSON.stringify({ keys, provider, baseUrl }),
  }),
  testKey: (key, provider = 'gemini', baseUrl = null) => request('/keys/test', {
    method: 'POST',
    body: JSON.stringify({ key, provider, baseUrl }),
  }),
  resetKeys: (provider = null) => request('/keys/reset', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  }),
  addKey: (key, provider = 'gemini', baseUrl = null) => request('/keys', { 
    method: 'POST', 
    body: JSON.stringify({ key, provider, baseUrl }) 
  }),
  removeKey: (keyId) => request('/keys/' + keyId, { 
    method: 'DELETE' 
  }),

  // Master System Instruction
  getInstruction: () => request('/config/instruction'),
  updateInstruction: (instruction) => request('/config/instruction', {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  }),

  // Chronicle Journal (Blank RAG Lore)
  getSessionJournal: (sessionId) => request(`/sessions/${sessionId}/journal`),
  updateSessionJournal: (sessionId, blankRagLore, updateBookDefault = false) => request(`/sessions/${sessionId}/journal`, {
    method: 'PUT',
    body: JSON.stringify({ blankRagLore, updateBookDefault }),
  }),
  updateBookJournal: (bookId, blankRagLore) => request(`/books/${bookId}/journal`, {
    method: 'PUT',
    body: JSON.stringify({ blankRagLore }),
  }),
  compactSession: (sessionId, keepRecent = 10) => request(`/sessions/${sessionId}/compact`, {
    method: 'POST',
    body: JSON.stringify({ keepRecent }),
  }),
};
