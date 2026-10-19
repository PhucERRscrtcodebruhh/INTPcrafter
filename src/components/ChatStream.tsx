import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Sparkles,
  Zap,
  Edit3,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  CornerDownLeft,
  ChevronDown,
  Cpu,
  User,
  BookOpen
} from 'lucide-react';
import { ChatMessage } from '../services/contextService';

export interface ChatStreamProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  streamingText?: string;
  streamingLore?: any[];
  onEditMessage?: (id: string | number, newContent: string, shouldRegenerate?: boolean, role?: string) => Promise<void> | void;
  onDeleteMessage?: (id: string | number, isUser?: boolean) => Promise<void> | void;
  onRegenerateMessage?: (msg: ChatMessage) => Promise<void> | void;
  onOpenLoreDrawer?: (lore: any[]) => void;
  onSelectLoreEntry?: (entry: any) => void;
  currentUser?: { username?: string; displayName?: string; avatar?: string } | null;
  estimateSize?: number;
  overscan?: number;
  virtualizerOptions?: any;
}

function extractThinkingAndStory(rawContent: string) {
  if (!rawContent) return { thinking: null, story: '' };
  const content = String(rawContent);
  const openTag = '<think>';
  const closeTag = '</think>';

  const openTagIdx = content.indexOf(openTag);
  if (openTagIdx === -1) {
    return { thinking: null, story: content };
  }

  const closeTagIdx = content.indexOf(closeTag, openTagIdx + openTag.length);
  if (closeTagIdx === -1) {
    const thinking = content.slice(openTagIdx + openTag.length).trim();
    return { thinking, story: '' };
  }

  const thinking = content.slice(openTagIdx + openTag.length, closeTagIdx).trim();
  const story = (content.slice(0, openTagIdx) + content.slice(closeTagIdx + closeTag.length)).trim();
  return { thinking, story };
}

function formatTokenCount(num: number) {
  if (!num) return '0';
  return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : String(num);
}

