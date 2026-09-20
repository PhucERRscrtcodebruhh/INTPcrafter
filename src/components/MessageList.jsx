import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  User, 
  Cpu, 
  Copy, 
  Check, 
  BookOpen, 
  Sparkles, 
  Layers, 
  BrainCircuit, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  RotateCcw, 
  Edit3, 
  Trash2, 
  X, 
  Save, 
  CornerDownLeft 
} from 'lucide-react';
import { estimateTokens, formatTokenCount } from '../services/tokenEstimator';

function extractThinkingAndStory(content, isStillStreaming = false) {
  if (!content) return { thinking: null, story: '', isThinkingOpen: false };

  // Check if content has <thinking>
  const openTagIdx = content.toLowerCase().indexOf('<thinking>');
  if (openTagIdx === -1) {
    return { thinking: null, story: content, isThinkingOpen: false };
  }

  const closeTagIdx = content.toLowerCase().indexOf('</thinking>');
  if (closeTagIdx === -1) {
    // Thinking is currently active/streaming
    const thinking = content.slice(openTagIdx + 10).trim();
    return { thinking, story: '', isThinkingOpen: true };
  }

  // Both open and close tags present
  const thinking = content.slice(openTagIdx + 10, closeTagIdx).trim();
  const story = (content.slice(0, openTagIdx) + content.slice(closeTagIdx + 11)).trim();
  return { thinking, story, isThinkingOpen: false };
}

