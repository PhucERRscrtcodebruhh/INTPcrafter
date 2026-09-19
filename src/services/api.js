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
  createSession: (title) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),
  updateSession: (id, title) => request(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
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

  // Lorebook
  getLore: (params = {}) => {
    const query = new URLSearchParams();
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

  // API Key Pool
  getKeys: () => request('/keys'),
  updateKeys: (keys) => request('/keys', {
    method: 'POST',
    body: JSON.stringify({ keys }),
  }),
  testKey: (key) => request('/keys/test', {
    method: 'POST',
    body: JSON.stringify({ key }),
  }),
  resetKeys: () => request('/keys/reset', {
    method: 'POST',
  }),
  addKey: (key) => request('/keys', { 
    method: 'POST', 
    body: JSON.stringify({ key }) 
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
