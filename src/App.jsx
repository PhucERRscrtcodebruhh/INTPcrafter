import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChatCanvas from './components/ChatCanvas';
import LorebookDashboard from './components/LorebookDashboard';
import LoginModal from './components/LoginModal';
import { api } from './services/api';
import { estimateTokens, getModelSpec } from './services/tokenEstimator';
import {
  PROVIDER_LABELS,
  resolveRequiredProvider,
  getProviderKeys,
  getActiveKeyCount,
  hasActiveKey,
} from './services/keyAvailability';
import { useSettingsStore } from './store/useSettingsStore';


// Default first-session guide message (inserted as model response on first session)
const FIRST_SESSION_GUIDE = `# 🌌 Chào mừng đến với StoryContainer Engine!

Đây là hướng dẫn nhanh cho bạn:

## 🔑 Bước 1: Thêm API Key (BYOK — Bring Your Own Key)
Vào tab **World Config & Lorebook** (hoặc \`Ctrl+K\`) → phần **API Key Pool** → dán Gemini API Key của bạn.
Lấy key miễn phí tại: [Google AI Studio](https://aistudio.google.com/apikey)

## 💬 Bước 2: Bắt đầu viết truyện
Gõ prompt vào ô chat phía dưới → AI sẽ mô phỏng thế giới và viết tiểu thuyết theo chỉ dẫn của bạn.

## 📖 Bước 3: Lorebook — Xây dựng thế giới
Thêm nhân vật, địa điểm, hệ phép thuật, phe phái vào Lorebook.
AI sẽ tự động truy xuất lore liên quan (RAG) khi bạn chat.

## ⚙️ Các nút hữu ích
- **Zen Mode**: Phím \`Ctrl + \\\` hoặc nút góc trên bên phải để ẩn toàn bộ thanh công cụ, tập trung viết lách tối đa.
- **Model**: Chọn giữa Gemini 3.8 Flash, DeepSeek-V3, DeepSeek-R1, OpenRouter hoặc Hugging Face.
- **Ngưỡng cuộn (Rolling Context)**: Tự động lưu riêng cho từng Chronicle.

## 🔐 Tài khoản
- Đăng ký tài khoản riêng để lưu session & API key cá nhân
- Tài khoản dev (ID: 0 / pass: 0000) dùng để test — không có API key

---
*Xóa tin nhắn này khi bạn đã sẵn sàng. Chúc vui! 🚀*`;

const DEFAULT_FIRST_SESSION_TITLE = 'tôi chuyển sinh thành con ng và báo thù các INTP';
const DEFAULT_FIRST_PROMPT = 'gemigay884# sau khi bị các INTP hành cho lag máy với 20 chủ đề ko liên quan đến nhau đã nuôi ý định báo thù các INTP cho ra bã để họ nghĩ ít lại';

const ACTIVE_PROVIDER_KEY = 'storycontainer_active_provider';
const SINGLE_KEY_MODE_KEY = 'storycontainer_single_key_mode';