const ThinkingBlock = memo(function ThinkingBlock({ thinking, isCurrentlyThinking = false }) {
  const [isOpen, setIsOpen] = useState(isCurrentlyThinking);
  const thinkingTokens = estimateTokens(thinking);

  useEffect(() => {
    if (isCurrentlyThinking) {
      setIsOpen(true);
    }
  }, [isCurrentlyThinking]);

  return (
    <div className={`mb-3 rounded-lg border transition-all overflow-hidden text-xs ${
      isCurrentlyThinking 
        ? 'border-purple-400/50 bg-purple-950/20 shadow-glow-cyan-sm animate-cyber-pulse' 
        : 'border-purple-500/30 bg-cyber-950/80'
    }`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-purple-950/40 hover:bg-purple-950/60 text-purple-300 font-mono transition-colors text-left select-none"
      >
        <div className="flex items-center space-x-2">
          <BrainCircuit size={14} className={`text-purple-400 shrink-0 ${isCurrentlyThinking ? 'animate-spin' : 'animate-pulse'}`} />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {isCurrentlyThinking ? 'INTP Cognitive Trace // Thinking Active...' : 'INTP Cognitive Trace // Reasoning & Invariants'}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
            {formatTokenCount(thinkingTokens)} tokens
          </span>
        </div>
        <div className="flex items-center space-x-1 text-[11px] text-purple-400/80 shrink-0">
          <span>{isOpen ? 'Collapse Trace' : 'View Thought Process'}</span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3.5 border-t border-purple-500/20 bg-cyber-950/95 text-purple-100 font-mono text-[12px] leading-relaxed select-text animate-fadeIn">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {thinking}
          </ReactMarkdown>
          {isCurrentlyThinking && (
            <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-1 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  );
});

// Memoized single message item to prevent re-rendering entire conversation on each streaming chunk
const MessageItem = memo(function MessageItem({
  msg,
  idx,
  isEditing,
  editingContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onDeleteMessage,
  onRegenerateMessage,
  onOpenLoreDrawer,
  onSelectLoreEntry,
  onCopy,
  isCopied
}) {
  const isUser = msg.role === 'user';
  const msgTokens = estimateTokens(msg.content);
  const hasLore = msg.retrievedLore && msg.retrievedLore.length > 0;
  const { thinking, story } = isUser ? { thinking: null, story: msg.content } : extractThinkingAndStory(msg.content);

  return (
    <div 
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group relative`}
    >
      {/* Author and Metadata Header */}
      <div className="flex items-center space-x-2 text-[11px] mb-1.5 px-1">
        {isUser ? (
          <>
            <span className="text-slate-400 font-mono">
              {formatTokenCount(msgTokens)} tokens
            </span>
            <span className="text-cyan-400 font-bold uppercase tracking-wider">
              Story Director
            </span>
            <div className="w-5 h-5 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <User size={11} />
            </div>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Cpu size={11} />
            </div>
            <span className="text-cyan-300 font-bold uppercase tracking-wider">
              INTP World Simulator
            </span>
            <span className="text-slate-500 font-mono">
              ~{formatTokenCount(msgTokens)} tokens
            </span>

            {hasLore && (
              <button
                onClick={() => onOpenLoreDrawer && onOpenLoreDrawer(msg.retrievedLore)}
                className="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors"
                title="View retrieved lore entries for this turn"
              >
                <BookOpen size={10} />
                <span>{msg.retrievedLore.length} Canon Lore Applied</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Message Bubble Canvas */}
      <div
        className={`max-w-4xl w-full rounded-lg p-4 text-xs sm:text-[13px] leading-relaxed relative transition-all ${
          isUser
            ? 'bg-cyber-900/90 border border-cyan-500/30 text-slate-100 shadow-glow-cyan-sm'
            : 'glass-panel border border-slate-800 text-slate-200'
        }`}
      >
        {/* Google AI Studio Style Floating Action Toolbar */}
        {!isEditing && (
          <div className="absolute top-2 right-2 hidden group-hover:flex items-center space-x-1 bg-cyber-950/95 border border-cyan-500/30 rounded-md p-1 shadow-lg backdrop-blur-md z-10 animate-fadeIn">
            {/* Edit Button */}
            <button
              onClick={() => onStartEdit(msg)}
              className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-cyan-300 transition-colors"
              title={isUser ? "Sửa prompt này" : "Chỉnh sửa nội dung truyện"}
            >
              <Edit3 size={13} />
            </button>

            {/* Regenerate Button */}
            <button
              onClick={() => onRegenerateMessage && onRegenerateMessage(msg)}
              className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-cyan-300 transition-colors"
              title={isUser ? "Chạy lại prompt này (Regenerate)" : "Tạo lại câu trả lời (Regenerate)"}
            >
              <RotateCcw size={13} />
            </button>

            {/* Delete Button */}
            <button
              onClick={() => onDeleteMessage && onDeleteMessage(msg.id, isUser)}
              className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-rose-400 transition-colors"
              title={isUser ? "Xóa prompt này" : "Xóa câu trả lời này"}
            >
              <Trash2 size={13} />
            </button>

            {/* Copy Button */}
            <button
              onClick={() => onCopy(story || msg.content, msg.id || idx)}
              className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-emerald-300 transition-colors"
              title="Sao chép văn bản"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        )}

        {/* Message Content or Inline Edit Box */}
        {isEditing ? (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] text-cyan-400 font-semibold border-b border-cyan-500/20 pb-1">
              <span className="flex items-center space-x-1">
                <Edit3 size={12} />
                <span>{isUser ? 'Chỉnh sửa Prompt' : 'Chỉnh sửa Văn bản'}</span>
              </span>
              <span className="text-slate-500 font-mono">
                ~{estimateTokens(editingContent)} tokens
              </span>
            </div>

            <textarea
              rows={4}
              value={editingContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              autoFocus
              className="w-full bg-cyber-950 border border-cyan-500/40 rounded-lg p-2.5 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm resize-y"
            />

            <div className="flex items-center justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              >
                Hủy (Cancel)
              </button>

              {isUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSaveEdit(msg, false)}
                    className="px-3 py-1 rounded bg-cyber-850 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs"
                  >
                    Lưu lại
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveEdit(msg, true)}
                    className="px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-cyan-sm"
                  >
                    <CornerDownLeft size={12} />
                    <span>Lưu & Chạy lại (Submit)</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg, false)}
                  className="px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-cyan-sm"
                >
                  <Save size={12} />
                  <span>Lưu thay đổi</span>
                </button>
              )}
            </div>
          </div>
        ) : isUser ? (
          <div className="prose-story text-slate-100 font-mono">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div>
            {thinking && (
              <ThinkingBlock thinking={thinking} isCurrentlyThinking={false} />
            )}

            <div className="prose-story select-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {story || (thinking ? '*(Simulation reasoning completed. Direct the next scene.)*' : msg.content)}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Bottom bar inside bubble: Lore chips & quick action indicators */}
        {!isEditing && (
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
            {hasLore ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  RAG Verified:
                </span>
                {msg.retrievedLore.map(lore => (
                  <button
                    key={lore.id}
                    onClick={() => onSelectLoreEntry && onSelectLoreEntry(lore)}
                    className="px-2 py-0.5 rounded text-[10px] bg-cyber-950 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:text-cyan-200 transition-all flex items-center space-x-1"
                  >
                    <Layers size={10} />
                    <span>{lore.title}</span>
                  </button>
                ))}
              </div>
            ) : <div />}

            {/* Inline Action Row for Mobile / Default touch */}
            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
              <button
                onClick={() => onStartEdit(msg)}
                className="hover:text-cyan-300 flex items-center space-x-1 transition-colors"
                title={isUser ? "Sửa prompt" : "Sửa văn bản"}
              >
                <Edit3 size={11} />
                <span>Sửa</span>
              </button>

              <button
                onClick={() => onRegenerateMessage && onRegenerateMessage(msg)}
                className="hover:text-cyan-300 flex items-center space-x-1 transition-colors"
                title="Chạy lại câu trả lời"
              >
                <RotateCcw size={11} />
                <span>Regen</span>
              </button>

              <button
                onClick={() => onDeleteMessage && onDeleteMessage(msg.id, isUser)}
                className="hover:text-rose-400 flex items-center space-x-1 transition-colors"
                title={isUser ? "Xóa prompt" : "Xóa tin nhắn"}
              >
                <Trash2 size={11} />
                <span>Xóa</span>
              </button>

              <button
                onClick={() => onCopy(story || msg.content, msg.id || idx)}
                className="hover:text-slate-300 flex items-center space-x-1 transition-colors"
                title="Copy text"
              >
                {isCopied ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.content === next.msg.content &&
    prev.msg.role === next.msg.role &&
    prev.isEditing === next.isEditing &&
    prev.editingContent === next.editingContent &&
    prev.isCopied === next.isCopied &&
    prev.msg.retrievedLore === next.msg.retrievedLore
  );
});

// Streaming bubble extracted for zero overhead on existing message items
function StreamingBubble({ streamingText, streamingLore }) {
  const activeStreamParsed = extractThinkingAndStory(streamingText, true);

  return (
    <div className="flex flex-col items-start group animate-fadeIn">
      <div className="flex items-center space-x-2 text-[11px] mb-1.5 px-1">
        <div className="w-5 h-5 rounded bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300">
          <Cpu size={11} className="animate-spin" />
        </div>
        <span className="text-cyan-300 font-bold uppercase tracking-wider">
          INTP World Simulator
        </span>
        <span className="text-cyan-400 font-mono text-[10px] flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>Streaming token outputs...</span>
        </span>

        {streamingLore.length > 0 && (
          <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px]">
            {streamingLore.length} Canon Lore Applied
          </span>
        )}
      </div>

      <div className="max-w-4xl w-full rounded-lg p-4 text-xs sm:text-[13px] leading-relaxed glass-panel border border-cyan-500/40 text-slate-200 shadow-glow-cyan-sm">
        {activeStreamParsed && activeStreamParsed.thinking && (
          <ThinkingBlock 
            thinking={activeStreamParsed.thinking} 
            isCurrentlyThinking={activeStreamParsed.isThinkingOpen} 
          />
        )}

        <div className="prose-story select-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {activeStreamParsed?.story || ''}
          </ReactMarkdown>

          {!activeStreamParsed?.isThinkingOpen && (
            <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse align-middle shadow-glow-cyan" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ 
  messages = [], 
  isLoading, 
  isStreaming = false,
  streamingText = '',
  streamingLore = [],
  onSelectLoreEntry,
  onOpenLoreDrawer,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage
}) {
  const scrollEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const lastScrollTimeRef = useRef(0);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  // Chat Pruning (Performance Optimization similar to chat.gemini.com)
  const DEFAULT_PRUNE_LIMIT = 12;
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_PRUNE_LIMIT);
  const [isPruningEnabled, setIsPruningEnabled] = useState(true);

  // Optimized scrolling: Throttle auto-scrolling during rapid streaming to prevent UI lockup
  useEffect(() => {
    if (isStreaming) {
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 80) {
        lastScrollTimeRef.current = now;
        scrollEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, isLoading, isStreaming]);

  const handleCopy = useCallback((text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleStartEdit = useCallback((msg) => {
    setEditingId(msg.id);
    setEditingContent(msg.content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingContent('');
  }, []);

  const handleEditContentChange = useCallback((val) => {
    setEditingContent(val);
  }, []);

  const handleSaveEdit = useCallback(async (msg, shouldRegenerate = false) => {
    if (!editingContent.trim()) return;
    const newContent = editingContent.trim();
    setEditingId(null);
    setEditingContent('');
    
    if (onEditMessage) {
      await onEditMessage(msg.id, newContent, shouldRegenerate, msg.role);
    }
  }, [editingContent, onEditMessage]);

  // Determine pruned slice
  const totalCount = messages.length;
  const isPruned = isPruningEnabled && totalCount > displayLimit;
  const hiddenCount = isPruned ? totalCount - displayLimit : 0;
  const visibleMessages = isPruned ? messages.slice(-displayLimit) : messages;

  const handleLoadMore = useCallback(() => {
    setDisplayLimit(prev => Math.min(totalCount, prev + 10));
  }, [totalCount]);

  const handleShowAll = useCallback(() => {
    setDisplayLimit(totalCount);
    setIsPruningEnabled(false);
  }, [totalCount]);

  if (messages.length === 0 && !isLoading && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-glow-cyan-sm">
          <Sparkles size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider mb-2">
          StoryContainer Studio // Ready
        </h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          The deterministic world simulation matrix is online. Enter your scene prompt, character action, or world event below. The INTP RAG engine will automatically retrieve canon laws and character constraints from the Lorebook, running deep cognitive checks and LaTeX equations inside &lt;thinking&gt; before streaming narrative prose with real-time typing.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full text-left text-xs">
          <div className="p-3 rounded bg-cyber-900/80 border border-slate-800 text-slate-400">
            <span className="text-cyan-400 font-semibold block mb-1">Character Continuity:</span>
            "Kaelen Vance inspects the aetheric conduits in Sector 07..."
          </div>
          <div className="p-3 rounded bg-cyber-900/80 border border-slate-800 text-slate-400">
            <span className="text-purple-400 font-semibold block mb-1">Magic Invariants & LaTeX:</span>
            "Calculate the resonant flux dissipation $\Delta \Phi = \int \omega(t) dt$ when tapping ambient aether."
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Chat Pruning Banner (chat.gemini.com Optimization) */}
      {isPruned && (
        <div className="p-2.5 rounded-lg bg-cyber-950 border border-cyan-500/20 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-400 animate-fadeIn select-none">
          <div className="flex items-center space-x-2">
            <Zap size={14} className="text-cyan-400 shrink-0" />
            <span>
              <strong>DOM Performance Pruning Active</strong>: {hiddenCount} earlier turns archived to maintain 120fps responsiveness.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadMore}
              className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-cyan-300 text-[11px] transition-colors"
            >
              Load Earlier (+10)
            </button>
            <button
              onClick={handleShowAll}
              className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 text-[11px] transition-colors"
            >
              Show All ({totalCount})
            </button>
          </div>
        </div>
      )}

      {/* Render Visible Message History */}
      {visibleMessages.map((msg, idx) => (
        <MessageItem
          key={msg.id || idx}
          msg={msg}
          idx={idx}
          isEditing={editingId === msg.id}
          editingContent={editingContent}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onEditContentChange={handleEditContentChange}
          onDeleteMessage={onDeleteMessage}
          onRegenerateMessage={onRegenerateMessage}
          onOpenLoreDrawer={onOpenLoreDrawer}
          onSelectLoreEntry={onSelectLoreEntry}
          onCopy={handleCopy}
          isCopied={copiedId === (msg.id || idx)}
        />
      ))}

      {/* Real-time Streaming & Typing Effect Bubble */}
      {isStreaming && (
        <StreamingBubble 
          streamingText={streamingText} 
          streamingLore={streamingLore} 
        />
      )}

      {/* Loading Skeleton before first token chunk */}
      {isLoading && !isStreaming && (
        <div className="flex flex-col items-start space-y-2 animate-fadeIn">
          <div className="flex items-center space-x-2 text-[11px] text-cyan-400">
            <div className="w-5 h-5 rounded bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Cpu size={11} />
            </div>
            <span className="font-bold uppercase tracking-wider">INTP World Simulator</span>
            <span className="text-slate-500 font-mono">Running Cognitive Trace & RAG Matrix...</span>
          </div>
          <div className="max-w-xl w-full p-4 rounded-lg glass-panel border border-cyan-500/30 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-300 font-mono text-[11px]">
                Querying @google/genai SDK stream...
              </span>
            </div>
            <div className="h-2.5 bg-cyber-850 rounded w-5/6 animate-pulse" />
            <div className="h-2.5 bg-cyber-850 rounded w-4/6 animate-pulse" />
          </div>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
}
