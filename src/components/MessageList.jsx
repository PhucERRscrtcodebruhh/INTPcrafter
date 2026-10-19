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
import ChatStream from './ChatStream';

function extractThinkingAndStory(content, isStillStreaming = false) {
  if (!content) return { thinking: null, story: '', isThinkingOpen: false };

  const lower = content.toLowerCase();
  let openTag = '';
  let closeTag = '';
  let openTagIdx = -1;

  if (lower.includes('<thinking>')) {
    openTag = '<thinking>';
    closeTag = '</thinking>';
    openTagIdx = lower.indexOf('<thinking>');
  } else if (lower.includes('<think>')) {
    openTag = '<think>';
    closeTag = '</think>';
    openTagIdx = lower.indexOf('<think>');
  }

  if (openTagIdx === -1) {
    return { thinking: null, story: content, isThinkingOpen: false };
  }

  const closeTagIdx = lower.indexOf(closeTag, openTagIdx + openTag.length);
  if (closeTagIdx === -1) {
    // Thinking is currently active/streaming
    const thinking = content.slice(openTagIdx + openTag.length).trim();
    return { thinking, story: '', isThinkingOpen: true };
  }

  // Both open and close tags present
  const thinking = content.slice(openTagIdx + openTag.length, closeTagIdx).trim();
  const story = (content.slice(0, openTagIdx) + content.slice(closeTagIdx + closeTag.length)).trim();
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
    <div className={`mb-3.5 rounded-lg border transition-all overflow-hidden text-xs ${
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

// Memoized single message item with new wireframe layout:
// - User message: aligned right with circular avatar on the right
// - AI response: large story container block with circular "AI" avatar on the left
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
  isCopied,
  isBusy = false,
  currentUser = null
}) {
  const isUser = msg.role === 'user';
  const msgTokens = estimateTokens(msg.content);
  const hasLore = msg.retrievedLore && msg.retrievedLore.length > 0;
  const { thinking, story } = isUser ? { thinking: null, story: msg.content } : extractThinkingAndStory(msg.content);

  // USER MESSAGE (Aligned right + Round avatar on the right)
  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-2 md:gap-3 w-full my-3 group">
        {/* User Message Bubble */}
        <div className="w-full min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-2xl md:max-w-3xl rounded-2xl rounded-tr-sm p-3 sm:p-4 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/90 border border-emerald-500/35 text-slate-100 shadow-glow-emerald-sm backdrop-blur-md relative transition-all hover:border-emerald-500/50">
          {/* Header Line */}
          <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5 pb-1 border-b border-emerald-500/20">
            <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
              Story Director
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              {formatTokenCount(msgTokens)} tokens
            </span>
          </div>

          {/* Floating Action Toolbar on Hover */}
          {!isEditing && (
            <div className="absolute top-2 right-2 hidden group-hover:flex items-center space-x-1 bg-cyber-950/95 border border-emerald-500/40 rounded-md p-1 shadow-lg backdrop-blur-md z-10 animate-fadeIn">
              <button
                onClick={() => onStartEdit(msg)}
                disabled={isBusy}
                className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-emerald-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Sửa prompt này"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={() => onRegenerateMessage && onRegenerateMessage(msg)}
                disabled={isBusy}
                className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-emerald-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Chạy lại prompt này"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => onDeleteMessage && onDeleteMessage(msg.id, true)}
                disabled={isBusy}
                className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Xóa prompt"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => onCopy(msg.content, msg.id || idx)}
                className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-emerald-300 transition-colors"
                title="Sao chép prompt"
              >
                {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          )}

          {/* Inline Edit Form */}
          {isEditing ? (
            <div className="space-y-3 animate-fadeIn mt-1">
              <textarea
                rows={4}
                value={editingContent}
                onChange={(e) => onEditContentChange(e.target.value)}
                autoFocus
                className="w-full bg-cyber-950 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-emerald-400 focus:shadow-glow-emerald-sm resize-y"
              />
              <div className="flex items-center justify-end space-x-2 text-xs">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg, false)}
                  className="px-3 py-1 rounded bg-cyber-850 border border-slate-700 text-slate-300 hover:text-emerald-300 text-xs"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg, true)}
                  className="px-3.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-emerald-sm"
                >
                  <CornerDownLeft size={12} />
                  <span>Lưu & Chạy lại</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="prose-story text-slate-100 font-mono select-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Circular User Avatar on the Right */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-emerald-400/80 bg-cyber-950 flex items-center justify-center text-emerald-300 shadow-glow-emerald overflow-hidden select-none"
          title={currentUser ? `User: ${currentUser.username || currentUser.displayName}` : 'User (Story Director)'}
        >
          {currentUser?.avatar && typeof currentUser.avatar === 'string' && currentUser.avatar.startsWith('data:image/') ? (
            <img
              src={currentUser.avatar}
              alt="User"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span className="font-bold text-xs uppercase font-mono">
              {currentUser?.username?.[0] || <User size={16} />}
            </span>
          )}
        </div>
      </div>
    );
  }

  // AI RESPONSE (Round "AI" avatar on the left + Large Story container block)
  return (
    <div className="flex justify-start items-start gap-2 md:gap-3 w-full my-3.5 group">
      {/* Circular "AI" Avatar on the Left */}
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400/90 bg-cyan-950/90 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm select-none relative"
        title="INTP World Simulator AI"
      >
        <span className="tracking-tighter font-extrabold text-[12px]">AI</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 border border-cyber-950 animate-pulse" />
      </div>

      {/* Large Story Container Block */}
      <div className="flex-1 min-w-0 max-w-full md:max-w-4xl rounded-2xl rounded-tl-sm p-3 sm:p-4 md:p-5 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/80 border border-cyan-500/25 text-slate-200 shadow-glow-cyan-sm backdrop-blur-md relative group transition-all hover:border-cyan-500/40">
        {/* Story Block Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2.5 pb-1.5 border-b border-cyan-500/15">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-300 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Cpu size={12} className="text-cyan-400" />
              <span>INTP World Simulator</span>
            </span>
            <span className="text-slate-500 font-mono text-[10px]">
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
          </div>

          {/* Action Toolbar */}
          {!isEditing && (
            <div className="flex items-center space-x-2 text-slate-400">
              <button
                onClick={() => onStartEdit(msg)}
                disabled={isBusy}
                className="hover:text-cyan-300 flex items-center space-x-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Sửa nội dung truyện"
              >
                <Edit3 size={12} />
                <span className="text-[10px]">Sửa</span>
              </button>
              <button
                onClick={() => onRegenerateMessage && onRegenerateMessage(msg)}
                disabled={isBusy}
                className="hover:text-cyan-300 flex items-center space-x-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Tạo lại câu trả lời"
              >
                <RotateCcw size={12} />
                <span className="text-[10px]">Regen</span>
              </button>
              <button
                onClick={() => onDeleteMessage && onDeleteMessage(msg.id, false)}
                disabled={isBusy}
                className="hover:text-rose-400 flex items-center space-x-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Xóa câu trả lời này"
              >
                <Trash2 size={12} />
                <span className="text-[10px]">Xóa</span>
              </button>
              <button
                onClick={() => onCopy(story || msg.content, msg.id || idx)}
                className="hover:text-emerald-300 flex items-center space-x-1 transition-colors"
                title="Sao chép văn bản"
              >
                {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span className="text-[10px]">{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Inline Edit Form */}
        {isEditing ? (
          <div className="space-y-3 animate-fadeIn">
            <textarea
              rows={6}
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
                Hủy
              </button>
              <button
                type="button"
                onClick={() => onSaveEdit(msg, false)}
                className="px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-cyan-sm"
              >
                <Save size={12} />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Thinking / Cognitive Trace Block */}
            {thinking && (
              <ThinkingBlock thinking={thinking} isCurrentlyThinking={false} />
            )}

            {/* Story Text Container */}
            <div className="prose-story select-text leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {story || (thinking ? '*(Simulation reasoning completed. Direct the next scene.)*' : msg.content)}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Footer: RAG Verified Lore Chips */}
        {!isEditing && hasLore && (
          <div className="mt-3.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5">
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
    prev.isBusy === next.isBusy &&
    prev.currentUser?.avatar === next.currentUser?.avatar &&
    prev.msg.retrievedLore === next.msg.retrievedLore
  );
});

// Streaming Bubble matching the AI response container format
function StreamingBubble({ streamingText, streamingLore }) {
  const activeStreamParsed = extractThinkingAndStory(streamingText, true);

  return (
    <div className="flex justify-start items-start gap-2 md:gap-3 w-full my-3.5 group animate-fadeIn">
      {/* Circular "AI" avatar on the left with pulse effect */}
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400 bg-cyan-950 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm relative"
      >
        <span className="tracking-tighter font-extrabold text-[12px]">AI</span>
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute -top-0.5 -right-0.5" />
      </div>

      {/* Large Story Container Block */}
      <div className="flex-1 min-w-0 max-w-full md:max-w-4xl rounded-2xl rounded-tl-sm p-3 sm:p-4 md:p-5 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/85 border border-cyan-500/40 text-slate-200 shadow-glow-cyan-sm backdrop-blur-md relative">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[11px] mb-2 pb-1.5 border-b border-cyan-500/15">
          <span className="text-cyan-300 font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <Cpu size={12} className="animate-spin text-cyan-400" />
            <span>INTP World Simulator</span>
          </span>
          <span className="text-cyan-400 font-mono text-[10px] flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Generating story tokens...</span>
          </span>
          {streamingLore.length > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px]">
              {streamingLore.length} Canon Lore Applied
            </span>
          )}
        </div>

        {activeStreamParsed && activeStreamParsed.thinking && (
          <ThinkingBlock
            thinking={activeStreamParsed.thinking}
            isCurrentlyThinking={activeStreamParsed.isThinkingOpen}
          />
        )}

        <div className="prose-story select-text leading-relaxed">
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

export default function MessageList(props) {
  return <ChatStream {...props} />;
}