function estimateTokens(text: string) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function ChatStream({
  messages = [],
  isLoading = false,
  isStreaming = false,
  streamingText = '',
  streamingLore = [],
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onOpenLoreDrawer,
  onSelectLoreEntry,
  currentUser = null,
  estimateSize = 80,
  overscan = 2,
  virtualizerOptions = {}
}: ChatStreamProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string | number, boolean>>({});

  const totalCount = messages.length;

  const measureElement = useCallback((element: any, entry: any, instance: any) => {
    if (entry?.borderBoxSize?.[0]) {
      const size = Math.round(entry.borderBoxSize[0][instance.options.horizontal ? 'inlineSize' : 'blockSize']);
      if (size > 0) return size;
    }
    const measured = element ? (element.offsetHeight || element.clientHeight || 0) : 0;
    if (measured > 0) return measured;
    const index = instance.indexFromElement(element);
    return instance.options.estimateSize(index);
  }, []);

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    initialRect: { width: 800, height: 800 },
    measureElement,
    ...virtualizerOptions
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleCopy = useCallback((text: string, id: string | number) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleStartEdit = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditingContent(msg.content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingContent('');
  }, []);

  const handleSaveEdit = useCallback(async (msg: ChatMessage, shouldRegenerate = false) => {
    if (!editingContent.trim()) return;
    const newContent = editingContent.trim();
    setEditingId(null);
    setEditingContent('');
    if (onEditMessage) {
      await onEditMessage(msg.id, newContent, shouldRegenerate, msg.role);
    }
  }, [editingContent, onEditMessage]);

  const toggleThinking = useCallback((id: string | number) => {
    setExpandedThinking(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Empty standby state
  if (messages.length === 0 && !isLoading && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 text-center select-none">
        <div className="w-14 h-14 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-glow-cyan-sm">
          <Sparkles size={26} />
        </div>
        <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider mb-2">
          StoryContainer Studio // Standby
        </h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          DeepSeek & Gemini Multi-Provider Story Architecture with Deterministic INTP World Simulator. Direct the world below or begin your chronicle.
        </p>
      </div>
    );
  }

  const isBusy = isLoading || isStreaming;

  return (
    <div
      ref={parentRef}
      id="chat-virtual-scroll-container"
      className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-12 py-3 md:py-4 scrollbar-thin scrollbar-thumb-cyan-500/20 relative"
      style={{ height: '100%', width: '100%' }}
    >
      {/* Virtual scroll spacer */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualRow) => {
          const msg = messages[virtualRow.index];
          if (!msg) return null;

          const isUser = msg.role === 'user';
          const msgTokens = estimateTokens(msg.content);
          const hasLore = msg.retrievedLore && msg.retrievedLore.length > 0;
          const { thinking, story } = isUser ? { thinking: null, story: msg.content } : extractThinkingAndStory(msg.content);
          const isThinkingOpen = expandedThinking[msg.id] ?? false;
          const isEditing = editingId === msg.id;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="chat-message-bubble w-full my-2"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {isUser ? (
                // USER MESSAGE
                <div className="flex justify-end items-start gap-2 md:gap-3 w-full group">
                  <div className="w-full min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-2xl md:max-w-3xl rounded-2xl rounded-tr-sm p-3 sm:p-4 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/90 border border-emerald-500/35 text-slate-100 shadow-glow-emerald-sm backdrop-blur-md relative transition-all hover:border-emerald-500/50">
                    <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5 pb-1 border-b border-emerald-500/20">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                        Story Director
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {formatTokenCount(msgTokens)} tokens
                      </span>
                    </div>

                    {!isEditing && (
                      <div className="absolute top-2 right-2 hidden group-hover:flex items-center space-x-1 bg-cyber-950/95 border border-emerald-500/40 rounded-md p-1 shadow-lg backdrop-blur-md z-10 animate-fadeIn">
                        <button
                          onClick={() => handleStartEdit(msg)}
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
                          onClick={() => handleCopy(msg.content, msg.id || virtualRow.index)}
                          className="p-1 rounded hover:bg-cyber-850 text-slate-400 hover:text-emerald-300 transition-colors"
                          title="Sao chép prompt"
                        >
                          {copiedId === (msg.id || virtualRow.index) ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-3 animate-fadeIn mt-1">
                        <textarea
                          rows={4}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          autoFocus
                          className="w-full bg-cyber-950 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-emerald-400 focus:shadow-glow-emerald-sm resize-y"
                        />
                        <div className="flex items-center justify-end space-x-2 text-xs">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg, false)}
                            className="px-3 py-1 rounded bg-cyber-850 border border-slate-700 text-slate-300 hover:text-emerald-300 text-xs"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg, true)}
                            className="px-3.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-emerald-sm"
                          >
                            <CornerDownLeft size={12} />
                            <span>Lưu & Chạy lại</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose-story text-slate-100 font-mono select-text">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-emerald-400/80 bg-cyber-950 flex items-center justify-center text-emerald-300 shadow-glow-emerald overflow-hidden select-none"
                    title={currentUser ? `User: ${currentUser.username || currentUser.displayName}` : 'User (Story Director)'}
                  >
                    {currentUser?.avatar && typeof currentUser.avatar === 'string' && currentUser.avatar.startsWith('data:image/') ? (
                      <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <span className="font-bold text-xs uppercase font-mono">
                        {currentUser?.username?.[0] || <User size={16} />}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                // AI RESPONSE
                <div className="flex justify-start items-start gap-2 md:gap-3 w-full group">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400/90 bg-cyan-950/90 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm select-none relative"
                    title="INTP World Simulator AI"
                  >
                    <span className="tracking-tighter font-extrabold text-[12px]">AI</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 border border-cyber-950 animate-pulse" />
                  </div>

                  <div className="flex-1 min-w-0 max-w-full md:max-w-4xl rounded-2xl rounded-tl-sm p-3 sm:p-4 md:p-5 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/80 border border-cyan-500/25 text-slate-200 shadow-glow-cyan-sm backdrop-blur-md relative group transition-all hover:border-cyan-500/40">
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
                            onClick={() => onOpenLoreDrawer && onOpenLoreDrawer(msg.retrievedLore || [])}
                            className="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors"
                            title="View retrieved lore entries for this turn"
                          >
                            <BookOpen size={10} />
                            <span>{msg.retrievedLore?.length} Canon Lore Applied</span>
                          </button>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center space-x-2 text-slate-400">
                          <button
                            onClick={() => handleStartEdit(msg)}
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
                            title="Xóa lượt trả lời này"
                          >
                            <Trash2 size={12} />
                            <span className="text-[10px]">Xóa</span>
                          </button>
                          <button
                            onClick={() => handleCopy(msg.content, msg.id || virtualRow.index)}
                            className="hover:text-cyan-300 flex items-center space-x-1 transition-colors"
                            title="Sao chép nội dung"
                          >
                            {copiedId === (msg.id || virtualRow.index) ? <Check size={12} className="text-cyan-400" /> : <Copy size={12} />}
                            <span className="text-[10px]">{copiedId === (msg.id || virtualRow.index) ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Thinking Trace */}
                    {thinking && (
                      <div className="mb-3 rounded-lg border border-cyan-500/20 bg-cyber-950/60 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => toggleThinking(msg.id)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-cyan-400/80 hover:text-cyan-300 bg-cyber-900/40 text-[11px] transition-colors"
                        >
                          <span className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span className="font-semibold tracking-wide">Cognitive Invariant Trace</span>
                          </span>
                          <span className="flex items-center space-x-1 font-mono text-[10px] text-slate-500">
                            <span>{isThinkingOpen ? 'Thu gọn' : 'Chi tiết'}</span>
                            <ChevronDown size={12} className={`transform transition-transform ${isThinkingOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        {isThinkingOpen && (
                          <div className="p-3 text-slate-400 border-t border-cyan-500/10 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                            {thinking}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Story Content / Markdown */}
                    {isEditing ? (
                      <div className="space-y-3 animate-fadeIn mt-1">
                        <textarea
                          rows={6}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          autoFocus
                          className="w-full bg-cyber-950 border border-cyan-500/40 rounded-lg p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm resize-y"
                        />
                        <div className="flex items-center justify-end space-x-2 text-xs">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg, false)}
                            className="px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-cyan-sm"
                          >
                            <CornerDownLeft size={12} />
                            <span>Lưu thay đổi</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose-story text-slate-200 font-mono select-text">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {story || msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Real-time Streaming Bubble */}
      {isStreaming && (
        <div className="flex justify-start items-start gap-2 md:gap-3 w-full my-3.5 group animate-fadeIn">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400/90 bg-cyan-950/90 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm select-none relative">
            <span className="tracking-tighter font-extrabold text-[12px]">AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 border border-cyber-950 animate-ping" />
          </div>
          <div className="flex-1 min-w-0 max-w-full md:max-w-4xl rounded-2xl rounded-tl-sm p-3 sm:p-4 md:p-5 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/90 border border-cyan-400/40 text-slate-200 shadow-glow-cyan backdrop-blur-md relative">
            <div className="flex items-center space-x-2 text-[11px] mb-2 text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-wider">Streaming Live Story Engine...</span>
            </div>
            <div className="prose-story text-slate-200 font-mono whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-2 h-3.5 bg-cyan-400 ml-1 animate-pulse align-middle" />
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !isStreaming && (
        <div className="flex justify-start items-start gap-3 w-full my-3.5 group animate-fadeIn">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400/60 bg-cyan-950 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm">
            <Cpu size={14} className="animate-spin text-cyan-300" />
          </div>
          <div className="flex-1 max-w-xl p-4 rounded-2xl rounded-tl-sm glass-panel border border-cyan-500/30 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-300 font-mono text-[11px]">
                Running Cognitive Trace & RAG Matrix...
              </span>
            </div>
            <div className="h-2.5 bg-cyber-850 rounded w-5/6 animate-pulse" />
            <div className="h-2.5 bg-cyber-850 rounded w-4/6 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatStream;
