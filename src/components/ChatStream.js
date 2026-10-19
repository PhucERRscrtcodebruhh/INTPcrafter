import React, { useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Sparkles,
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

function extractThinkingAndStory(rawContent) {
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

function formatTokenCount(num) {
  if (!num) return '0';
  return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : String(num);
}

function estimateTokens(text) {
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
}) {
  const parentRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedThinking, setExpandedThinking] = useState({});

  const totalCount = messages.length;

  const measureElement = useCallback((element, entry, instance) => {
    if (entry?.borderBoxSize?.[0]) {
      const size = Math.round(entry.borderBoxSize[0][instance.options.horizontal ? "inlineSize" : "blockSize"]);
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

  const handleCopy = useCallback((text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
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

  const handleSaveEdit = useCallback(async (msg, shouldRegenerate = false) => {
    if (!editingContent.trim()) return;
    const newContent = editingContent.trim();
    setEditingId(null);
    setEditingContent('');
    if (onEditMessage) {
      await onEditMessage(msg.id, newContent, shouldRegenerate, msg.role);
    }
  }, [editingContent, onEditMessage]);

  const toggleThinking = useCallback((id) => {
    setExpandedThinking(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Empty standby state
  if (messages.length === 0 && !isLoading && !isStreaming) {
    return React.createElement(
      'div',
      { className: 'flex-1 flex flex-col items-center justify-center p-4 md:p-6 text-center select-none' },
      React.createElement(
        'div',
        { className: 'w-14 h-14 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-glow-cyan-sm' },
        React.createElement(Sparkles, { size: 26 })
      ),
      React.createElement('h2', { className: 'text-base font-bold text-slate-200 uppercase tracking-wider mb-2' }, 'StoryContainer Studio // Standby'),
      React.createElement('p', { className: 'text-xs text-slate-400 max-w-md mb-6 leading-relaxed' },
        'DeepSeek & Gemini Multi-Provider Story Architecture with Deterministic INTP World Simulator. Direct the world below or begin your chronicle.'
      )
    );
  }

  const isBusy = isLoading || isStreaming;

  return React.createElement(
    'div',
    {
      ref: parentRef,
      id: 'chat-virtual-scroll-container',
      className: 'flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-12 py-3 md:py-4 scrollbar-thin scrollbar-thumb-cyan-500/20 relative',
      style: { height: '100%', width: '100%' }
    },
    // Virtual scroll spacer
    React.createElement(
      'div',
      {
        style: {
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }
      },
      virtualItems.map((virtualRow) => {
        const msg = messages[virtualRow.index];
        if (!msg) return null;

        const isUser = msg.role === 'user';
        const msgTokens = estimateTokens(msg.content);
        const hasLore = msg.retrievedLore && msg.retrievedLore.length > 0;
        const { thinking, story } = isUser ? { thinking: null, story: msg.content } : extractThinkingAndStory(msg.content);
        const isThinkingOpen = expandedThinking[msg.id] ?? false;
        const isEditing = editingId === msg.id;

        const innerContent = isUser
          ? React.createElement(
              'div',
              { className: 'flex justify-end items-start gap-2 md:gap-3 w-full group' },
              React.createElement(
                'div',
                { className: 'w-full min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-2xl md:max-w-3xl rounded-2xl rounded-tr-sm p-3 sm:p-4 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/90 border border-emerald-500/35 text-slate-100 shadow-glow-emerald-sm backdrop-blur-md relative transition-all hover:border-emerald-500/50' },
                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between gap-3 text-[11px] mb-1.5 pb-1 border-b border-emerald-500/20' },
                  React.createElement('span', { className: 'text-emerald-400 font-bold uppercase tracking-wider text-[10px]' }, 'Story Director'),
                  React.createElement('span', { className: 'text-slate-400 font-mono text-[10px]' }, `${formatTokenCount(msgTokens)} tokens`)
                ),
                isEditing
                  ? React.createElement(
                      'div',
                      { className: 'space-y-3 animate-fadeIn mt-1' },
                      React.createElement('textarea', {
                        rows: 4,
                        value: editingContent,
                        onChange: (e) => setEditingContent(e.target.value),
                        autoFocus: true,
                        className: 'w-full bg-cyber-950 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-emerald-400 focus:shadow-glow-emerald-sm resize-y'
                      }),
                      React.createElement(
                        'div',
                        { className: 'flex items-center justify-end space-x-2 text-xs' },
                        React.createElement('button', { type: 'button', onClick: handleCancelEdit, className: 'px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200' }, 'Hủy'),
                        React.createElement('button', { type: 'button', onClick: () => handleSaveEdit(msg, false), className: 'px-3 py-1 rounded bg-cyber-850 border border-slate-700 text-slate-300 hover:text-emerald-300 text-xs' }, 'Lưu'),
                        React.createElement('button', { type: 'button', onClick: () => handleSaveEdit(msg, true), className: 'px-3.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-emerald-sm' },
                          React.createElement(CornerDownLeft, { size: 12 }),
                          React.createElement('span', null, 'Lưu & Chạy lại')
                        )
                      )
                    )
                  : React.createElement(
                      'div',
                      { className: 'prose-story text-slate-100 font-mono select-text' },
                      React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] }, msg.content)
                    )
              ),
              React.createElement(
                'div',
                {
                  className: 'w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-emerald-400/80 bg-cyber-950 flex items-center justify-center text-emerald-300 shadow-glow-emerald overflow-hidden select-none',
                  title: currentUser ? `User: ${currentUser.username || currentUser.displayName}` : 'User (Story Director)'
                },
                React.createElement('span', { className: 'font-bold text-xs uppercase font-mono' }, currentUser?.username?.[0] || React.createElement(User, { size: 16 }))
              )
            )
          : React.createElement(
              'div',
              { className: 'flex justify-start items-start gap-2 md:gap-3 w-full group' },
              React.createElement(
                'div',
                {
                  className: 'w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 border-2 border-cyan-400/90 bg-cyan-950/90 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-glow-cyan-sm select-none relative',
                  title: 'INTP World Simulator AI'
                },
                React.createElement('span', { className: 'tracking-tighter font-extrabold text-[12px]' }, 'AI'),
                React.createElement('span', { className: 'w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 border border-cyber-950 animate-pulse' })
              ),
              React.createElement(
                'div',
                { className: 'flex-1 min-w-0 max-w-full md:max-w-4xl rounded-2xl rounded-tl-sm p-3 sm:p-4 md:p-5 text-xs sm:text-[13px] leading-relaxed bg-cyber-900/80 border border-cyan-500/25 text-slate-200 shadow-glow-cyan-sm backdrop-blur-md relative group transition-all hover:border-cyan-500/40' },
                React.createElement(
                  'div',
                  { className: 'flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2.5 pb-1.5 border-b border-cyan-500/15' },
                  React.createElement(
                    'div',
                    { className: 'flex items-center space-x-2' },
                    React.createElement('span', { className: 'text-cyan-300 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-1.5' },
                      React.createElement(Cpu, { size: 12, className: 'text-cyan-400' }),
                      React.createElement('span', null, 'INTP World Simulator')
                    ),
                    React.createElement('span', { className: 'text-slate-500 font-mono text-[10px]' }, `~${formatTokenCount(msgTokens)} tokens`),
                    hasLore && React.createElement(
                      'button',
                      {
                        onClick: () => onOpenLoreDrawer && onOpenLoreDrawer(msg.retrievedLore || []),
                        className: 'flex items-center space-x-1 px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors',
                        title: 'View retrieved lore entries for this turn'
                      },
                      React.createElement(BookOpen, { size: 10 }),
                      React.createElement('span', null, `${msg.retrievedLore?.length} Canon Lore Applied`)
                    )
                  )
                ),
                thinking && React.createElement(
                  'div',
                  { className: 'mb-3 rounded-lg border border-cyan-500/20 bg-cyber-950/60 overflow-hidden text-xs' },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: () => toggleThinking(msg.id),
                      className: 'w-full flex items-center justify-between px-3 py-1.5 text-cyan-400/80 hover:text-cyan-300 bg-cyber-900/40 text-[11px] transition-colors'
                    },
                    React.createElement('span', { className: 'flex items-center space-x-1.5' },
                      React.createElement('span', { className: 'w-1.5 h-1.5 rounded-full bg-cyan-400' }),
                      React.createElement('span', { className: 'font-semibold tracking-wide' }, 'Cognitive Invariant Trace')
                    ),
                    React.createElement('span', { className: 'flex items-center space-x-1 font-mono text-[10px] text-slate-500' },
                      React.createElement('span', null, isThinkingOpen ? 'Thu gọn' : 'Chi tiết'),
                      React.createElement(ChevronDown, { size: 12, className: `transform transition-transform ${isThinkingOpen ? 'rotate-180' : ''}` })
                    )
                  ),
                  isThinkingOpen && React.createElement(
                    'div',
                    { className: 'p-3 text-slate-400 border-t border-cyan-500/10 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap' },
                    thinking
                  )
                ),
                isEditing
                  ? React.createElement(
                      'div',
                      { className: 'space-y-3 animate-fadeIn mt-1' },
                      React.createElement('textarea', {
                        rows: 6,
                        value: editingContent,
                        onChange: (e) => setEditingContent(e.target.value),
                        autoFocus: true,
                        className: 'w-full bg-cyber-950 border border-cyan-500/40 rounded-lg p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm resize-y'
                      }),
                      React.createElement(
                        'div',
                        { className: 'flex items-center justify-end space-x-2 text-xs' },
                        React.createElement('button', { type: 'button', onClick: handleCancelEdit, className: 'px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200' }, 'Hủy'),
                        React.createElement('button', { type: 'button', onClick: () => handleSaveEdit(msg, false), className: 'px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center space-x-1 shadow-glow-cyan-sm' },
                          React.createElement(CornerDownLeft, { size: 12 }),
                          React.createElement('span', null, 'Lưu thay đổi')
                        )
                      )
                    )
                  : React.createElement(
                      'div',
                      { className: 'prose-story text-slate-200 font-mono select-text' },
                      React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] }, story || msg.content)
                    )
              )
            );

        return React.createElement(
          'div',
          {
            key: virtualRow.key,
            'data-index': virtualRow.index,
            ref: virtualizer.measureElement,
            className: 'chat-message-bubble w-full my-2',
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`
            }
          },
          innerContent
        );
      })
    )
  );
}

export default ChatStream;
