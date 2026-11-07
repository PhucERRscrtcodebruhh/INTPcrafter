import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  Trash2, 
  Plus, 
  MessageSquare, 
  Sliders, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Sparkles,
  ChevronDown,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MODEL_SPECS, MODEL_GROUPS, getModelSpec } from '../services/tokenEstimator';
import KeyPoolModal from './KeyPoolModal';
import ParameterSettingsModal from './chat/ParameterSettingsModal';

export default function PureChatCanvas({
  sessions = [],
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  messages = [],
  isLoading = false,
  isStreaming = false,
  streamingText = '',
  prompt = '',
  setPrompt,
  onSendChat,
  onAbort,
  model = 'gemini-3.8-flash',
  setModel,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  keyStats = [],
  currentUser = null
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const modelDropdownRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Close model dropdown when click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !isStreaming && prompt.trim()) {
        onSendChat();
      }
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const activeKeysCount = keyStats.filter(k => k.status === 'active').length;
  const currentModelSpec = getModelSpec(model);

  return (
    <div className="flex-1 flex h-full bg-[#0d1117] text-slate-100 overflow-hidden font-sans">
      {/* 1. Left Sidebar: Pure Chat History */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-0'
        } shrink-0 bg-[#161b22] border-r border-slate-800 flex flex-col transition-all duration-200 overflow-hidden select-none`}
      >
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => onCreateSession && onCreateSession('Đoạn chat mới')}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Đoạn chat mới</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Chưa có cuộc trò chuyện nào
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-slate-800 text-white font-medium' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 mr-2">
                    <MessageSquare size={14} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                    <span className="truncate">{s.title || 'Đoạn chat không tên'}</span>
                  </div>

                  {onDeleteSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Xóa đoạn chat này?')) {
                          onDeleteSession(s.id);
                        }
                      }}
                      title="Xóa"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Pure Mode Active
          </span>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            title="Quản lý API Key"
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <KeyRound size={12} />
            <span>{activeKeysCount} Key</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#0d1117] min-w-0">
        {/* Minimal Header */}
        <header className="h-12 border-b border-slate-800 bg-[#161b22]/70 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Thu gọn sidebar' : 'Mở sidebar'}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <MessageSquare size={16} />
            </button>

            {/* Model Picker */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-all"
              >
                <Bot size={14} className="text-emerald-400" />
                <span>{currentModelSpec?.displayName || model}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#161b22] border border-slate-700 rounded-lg shadow-2xl py-1 z-50 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Chọn Model Trí Tuệ Nhân Tạo
                  </div>
                  {Object.entries(MODEL_GROUPS).map(([groupKey, group]) => (
                    <div key={groupKey} className="py-1">
                      <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 bg-slate-800/40">
                        {group.label}
                      </div>
                      {group.models.map((m) => {
                        const isSelected = m.id === model;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setModel(m.id);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                              isSelected ? 'text-emerald-400 font-semibold bg-emerald-500/10' : 'text-slate-300'
                            }`}
                          >
                            <span className="truncate">{m.name}</span>
                            {isSelected && <Check size={12} className="text-emerald-400 ml-2 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsParamModalOpen(true)}
              title="Thông số sinh (Temperature, Top-P, etc.)"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Sliders size={16} />
            </button>
          </div>
        </header>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !isStreaming ? (
              <div className="text-center py-24 select-none">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-sm">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200 mb-1">
                  Chế độ Chat Thuần Túy
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Không RAG, không Lorebook, không quy tắc thế giới. Trò chuyện trực tiếp và tự nhiên với AI.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isEditingThis = editingMsgId === msg.id;

                return (
                  <div
                    key={msg.id || index}
                    className={`flex gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Bot avatar */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <Bot size={15} />
                      </div>
                    )}

                    <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
                      {/* Name & Tools row */}
                      <div className={`flex items-center gap-2 mb-1 text-[11px] text-slate-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span>{isUser ? (currentUser?.displayName || 'Bạn') : (currentModelSpec?.displayName || 'AI')}</span>

                        {/* Hover action buttons */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={() => handleCopy(msg.id || index, msg.content)}
                            title="Sao chép"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          >
                            {copiedId === (msg.id || index) ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>

                          {isUser && onEditMessage && (
                            <button
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditingText(msg.content);
                              }}
                              title="Sửa và chạy lại"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}

                          {onDeleteMessage && (
                            <button
                              onClick={() => onDeleteMessage(msg.id)}
                              title="Xóa tin nhắn"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content bubble or Edit form */}
                      {isEditingThis ? (
                        <div className="bg-[#1c2128] border border-slate-700 rounded-xl p-3 space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y min-h-[80px]"
                          />
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="px-2.5 py-1 rounded-md text-slate-400 hover:bg-slate-800"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={async () => {
                                if (editingText.trim()) {
                                  await onEditMessage(msg.id, editingText.trim(), true, 'user');
                                  setEditingMsgId(null);
                                }
                              }}
                              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            >
                              Lưu & Chạy lại
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-sm ${
                            isUser
                              ? 'bg-emerald-600 text-white rounded-br-xs whitespace-pre-wrap'
                              : 'bg-[#161b22] border border-slate-800 text-slate-200 rounded-bl-xs'
                          }`}
                        >
                          {isUser ? (
                            msg.content
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                        <User size={15} />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live Streaming Message */}
            {isStreaming && (
              <div className="flex gap-3.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 animate-pulse">
                  <Bot size={15} />
                </div>
                <div className="max-w-[85%] order-2">
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500">
                    <span>{currentModelSpec?.displayName || 'AI'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                  <div className="rounded-2xl rounded-bl-xs px-4 py-3 text-[13.5px] leading-relaxed shadow-sm bg-[#161b22] border border-slate-800 text-slate-200">
                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {streamingText || '...'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoading && !isStreaming && (
              <div className="flex items-center gap-2 text-xs text-slate-400 pl-10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Đang suy nghĩ...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-[#161b22]/50 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#0d1117] border border-slate-700/80 rounded-2xl p-2 shadow-inner focus-within:border-emerald-500/70 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Gửi tin nhắn cho AI... (Enter để gửi, Shift+Enter xuống dòng)"
                rows={1}
                className="flex-1 bg-transparent border-0 px-2.5 py-1.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none min-h-[38px] max-h-[180px]"
              />

              {isStreaming ? (
                <button
                  onClick={onAbort}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer shrink-0"
                >
                  <Square size={13} />
                  <span>Dừng</span>
                </button>
              ) : (
                <button
                  onClick={onSendChat}
                  disabled={!prompt.trim() || isLoading}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all shadow shrink-0 cursor-pointer ${
                    prompt.trim() && !isLoading
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={13} />
                  <span>Gửi</span>
                </button>
              )}
            </div>
            <div className="mt-2 text-center text-[10px] text-slate-500">
              Pure Chat Mode • Trực tiếp không qua RAG hay Story Engine
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isKeyModalOpen && (
        <KeyPoolModal
          isOpen={isKeyModalOpen}
          onClose={() => setIsKeyModalOpen(false)}
        />
      )}

      {isParamModalOpen && (
        <ParameterSettingsModal
          isOpen={isParamModalOpen}
          onClose={() => setIsParamModalOpen(false)}
          model={model}
        />
      )}
    </div>
  );
}
