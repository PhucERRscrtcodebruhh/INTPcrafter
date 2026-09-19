import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import ChatCanvas from './components/ChatCanvas';
import LorebookDashboard from './components/LorebookDashboard';
import LoginModal from './components/LoginModal';
import { api } from './services/api';
import { estimateTokens } from './services/tokenEstimator';

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

  // Auth state (Default dev account: ID 0 / 'dev', password '0000')
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
      avatar: 'dev_0'
    };
    localStorage.setItem('storycontainer_user', JSON.stringify(defaultDev));
    return defaultDev;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Load Initial Data
  useEffect(() => {
    loadSessions();
    loadKeyPoolTelemetry();

    // Hotkey listener for Ctrl+K or Cmd+K
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentView(prev => (prev === 'studio' ? 'lorebook' : 'studio'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      } else if (data.length === 0) {
        // Create initial chronicle session if none exists
        const newSession = await api.createSession('Chronicle Alpha: The Resonant Grid');
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
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

  // Session Handlers
  const handleCreateSession = async (title) => {
    try {
      const newSession = await api.createSession(title);
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

  // Streaming Chat Execution with Typing Effect & RAG Key Pool Fallback
  const executeChatStream = async (userPrompt) => {
    if (!userPrompt?.trim() || !activeSessionId || isLoading || isStreaming) return;

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
    localStorage.removeItem('storycontainer_user');
    localStorage.removeItem('storycontainer_token');
    setCurrentUser(null);
    setIsLoginModalOpen(true);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-950 text-slate-200 overflow-hidden select-none font-mono">
      {/* Top Navbar */}
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
      />

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
          />
        ) : (
          <LorebookDashboard
            onBackToStudio={() => setCurrentView('studio')}
          />
        )}
      </main>

      {/* Login & Dev Matrix Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(u) => setCurrentUser(u)}
      />
    </div>
  );
}
