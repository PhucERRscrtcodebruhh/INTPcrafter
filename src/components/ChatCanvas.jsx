import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MessageList from './MessageList';
import BottomHUD from './BottomHUD';
import LoreDrawer from './LoreDrawer';
import SessionDrawer from './SessionDrawer';
import KeyPoolModal from './KeyPoolModal';
import WorldStateModal from './WorldStateModal';
import LanguageModal from './LanguageModal';
import ContextSettingsModal from './ContextSettingsModal';
import ParameterSettingsModal from './chat/ParameterSettingsModal';
import { getModelSpec } from '../services/tokenEstimator';
import { getProviderKeys, getActiveKeyCount } from '../services/keyAvailability';
import { useSettingsStore } from '../store/useSettingsStore';

export default function ChatCanvas({
  sessions = [],
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  messages = [],
  isLoading,
  isStreaming = false,
  streamingText = '',
  streamingLore = [],
  prompt,
  setPrompt,
  onSendChat,
  model,
  setModel,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxOutputTokens,
  setMaxOutputTokens,
  currentTokens = 0,
  rollingThreshold = 32768,
  onUpdateRollingThreshold,
  isRolled = false,
  historyStats,
  retrievedLore = [],
  loreDrawerOpen,
  setLoreDrawerOpen,
  onNavigateToLorebook,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  books = [],
  activeBookId = null,
  onLinkBook,
  isZenMode = false,
  onAbort,
  keyStats = [],
  activeProvider = 'auto',
  requiredProvider = 'gemini',
  onActiveProviderChange,
  singleKeyMode = false,
  onSingleKeyModeChange,
  currentUser = null,
  language = 'vi',
  onLanguageChange,
  isSummaryReq = false,
  setIsSummaryReq
}) {
  // Modal / Drawer state toggles
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);
  const [isKeyPoolModalOpen, setIsKeyPoolModalOpen] = useState(false);
  const [isWorldStateModalOpen, setIsWorldStateModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isContextSettingsModalOpen, setIsContextSettingsModalOpen] = useState(false);
  const [isBottomHudCollapsed, setIsBottomHudCollapsed] = useState(false);
  const { isCockpitOpen, setCockpitOpen } = useSettingsStore();

  // Active lore focused inside drawer. Start empty so the drawer falls back to the
  // live retrieval set instead of freezing whatever was loaded at first render.
  const [activeLoreInDrawer, setActiveLoreInDrawer] = useState([]);

  // Keep the drawer in sync with the newest RAG retrieval of the active turn.
  useEffect(() => {
    setActiveLoreInDrawer(Array.isArray(retrievedLore) ? retrievedLore : []);
  }, [retrievedLore]);

  const handleOpenSpecificLore = (loreItem) => {
    setActiveLoreInDrawer([loreItem]);
    setLoreDrawerOpen(true);
  };

  const handleOpenTurnLore = (turnLoreList) => {
    setActiveLoreInDrawer(turnLoreList || []);
    setLoreDrawerOpen(true);
  };

  const handleToggleLoreDrawer = () => {
    if (!loreDrawerOpen) {
      setActiveLoreInDrawer(Array.isArray(retrievedLore) ? retrievedLore : []);
    }
    setLoreDrawerOpen(!loreDrawerOpen);
  };

  // Key telemetry is scoped to the active/required provider so a Gemini-only
  // warning can never appear while the user is running a Groq model.
  const totalKeysCount = getProviderKeys(keyStats, requiredProvider).length;
  const activeKeysCount = getActiveKeyCount(keyStats, requiredProvider);
  const spec = getModelSpec(model);
  const contextLimit = spec?.contextLimit || 1048576;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-cyber-950 font-mono">
      {/* Upper Area: Main Chat View (Maximum Screen Space) */}
      <div className={`flex-1 flex flex-col overflow-hidden w-full ${isZenMode ? 'max-w-4xl mx-auto' : ''}`}>
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingText={streamingText}
          streamingLore={streamingLore}
          onSelectLoreEntry={handleOpenSpecificLore}
          onOpenLoreDrawer={handleOpenTurnLore}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onRegenerateMessage={onRegenerateMessage}
          currentUser={currentUser}
        />
      </div>

      {/* Bottom Area: collapsible Bottom HUD (Context Donut + Chat Input + 6-Button Dock) */}
      <div
        className={`grid shrink-0 relative z-30 transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isBottomHudCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className={`min-h-0 ${isBottomHudCollapsed ? 'overflow-hidden' : 'overflow-visible'}`}>
          <div
            className={`transition-transform duration-300 ease-out ${
              isBottomHudCollapsed ? 'translate-y-full' : 'translate-y-0'
            }`}
          >
            <BottomHUD
        prompt={prompt}
        setPrompt={setPrompt}
        onSend={onSendChat}
        isLoading={isLoading}
        isStreaming={isStreaming}
        onAbort={onAbort}
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
        isRolled={isRolled}
        onOpenContextSettings={() => setIsContextSettingsModalOpen(true)}
        onOpenParameterCockpit={() => setCockpitOpen(true)}
        books={books}
        activeBookId={activeBookId}
        onLinkBook={onLinkBook}
        onOpenSessionDrawer={() => setIsSessionDrawerOpen(true)}
        onOpenLorebook={onNavigateToLorebook}
        onOpenKeyPool={() => setIsKeyPoolModalOpen(true)}
        onOpenWorldState={() => setIsWorldStateModalOpen(true)}
        onToggleLoreContext={handleToggleLoreDrawer}
        onOpenLanguage={() => setIsLanguageModalOpen(true)}
        retrievedCount={retrievedLore.length}
        activeKeysCount={activeKeysCount}
        totalKeysCount={totalKeysCount}
        sessionsCount={sessions.length}
        language={language}
        isSummaryReq={isSummaryReq}
        setIsSummaryReq={setIsSummaryReq}
            />
          </div>
        </div>
      </div>

      {/* Pinned Bottom-Right Toggle: collapses the whole dock and stays reachable */}
      <button
        type="button"
        onClick={() => setIsBottomHudCollapsed(prev => !prev)}
        aria-expanded={!isBottomHudCollapsed}
        aria-label={isBottomHudCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
        title={isBottomHudCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
        className="fixed bottom-2.5 right-3 z-50 w-9 h-9 rounded-lg flex items-center justify-center bg-cyber-950/95 border border-cyan-400/45 text-cyan-300 hover:text-cyan-100 hover:border-emerald-300/70 hover:bg-cyan-950/60 backdrop-blur-md shadow-glow-cyan-sm hover:shadow-glow-cyan transition-all active:scale-95"
      >
        {isBottomHudCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* 1. Chat Sessions Drawer */}
      <SessionDrawer
        isOpen={isSessionDrawerOpen}
        onClose={() => setIsSessionDrawerOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onCreateSession={onCreateSession}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
      />

      {/* 3. API Key Pool Modal */}
      <KeyPoolModal
        isOpen={isKeyPoolModalOpen}
        onClose={() => setIsKeyPoolModalOpen(false)}
        activeProvider={activeProvider}
        requiredProvider={requiredProvider}
        onActiveProviderChange={onActiveProviderChange}
        singleKeyMode={singleKeyMode}
        onSingleKeyModeChange={onSingleKeyModeChange}
      />

      {/* 4. World / Global State Modal */}
      <WorldStateModal
        isOpen={isWorldStateModalOpen}
        onClose={() => setIsWorldStateModalOpen(false)}
        books={books}
        activeBookId={activeBookId}
        onLinkBook={onLinkBook}
        onOpenLorebook={onNavigateToLorebook}
      />

      {/* 5. Retrieved Lore Context Drawer */}
      <LoreDrawer
        isOpen={loreDrawerOpen}
        onClose={() => setLoreDrawerOpen(false)}
        retrievedLore={activeLoreInDrawer.length > 0 ? activeLoreInDrawer : retrievedLore}
        bookId={activeBookId}
        onLiveStateUpdated={(entryId, updatedDelta) => {
          setActiveLoreInDrawer(prev => prev.map(item => {
            if (item.id === entryId) {
              return { ...item, liveState: updatedDelta };
            }
            return item;
          }));
        }}
        onNavigateToLorebook={onNavigateToLorebook}
      />

      {/* 6. Language & Localization Modal */}
      <LanguageModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        language={language}
        onLanguageChange={onLanguageChange}
      />

      {/* Donut Gauge Context Window Settings Modal */}
      <ContextSettingsModal
        isOpen={isContextSettingsModalOpen}
        onClose={() => setIsContextSettingsModalOpen(false)}
        rollingThreshold={rollingThreshold}
        onUpdateRollingThreshold={onUpdateRollingThreshold}
        limit={contextLimit}
        currentTokens={currentTokens}
        isRolled={isRolled}
        historyStats={historyStats}
      />

      {/* Parameter Cockpit Drawer */}
      <ParameterSettingsModal
        isOpen={isCockpitOpen}
        onClose={() => setCockpitOpen(false)}
        model={model}
        provider={requiredProvider}
      />
    </div>
  );
}
