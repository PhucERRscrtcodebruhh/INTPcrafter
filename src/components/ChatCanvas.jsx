import React, { useState } from 'react';
import SessionSidebar from './SessionSidebar';
import ContextBar from './ContextBar';
import MessageList from './MessageList';
import ControlBar from './ControlBar';
import LoreDrawer from './LoreDrawer';

export default function ChatCanvas({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  messages,
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
  currentTokens,
  rollingThreshold,
  onUpdateRollingThreshold,
  isRolled,
  historyStats,
  retrievedLore,
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
  onAbort
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeLoreInDrawer, setActiveLoreInDrawer] = useState(retrievedLore);

  const handleOpenSpecificLore = (loreItem) => {
    setActiveLoreInDrawer([loreItem]);
    setLoreDrawerOpen(true);
  };

  const handleOpenTurnLore = (turnLoreList) => {
    setActiveLoreInDrawer(turnLoreList || []);
    setLoreDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative">
      {/* Left Session Sidebar (Hidden in Zen Mode) */}
      {!isZenMode && (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main Studio Canvas Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-cyber-950 ${isZenMode ? 'w-full max-w-5xl mx-auto' : ''}`}>
        {/* Token Counter & Context Window Rolling Bar */}
        <ContextBar
          currentTokens={currentTokens}
          activeModel={model}
          rollingThreshold={rollingThreshold}
          onUpdateRollingThreshold={onUpdateRollingThreshold}
          isRolled={isRolled}
          historyStats={historyStats}
          books={books}
          activeBookId={activeBookId}
          onLinkBook={onLinkBook}
        />

        {/* Message Stream */}
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
        />

        {/* Bottom Control Bar */}
        <ControlBar
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
        />
      </div>

      {/* Right Collapsible Lore Drawer */}
      <LoreDrawer
        isOpen={loreDrawerOpen}
        onClose={() => setLoreDrawerOpen(false)}
        retrievedLore={activeLoreInDrawer.length > 0 ? activeLoreInDrawer : retrievedLore}
        onNavigateToLorebook={onNavigateToLorebook}
      />
    </div>
  );
}
