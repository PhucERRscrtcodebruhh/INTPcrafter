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

  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  register: (username, password) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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

  sendChatStream: async (payload, { onRag, onChunk, onDone, onError }) => {
    try {
      const token = localStorage.getItem('storycontainer_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('storycontainer_token');
          localStorage.removeItem('storycontainer_user');
          window.dispatchEvent(new Event('auth:logout'));
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventType === 'rag' && onRag) onRag(parsed);
              else if (eventType === 'chunk' && onChunk) onChunk(parsed.text);
              else if (eventType === 'done' && onDone) onDone(parsed);
              else if (eventType === 'error' && onError) onError(new Error(parsed.error));
            } catch (e) {
              console.warn('Failed to parse SSE event data:', e);
            }
          }
        }
      }
    } catch (err) {
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
};
