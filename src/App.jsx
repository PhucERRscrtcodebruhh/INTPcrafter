import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import ChatCanvas from './components/ChatCanvas';
import LorebookDashboard from './components/LorebookDashboard';
import LoginModal from './components/LoginModal';
import { api } from './services/api';
import { estimateTokens } from './services/tokenEstimator';

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
- **Sửa prompt** (Edit) — Sửa lại lời nói quá khứ
- **Regenerate** (↻) — Bắt AI viết lại
- **Xóa** (🗑) — Xóa tin nhắn
- **\`<thinking>\`** — Xem AI suy nghĩ gì bên trong

## 🔐 Tài khoản
- Đăng ký tài khoản riêng để lưu session & API key cá nhân
- Tài khoản dev (ID: 0 / pass: 0000) dùng để test — không có API key

---
*Xóa tin nhắn này khi bạn đã sẵn sàng. Chúc vui! 🚀*`;

const DEFAULT_FIRST_SESSION_TITLE = 'tôi chuyển sinh thành con ng và báo thù các INTP';
const DEFAULT_FIRST_PROMPT = 'gemigay884# sau khi bị các INTP hành cho lag máy với 20 chủ đề ko liên quan đến nhau đã nuôi ý định báo thù các INTP cho ra bã để họ nghĩ ít lại';