export default function App() {
  const [currentView, setCurrentView] = useState('studio'); // 'studio' | 'lorebook'
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  
  // Model and parameters
  const [model, setModel] = useState('gemini-3.8-flash');
  const { parameters, updateParameter } = useSettingsStore();
  const temperature = parameters.temperature;
  const setTemperature = (val) => updateParameter('temperature', val);
  const topP = parameters.topP;
  const setTopP = (val) => updateParameter('topP', val);
  const maxOutputTokens = parameters.maxOutputTokens;
  const setMaxOutputTokens = (val) => updateParameter('maxOutputTokens', val);

  // Context & Token Tracking (Bound per chat session)
  const [currentTokens, setCurrentTokens] = useState(0);
  const [rollingThreshold, setRollingThreshold] = useState(32768);
  const [isRolled, setIsRolled] = useState(false);
  const [historyStats, setHistoryStats] = useState(null);
  const rollingDebounceRef = useRef(null);

  // Streaming & Realtime Typing States
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingLore, setStreamingLore] = useState([]);
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Lore Drawer State
  const [retrievedLore, setRetrievedLore] = useState([]);
  const [loreDrawerOpen, setLoreDrawerOpen] = useState(false);

  // System & Key telemetry
  const [keyStats, setKeyStats] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  // Key Vault routing preferences (persisted locally)
  const [activeProvider, setActiveProvider] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    return ['auto', 'gemini', 'deepseek', 'openrouter', 'groq', 'huggingface'].includes(saved)
      ? saved
      : 'auto';
  });
  const [singleKeyMode, setSingleKeyMode] = useState(() => localStorage.getItem(SINGLE_KEY_MODE_KEY) === 'true');

  // Required provider: explicit primary wins, otherwise follow the chosen model.
  const modelProvider = getModelSpec(model)?.provider || 'gemini';
  const requiredProvider = resolveRequiredProvider(activeProvider, modelProvider);
  const requiredProviderLabel = PROVIDER_LABELS[requiredProvider] || requiredProvider;
  const providerKeyCount = getProviderKeys(keyStats, requiredProvider).length;
  const activeKeyCount = getActiveKeyCount(keyStats, requiredProvider);
  const requiredProviderRef = useRef(requiredProvider);
  useEffect(() => {
    requiredProviderRef.current = requiredProvider;
  }, [requiredProvider]);

  // Auth state — a real Gmail account is required (no anonymous / fake dev fallback)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('storycontainer_user');
    const token = localStorage.getItem('storycontainer_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached user:', e);
      }
    }
    return null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(() => !localStorage.getItem('storycontainer_token'));

  // Language state
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('storycontainer_language');
    return saved || 'vi';
  });

  // Summary requirement toggle state
  const [isSummaryReq, setIsSummaryReq] = useState(false);

  // Multiverse Lore Books state
  const [books, setBooks] = useState([]);

  const loadBooks = async () => {
    try {
      const data = await api.getBooks();
      setBooks(data);
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  };

  // Zen Mode (Ctrl + \) — Hides sidebars, topbars, and borders for pure writing canvas
  const [isZenMode, setIsZenMode] = useState(false);

  // Load Initial Data
  useEffect(() => {
    // Listen for auth:logout event (from api.js 401 handler)
    const handleAuthLogout = () => {
      localStorage.removeItem('storycontainer_user');
      localStorage.removeItem('storycontainer_token');
      setCurrentUser(null);
      setActiveSessionId(null);
      setIsLoginModalOpen(true);
    };
    window.addEventListener('auth:logout', handleAuthLogout);

    // Hotkey listener for Ctrl+K (mode switch) and Ctrl+\ (Zen Mode)
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentView(prev => (prev === 'studio' ? 'lorebook' : 'studio'));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault();
        setIsZenMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('auth:logout', handleAuthLogout);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Reload sessions & books when the signed-in user changes
  useEffect(() => {
    if (!currentUser?.id) {
      setSessions([]);
      setBooks([]);
      setKeyStats([]);
      return;
    }
    loadSessions();
    loadBooks();
    loadKeyPoolTelemetry();
  }, [currentUser?.id]);

  const pendingSaveRef = useRef(null);

  const flushPendingRollingThresholdSave = async () => {
    if (pendingSaveRef.current) {
      const { sessionId, val } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (rollingDebounceRef.current) {
        clearTimeout(rollingDebounceRef.current);
        rollingDebounceRef.current = null;
      }
      try {
        await api.updateSession(sessionId, { rolling_threshold: val });
      } catch (err) {
        console.warn('Failed to flush session rolling_threshold save:', err);
      }
    }
  };

  // Synchronize session-specific rollingThreshold whenever active session changes
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      const cached = localStorage.getItem('storycontainer_rolling_' + activeSessionId);
      const sessionThresh = session?.rolling_threshold || session?.rollingThreshold || (cached ? parseInt(cached, 10) : 32768);
      setRollingThreshold(sessionThresh);
    }
  }, [activeSessionId, sessions]);

  // Handler for session selection with immediate save flush of previous session and stream cancellation
  const handleSelectSession = (id) => {
    if (id === activeSessionId) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isGeneratingRef.current = false;
    setIsStreaming(false);
    setIsLoading(false);
    setStreamingText('');
    setStreamingLore([]);
    setRetrievedLore([]);
    setHistoryStats(null);
    setCurrentTokens(0);
    setIsRolled(false);
    setMessages([]);
    flushPendingRollingThresholdSave();
    setActiveSessionId(id);
  };

  // Debounced updater for rolling threshold per session
  const handleUpdateRollingThreshold = (newVal, immediate = false) => {
    const val = parseInt(newVal, 10) || 32768;
    setRollingThreshold(val);

    if (activeSessionId) {
      // 1. Immediately cache in localStorage for instant offline access & persistence
      localStorage.setItem('storycontainer_rolling_' + activeSessionId, val);

      // 2. Immediately update in sessions state
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, rolling_threshold: val } : s));
      pendingSaveRef.current = { sessionId: activeSessionId, val };

      if (rollingDebounceRef.current) {
        clearTimeout(rollingDebounceRef.current);
      }

      if (immediate) {
        flushPendingRollingThresholdSave();
      } else {
        rollingDebounceRef.current = setTimeout(() => {
          flushPendingRollingThresholdSave();
        }, 300);
      }
    }
  };

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      } else if (data.length === 0) {
        // First session for this user → create with default title + onboarding guide
        const newSession = await api.createSession(DEFAULT_FIRST_SESSION_TITLE);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);

        // Insert the onboarding guide + default prompt through the authenticated API
        // (an unauthenticated raw fetch used to 401 silently, leaving a blank chat).
        try {
          await api.seedFirstSession(newSession.id, DEFAULT_FIRST_PROMPT, FIRST_SESSION_GUIDE);
          await loadMessages(newSession.id);
        } catch (seedErr) {
          console.warn('First session seed failed (non-critical):', seedErr);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadKeyPoolTelemetry = async () => {
    try {
      const keys = await api.getKeys();
      setKeyStats(keys);
    } catch (err) {
      console.error('Failed to load key telemetry:', err);
    }
  };

  const handleActiveProviderChange = (provider) => {
    const next = provider || 'auto';
    setActiveProvider(next);
    localStorage.setItem(ACTIVE_PROVIDER_KEY, next);

    const nextRequired = resolveRequiredProvider(next, getModelSpec(model)?.provider || 'gemini');
    if (hasActiveKey(keyStats, nextRequired)) setErrorMessage(null);

    window.dispatchEvent(new CustomEvent('active-provider:changed', { detail: { provider: next } }));
  };

  const handleSingleKeyModeChange = (enabled) => {
    const next = Boolean(enabled);
    setSingleKeyMode(next);
    localStorage.setItem(SINGLE_KEY_MODE_KEY, String(next));
    window.dispatchEvent(new CustomEvent('key-mode:changed', { detail: { singleKeyMode: next } }));
  };

  // The Key Vault dispatches these events after add/delete/reset/save so the global
  // telemetry (and the "no API key" guard) updates instantly without a reload.
  useEffect(() => {
    const onKeysUpdated = async () => {
      try {
        const keys = await api.getKeys();
        setKeyStats(keys);
        if (hasActiveKey(keys, requiredProviderRef.current)) setErrorMessage(null);
      } catch (err) {
        console.error('Failed to refresh key telemetry:', err);
      }
    };
    const onProviderChanged = (e) => setActiveProvider(e.detail?.provider || 'auto');
    const onModeChanged = (e) => setSingleKeyMode(Boolean(e.detail?.singleKeyMode));

    window.addEventListener('keys:updated', onKeysUpdated);
    window.addEventListener('active-provider:changed', onProviderChanged);
    window.addEventListener('key-mode:changed', onModeChanged);
    return () => {
      window.removeEventListener('keys:updated', onKeysUpdated);
      window.removeEventListener('active-provider:changed', onProviderChanged);
      window.removeEventListener('key-mode:changed', onModeChanged);
    };
  }, []);

  // Load messages whenever active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    }
  }, [activeSessionId]);

  const loadMessages = async (sessionId) => {
    try {
      const msgs = await api.getSessionMessages(sessionId);
      setMessages(prev => {
        if (msgs && msgs.length > 0) {
          const hasDbModel = msgs.some(m => m.role === 'model');
          const localPartials = prev.filter(m => m.id && String(m.id).startsWith('partial_'));
          if (!hasDbModel && localPartials.length > 0) {
            return [...msgs, ...localPartials];
          }
          return msgs;
        }
        return msgs || prev;
      });

      // Compute estimated tokens in active context
      let totalEst = 0;
      (msgs || []).forEach(m => {
        totalEst += estimateTokens(m.content) + 4;
      });
      setCurrentTokens(totalEst);

      // Extract last message retrieved lore if available
      const lastModelMsg = [...(msgs || [])].reverse().find(m => m.role === 'model' && m.retrievedLore?.length > 0);
      if (lastModelMsg) {
        setRetrievedLore(lastModelMsg.retrievedLore);
      } else {
        setRetrievedLore([]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Active session and linked world
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const linkedBookId = activeSession?.book_id || null;

  const handleLinkBookToSession = async (bookId) => {
    if (!activeSessionId) return;
    try {
      await api.updateSession(activeSessionId, { book_id: bookId });
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, book_id: bookId } : s));
    } catch (err) {
      console.error('Failed to link world:', err);
      setErrorMessage('Failed to link world: ' + err.message);
    }
  };

  // Session Handlers
  const handleCreateSession = async (title, bookId = null) => {
    try {
      const targetBookId = bookId !== null ? bookId : (books.length > 0 ? books[0].id : null);
      const newSession = await api.createSession(title, targetBookId);
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setCurrentTokens(0);
      setIsRolled(false);
      setRetrievedLore([]);
    } catch (err) {
      setErrorMessage('Failed to create chronicle: ' + err.message);
    }
  };

  const handleRenameSession = async (id, title) => {
    try {
      await api.updateSession(id, title);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    } catch (err) {
      setErrorMessage('Failed to rename chronicle: ' + err.message);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this chronicle session permanently?')) return;
    try {
      await api.deleteSession(id);
      const remaining = sessions.filter(s => s.id !== id);
      setSessions(remaining);
      if (activeSessionId === id) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          handleCreateSession('Chronicle Beta');
        }
      }
    } catch (err) {
      setErrorMessage('Failed to delete chronicle: ' + err.message);
    }
  };

  // BYOK Guard: only the selected/active provider is validated. A pool with a
  // single active key is completely valid (no rotation requirement).
  const checkByokKeys = () => {
    if (!currentUser?.id) {
      setErrorMessage('Bạn chưa đăng nhập. Hãy đăng nhập bằng Gmail để sử dụng engine.');
      return false;
    }

    if (activeKeyCount < 1) {
      const docsHint = requiredProvider === 'gemini'
        ? ' Lấy key tại: https://aistudio.google.com/apikey'
        : requiredProvider === 'groq'
          ? ' Lấy key tại: https://console.groq.com/keys'
          : '';
      if (providerKeyCount > 0) {
        setErrorMessage(
          `Toàn bộ ${providerKeyCount} API Key ${requiredProviderLabel} đang tạm cooldown hoặc bị đánh dấu lỗi. ` +
          'Mở Key Vault → Reset Cooldowns, hoặc chờ hết thời gian rate-limit.'
        );
      } else {
        setErrorMessage(
          `Chưa có API Key đang hoạt động cho ${requiredProviderLabel}. ` +
          `Vào World Config & Lorebook → Key Pool, chọn provider ${requiredProviderLabel} và thêm ít nhất 1 key (BYOK).${docsHint}`
        );
      }
      return false;
    }

    // Valid key exists -> immediately dismiss any stale warning banner.
    setErrorMessage(null);
    return true;
  };

  // Abort user generation
  const handleAbortStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isGeneratingRef.current = false;
    setIsStreaming(false);
    setIsLoading(false);
    if (streamingText && streamingText.trim()) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') return prev;
        return [
          ...prev,
          {
            id: 'partial_' + Date.now(),
            session_id: activeSessionId,
            role: 'model',
            content: streamingText,
            retrieved_lore_ids: '',
            created_at: new Date().toISOString()
          }
        ];
      });
    }
    setStreamingText('');
  };

  // Streaming Chat Execution with Typing Effect & RAG Key Pool Fallback
  const executeChatStream = async (userPrompt) => {
    if (!userPrompt?.trim() || !activeSessionId || isGeneratingRef.current || isLoading || isStreaming) {
      return;
    }

    // BYOK check
    if (!checkByokKeys()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cleanPrompt = userPrompt.trim();
    isGeneratingRef.current = true;
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingText('');
    setStreamingLore([]);
    setErrorMessage(null);

    // Optimistically show user message
    const tempUserMsg = {
      id: 'temp_' + Date.now(),
      session_id: activeSessionId,
      role: 'user',
      content: cleanPrompt,
      retrieved_lore_ids: '',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    let accumulatedText = '';
    const promptToSend = isSummaryReq
      ? `${cleanPrompt}\n\n[INTP DIRECTIVE // SUMMARY REQ: Vui lòng cung cấp thêm một đoạn tóm tắt ngắn (Summary) về các chuyển biến cốt truyện chính của cảnh này ở cuối phản hồi.]`
      : cleanPrompt;

    const currentParams = useSettingsStore.getState().parameters;
    const chatPayload = {
      sessionId: activeSessionId,
      prompt: promptToSend,
      model,
      temperature: currentParams.temperature ?? temperature,
      topP: currentParams.topP ?? topP,
      maxOutputTokens: currentParams.maxOutputTokens ?? maxOutputTokens,
      contextRollingThreshold: currentParams.maxContextTokens || rollingThreshold,
      singleKeyMode,
      modelParameters: currentParams,
    };

    try {
      if (currentParams.disableStreaming) {
        const doneData = await api.sendChat(chatPayload);
        setIsStreaming(false);
        setIsLoading(false);
        setStreamingText('');
        await loadMessages(activeSessionId);

        if (doneData.tokenStats) {
          setCurrentTokens(doneData.tokenStats.totalContextTokens);
          setIsRolled(doneData.tokenStats.isRolled);
          setHistoryStats(doneData.tokenStats.historyStats);
        }

        if (doneData.retrievedLore) {
          setRetrievedLore(doneData.retrievedLore);
        }

        loadKeyPoolTelemetry();
        return;
      }

      await api.sendChatStream(chatPayload, {
        signal: abortControllerRef.current.signal,
        onRag: (ragData) => {
          if (ragData?.retrievedLore?.length > 0) {
            setStreamingLore(ragData.retrievedLore);
            setRetrievedLore(ragData.retrievedLore);
          }
        },
        onChunk: (chunkText) => {
          setIsLoading(false);
          accumulatedText += chunkText;
          setStreamingText(accumulatedText);
        },
        onDone: async (doneData) => {
          setIsStreaming(false);
          setIsLoading(false);
          setStreamingText('');
          await loadMessages(activeSessionId);

          if (doneData.tokenStats) {
            setCurrentTokens(doneData.tokenStats.totalContextTokens);
            setIsRolled(doneData.tokenStats.isRolled);
            setHistoryStats(doneData.tokenStats.historyStats);
          }

          if (doneData.retrievedLore) {
            setRetrievedLore(doneData.retrievedLore);
          }

          loadKeyPoolTelemetry();
        },
        onError: (err) => {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            if (accumulatedText && accumulatedText.trim()) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') return prev;
                return [...prev, {
                  id: 'partial_' + Date.now(),
                  session_id: activeSessionId,
                  role: 'model',
                  content: accumulatedText,
                  retrieved_lore_ids: '',
                  created_at: new Date().toISOString()
                }];
              });
            }
            setIsStreaming(false);
            setIsLoading(false);
            setStreamingText('');
            return;
          }
          console.error('Chat stream error:', err);
          const prefix = err.type === 'rate_limit'
            ? '⏱️ Rate Limit (429): '
            : (err.type === 'auth'
              ? '🔑 Auth Error: '
              : (err.type === 'network' ? '🌐 Network Error: ' : '⚠️ Error: '));
          setErrorMessage(prefix + (err.message || 'Error executing world simulation stream'));
          setIsStreaming(false);
          setIsLoading(false);

          const textToKeep = accumulatedText || err.partialText || '';
          if (textToKeep && textToKeep.trim()) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'model') {
                return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: m.content || textToKeep } : m);
              }
              return [...prev, {
                id: 'partial_' + Date.now(),
                session_id: activeSessionId,
                role: 'model',
                content: textToKeep,
                retrieved_lore_ids: '',
                created_at: new Date().toISOString()
              }];
            });
          }
          setStreamingText('');
          loadMessages(activeSessionId);
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
        console.error('Chat error:', err);
        const prefix = err.type === 'rate_limit'
          ? '⏱️ Rate Limit (429): '
          : (err.type === 'auth'
            ? '🔑 Auth Error: '
            : (err.type === 'network' ? '🌐 Network Error: ' : '⚠️ Error: '));
        const msg = prefix + (err.message || 'Error executing world simulation');
        setErrorMessage(msg);
        if (accumulatedText && accumulatedText.trim()) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model') {
              return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: m.content || accumulatedText } : m);
            }
            return [...prev, {
              id: 'partial_' + Date.now(),
              session_id: activeSessionId,
              role: 'model',
              content: accumulatedText,
              retrieved_lore_ids: '',
              created_at: new Date().toISOString()
            }];
          });
        }
        loadMessages(activeSessionId);
      }
    } finally {
      isGeneratingRef.current = false;
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendChat = async () => {
    if (!prompt.trim() || isGeneratingRef.current || isLoading || isStreaming) return;
    const userPrompt = prompt.trim();
    setPrompt('');
    await executeChatStream(userPrompt);
  };

  // Inline Message Editing (User Prompt or Story Content)
  const handleEditMessage = async (messageId, newContent, shouldRegenerate = false, role = 'user') => {
    try {
      if (!shouldRegenerate) {
        // Save changes without re-running
        await api.updateMessage(messageId, newContent);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
        return;
      }

      if (isGeneratingRef.current || isLoading || isStreaming) return;

      // BYOK check before regenerate
      if (!checkByokKeys()) return;

      // Save & Re-submit flow (User prompt editing)
      // 1. Truncate DB from this prompt onwards (removes this turn and downstream)
      await api.truncateMessagesFrom(activeSessionId, messageId);

      // 2. Remove from local messages state
      const targetIdx = messages.findIndex(m => m.id === messageId);
      if (targetIdx !== -1) {
        setMessages(prev => prev.slice(0, targetIdx));
      }

      // 3. Re-run stream with updated prompt
      await executeChatStream(newContent);
    } catch (err) {
      console.error('Failed to edit message:', err);
      setErrorMessage('Failed to edit turn: ' + err.message);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    try {
      await api.deleteMessage(messageId);
      setMessages(prev => {
        const next = prev.filter(m => m.id !== messageId);
        let totalEst = 0;
        next.forEach(m => {
          totalEst += estimateTokens(m.content) + 4;
        });
        setCurrentTokens(totalEst);
        return next;
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
      setErrorMessage('Failed to delete message: ' + err.message);
    }
  };

  // Regenerate turn (for both AI response or User prompt)
  const handleRegenerateMessage = async (msg) => {
    if (!activeSessionId || isLoading || isStreaming || isGeneratingRef.current) return;

    // BYOK check
    if (!checkByokKeys()) return;

    try {
      let promptToReRun = '';
      let truncateFromId = msg.id;

      if (msg.role === 'user') {
        promptToReRun = msg.content;
        truncateFromId = msg.id;
      } else {
        // Find preceding user prompt
        const msgIdx = messages.findIndex(m => m.id === msg.id);
        const precedingUserMsg = [...messages.slice(0, msgIdx)].reverse().find(m => m.role === 'user');
        if (!precedingUserMsg) {
          setErrorMessage('Cannot regenerate: No preceding prompt found.');
          return;
        }
        promptToReRun = precedingUserMsg.content;
        truncateFromId = precedingUserMsg.id;
      }

      // 1. Truncate database from that prompt onwards
      await api.truncateMessagesFrom(activeSessionId, truncateFromId);

      // 2. Truncate local state
      const targetIdx = messages.findIndex(m => m.id === truncateFromId);
      if (targetIdx !== -1) {
        setMessages(prev => prev.slice(0, targetIdx));
      }

      // 3. Re-execute generation with the prompt
      await executeChatStream(promptToReRun);
    } catch (err) {
      console.error('Failed to regenerate turn:', err);
      setErrorMessage('Failed to regenerate: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('storycontainer_token');
    localStorage.removeItem('storycontainer_user');
    setCurrentUser(null);
    setActiveSessionId(null);
    setIsLoginModalOpen(true);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('storycontainer_language', lang);
    // Persist to server for the signed-in account
    if (currentUser?.id) {
      api.updateLanguage(lang).catch(() => {});
    }
  };

  const userLabel = String(currentUser?.username || currentUser?.displayName || 'USR').trim() || 'USR';
  const userAvatarSrc = typeof currentUser?.avatar === 'string' && currentUser.avatar.startsWith('data:image/')
    ? currentUser.avatar
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-950 text-slate-200 overflow-hidden select-none font-mono">
      {/* Floating Top-Right User HUD Badge */}
      <div className="fixed top-2.5 right-3 z-40 flex items-center">
        {currentUser ? (
          <div className="group flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full border border-cyan-400/35 bg-cyber-950/85 backdrop-blur-md shadow-[0_0_14px_rgba(0,240,255,0.10)] hover:border-emerald-300/60 transition-all">
            {/* Avatar ring + live status dot */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-br from-cyan-400/80 via-cyan-500/30 to-emerald-400/80 shadow-[0_0_10px_rgba(0,240,255,0.18)]">
                <div className="w-full h-full rounded-full bg-cyber-950 border border-cyan-300/30 flex items-center justify-center overflow-hidden">
                  {userAvatarSrc ? (
                    <img src={userAvatarSrc} alt={userLabel} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-extrabold tracking-wider text-cyan-200 uppercase">
                      {userLabel.slice(0, 2)}
                    </span>
                  )}
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-cyber-950 shadow-[0_0_6px_rgba(0,255,170,0.8)]" />
            </div>

            {/* User label */}
            <div className="hidden sm:flex flex-col leading-none pr-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100 truncate max-w-[120px]">
                {userLabel}
              </span>
              <span className="text-[8.5px] text-emerald-400/80 tracking-[0.2em] mt-0.5 font-mono">
                USR // ONLINE
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-300 hover:bg-rose-950/60 text-[10px] transition-colors"
              title="Đăng xuất"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-cyan-400/35 bg-cyber-950/85 hover:border-emerald-300/60 text-cyan-200 text-[10px] font-bold uppercase tracking-[0.14em] shadow-glow-cyan-sm transition-all"
          >
            <span className="relative shrink-0">
              <span className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-br from-cyan-400/80 via-cyan-500/30 to-emerald-400/80 flex">
                <span className="w-full h-full rounded-full bg-cyber-950 border border-cyan-300/30 flex items-center justify-center text-[10px] font-extrabold tracking-wider text-cyan-200">
                  USR
                </span>
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-cyber-950" />
            </span>
            Đăng nhập
          </button>
        )}
      </div>

      {/* Floating Zen Mode Indicator when active */}
      {isZenMode && (
        <div className="fixed top-2 left-4 z-50 flex items-center space-x-2 bg-cyber-950/90 border border-purple-500/40 px-3 py-1 rounded-full text-xs text-purple-300 backdrop-blur-md shadow-glow-cyan-sm animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-semibold">Zen Mode</span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(Ctrl+\)</span>
          <button 
            onClick={() => setIsZenMode(false)}
            className="hover:text-white p-0.5 ml-1 text-slate-400"
            title="Exit Zen Mode"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 px-4 py-2 text-xs text-rose-200 flex items-center justify-between z-40">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace (Dual View) */}
      <main className="flex-1 flex overflow-hidden">
        {currentView === 'studio' ? (
          <ChatCanvas
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateSession}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            messages={messages}
            onReloadMessages={() => {
              if (activeSessionId) {
                loadMessages(activeSessionId);
              }
              loadSessions();
            }}
            isLoading={isLoading}
            isStreaming={isStreaming}
            streamingText={streamingText}
            streamingLore={streamingLore}
            prompt={prompt}
            setPrompt={setPrompt}
            onSendChat={handleSendChat}
            model={model}
            setModel={setModel}
            temperature={temperature}
            setTemperature={setTemperature}
            topP={topP}
            setTopP={setTopP}
            maxOutputTokens={maxOutputTokens}
            setMaxOutputTokens={setMaxOutputTokens}
            currentTokens={currentTokens}
            rollingThreshold={rollingThreshold}
            onUpdateRollingThreshold={handleUpdateRollingThreshold}
            isRolled={isRolled}
            historyStats={historyStats}
            retrievedLore={retrievedLore}
            loreDrawerOpen={loreDrawerOpen}
            setLoreDrawerOpen={setLoreDrawerOpen}
            onNavigateToLorebook={() => setCurrentView('lorebook')}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onRegenerateMessage={handleRegenerateMessage}
            books={books}
            activeBookId={linkedBookId}
            onLinkBook={handleLinkBookToSession}
            isZenMode={isZenMode}
            onAbort={handleAbortStream}
            keyStats={keyStats}
            activeProvider={activeProvider}
            requiredProvider={requiredProvider}
            onActiveProviderChange={handleActiveProviderChange}
            singleKeyMode={singleKeyMode}
            onSingleKeyModeChange={handleSingleKeyModeChange}
            currentUser={currentUser}
            language={language}
            onLanguageChange={handleLanguageChange}
            isSummaryReq={isSummaryReq}
            setIsSummaryReq={setIsSummaryReq}
          />
        ) : (
          <LorebookDashboard
            onBackToStudio={() => setCurrentView('studio')}
            books={books}
            onBooksChanged={setBooks}
            activeBookId={linkedBookId}
            onSelectBook={handleLinkBookToSession}
          />
        )}
      </main>

      {/* Login & Register Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setActiveSessionId(null); // Reset to load user's sessions
        }}
      />
    </div>
  );
}