export default function App() {
  const [currentView, setCurrentView] = useState('studio'); // 'studio' | 'lorebook'
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  
  // Model and parameters
  const [model, setModel] = useState('gemini-3.8-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [maxOutputTokens, setMaxOutputTokens] = useState(4096);

  // Context & Token Tracking
  const [currentTokens, setCurrentTokens] = useState(0);
  const [rollingThreshold, setRollingThreshold] = useState(32768);
  const [isRolled, setIsRolled] = useState(false);
  const [historyStats, setHistoryStats] = useState(null);

  // Streaming & Realtime Typing States
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingLore, setStreamingLore] = useState([]);

  // Lore Drawer State
  const [retrievedLore, setRetrievedLore] = useState([]);
  const [loreDrawerOpen, setLoreDrawerOpen] = useState(false);

  // System & Key telemetry
  const [keyStats, setKeyStats] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  // Auth state — default to dev account (open-source test, id:0, no API key)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('storycontainer_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached user:', e);
      }
    }
    const defaultDev = {
      id: 0,
      username: 'dev',
      displayName: 'INTP Dev Architect',
      role: 'developer',
      avatar: null
    };
    localStorage.setItem('storycontainer_user', JSON.stringify(defaultDev));
    return defaultDev;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Language state
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('storycontainer_language');
    return saved || 'vi';
  });

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
    loadSessions();
    loadBooks();
    loadKeyPoolTelemetry();

    // Listen for auth:logout event (from api.js 401 handler)
    const handleAuthLogout = () => {
      const defaultDev = {
        id: 0,
        username: 'dev',
        displayName: 'INTP Dev Architect',
        role: 'developer',
        avatar: null
      };
      setCurrentUser(defaultDev);
      localStorage.setItem('storycontainer_user', JSON.stringify(defaultDev));
      loadSessions();
      loadBooks();
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
    };
  }, []);

  // Reload sessions & books when user changes
  useEffect(() => {
    loadSessions();
    loadBooks();
    loadKeyPoolTelemetry();
  }, [currentUser?.id]);

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

        // Insert default first prompt and guide message via direct API
        try {
          // Insert user's first message (default prompt)
          await fetch('/api/chat/first-session-seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: newSession.id,
              userMessage: DEFAULT_FIRST_PROMPT,
              guideMessage: FIRST_SESSION_GUIDE
            })
          }).catch(() => {
            // Fallback: insert directly via messages endpoints won't work (no direct insert)
            // The guide will be shown as a local-only message
          });
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

  // Load messages whenever active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    }
  }, [activeSessionId]);

  const loadMessages = async (sessionId) => {
    try {
      const msgs = await api.getSessionMessages(sessionId);
      setMessages(msgs);

      // Compute estimated tokens in active context
      let totalEst = 0;
      msgs.forEach(m => {
        totalEst += estimateTokens(m.content) + 4;
      });
      setCurrentTokens(totalEst);

      // Extract last message retrieved lore if available
      const lastModelMsg = [...msgs].reverse().find(m => m.role === 'model' && m.retrievedLore?.length > 0);
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

  // BYOK Guard: Check if user has API keys before sending chat
  const checkByokKeys = () => {
    if (keyStats.length === 0) {
      setErrorMessage(
        currentUser?.id === 0
          ? 'Tài khoản dev (test) chưa có API Key. Vào World Config & Lorebook → Key Pool để thêm key, hoặc đăng ký tài khoản riêng.'
          : 'Chưa có API Key! Vào World Config & Lorebook → Key Pool để thêm Gemini API Key (BYOK). Lấy key tại: https://aistudio.google.com/apikey'
      );
      return false;
    }
    return true;
  };

  // Streaming Chat Execution with Typing Effect & RAG Key Pool Fallback
  const executeChatStream = async (userPrompt) => {
    if (!userPrompt?.trim() || !activeSessionId || isLoading || isStreaming) return;

    // BYOK check
    if (!checkByokKeys()) return;

    const cleanPrompt = userPrompt.trim();
    setIsLoading(true);
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

    try {
      await api.sendChatStream({
        sessionId: activeSessionId,
        prompt: cleanPrompt,
        model,
        temperature,
        topP,
        maxOutputTokens,
        contextRollingThreshold: rollingThreshold,
      }, {
        onRag: (ragData) => {
          if (ragData?.retrievedLore?.length > 0) {
            setStreamingLore(ragData.retrievedLore);
            setRetrievedLore(ragData.retrievedLore);
          }
        },
        onChunk: (chunkText) => {
          setIsLoading(false);
          setIsStreaming(true);
          setStreamingText(prev => prev + chunkText);
        },
        onDone: async (doneData) => {
          setIsStreaming(false);
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
          console.error('Chat stream error:', err);
          setErrorMessage(err.message || 'Error executing world simulation stream');
          setIsStreaming(false);
          setStreamingText('');
          loadMessages(activeSessionId);
        }
      });
    } catch (err) {
      console.error('Chat error:', err);
      const msg = err.message || 'Error executing world simulation';
      setErrorMessage(msg);
      loadMessages(activeSessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!prompt.trim()) return;
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
    if (!activeSessionId || isLoading || isStreaming) return;

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
    const defaultDev = {
      id: 0,
      username: 'dev',
      displayName: 'INTP Dev Architect',
      role: 'developer',
      avatar: null
    };
    localStorage.setItem('storycontainer_user', JSON.stringify(defaultDev));
    setCurrentUser(defaultDev);
    setActiveSessionId(null);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('storycontainer_language', lang);
    // Persist to server if logged in as registered user
    if (currentUser?.id > 0) {
      api.updateLanguage(lang).catch(() => {});
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-950 text-slate-200 overflow-hidden select-none font-mono">
      {/* Top Navbar (Hidden in Zen Mode) */}
      {!isZenMode && (
        <Navbar
          currentView={currentView}
          onToggleView={(view) => setCurrentView(view)}
          activeModel={model}
          keyStats={keyStats}
          loreDrawerOpen={loreDrawerOpen}
          onToggleLoreDrawer={() => setLoreDrawerOpen(!loreDrawerOpen)}
          retrievedCount={retrievedLore.length}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          language={language}
          onLanguageChange={handleLanguageChange}
          isZenMode={isZenMode}
          onToggleZenMode={() => setIsZenMode(!isZenMode)}
        />
      )}

      {/* Floating Zen Mode Indicator when active */}
      {isZenMode && (
        <div className="fixed top-2 right-4 z-50 flex items-center space-x-2 bg-cyber-950/90 border border-purple-500/40 px-3 py-1 rounded-full text-xs text-purple-300 backdrop-blur-md shadow-glow-cyan-sm animate-fadeIn">
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
            onSelectSession={(id) => setActiveSessionId(id)}
            onCreateSession={handleCreateSession}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            messages={messages}
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
            onUpdateRollingThreshold={(val) => setRollingThreshold(val)}
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
