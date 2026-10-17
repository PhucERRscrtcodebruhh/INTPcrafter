import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  Settings2, 
  Cpu, 
  Globe, 
  Database, 
  KeyRound, 
  MessageSquare, 
  BookOpen, 
  Languages, 
  ChevronDown, 
  ChevronUp, 
  CornerDownLeft,
  Check,
  Sparkles
} from 'lucide-react';
import DonutContextGauge from './DonutContextGauge';
import { MODEL_SPECS, MODEL_GROUPS, formatTokenCount, getModelSpec } from '../services/tokenEstimator';

// Accent tokens for the grouped model picker (Tailwind classes must be literal).
const MODEL_ACCENTS = {
  cyan: {
    heading: 'text-cyan-400',
    hover: 'hover:bg-cyber-900 hover:text-cyan-300',
    active: 'bg-cyan-500/20 text-cyan-300 font-bold',
    check: 'text-cyan-400',
  },
  blue: {
    heading: 'text-sky-400',
    hover: 'hover:bg-cyber-900 hover:text-sky-300',
    active: 'bg-sky-500/20 text-sky-300 font-bold',
    check: 'text-sky-400',
  },
  emerald: {
    heading: 'text-emerald-400',
    hover: 'hover:bg-cyber-900 hover:text-emerald-300',
    active: 'bg-emerald-500/20 text-emerald-300 font-bold',
    check: 'text-emerald-400',
  },
  amber: {
    heading: 'text-amber-400',
    hover: 'hover:bg-cyber-900 hover:text-amber-300',
    active: 'bg-amber-500/20 text-amber-300 font-bold',
    check: 'text-amber-400',
  },
  rose: {
    heading: 'text-rose-400',
    hover: 'hover:bg-cyber-900 hover:text-rose-300',
    active: 'bg-rose-500/20 text-rose-300 font-bold',
    check: 'text-rose-400',
  },
  purple: {
    heading: 'text-purple-400',
    hover: 'hover:bg-cyber-900 hover:text-purple-300',
    active: 'bg-purple-500/20 text-purple-300 font-bold',
    check: 'text-purple-400',
  },
  indigo: {
    heading: 'text-indigo-400',
    hover: 'hover:bg-cyber-900 hover:text-indigo-300',
    active: 'bg-indigo-500/20 text-indigo-300 font-bold',
    check: 'text-indigo-400',
  },
  teal: {
    heading: 'text-teal-400',
    hover: 'hover:bg-cyber-900 hover:text-teal-300',
    active: 'bg-teal-500/20 text-teal-300 font-bold',
    check: 'text-teal-400',
  },
};

export default function BottomHUD({
  // Chat Input state & handlers
  prompt,
  setPrompt,
  onSend,
  isLoading,
  isStreaming = false,
  onAbort,

  // Model & Parameters
  model,
  setModel,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxOutputTokens,
  setMaxOutputTokens,

  // Context & Token Tracking
  currentTokens = 0,
  rollingThreshold = 32768,
  isRolled = false,
  onOpenContextSettings,

  // Worlds & Books
  books = [],
  activeBookId = null,
  onLinkBook,

  // Dock Action Callbacks
  onOpenSessionDrawer,
  onOpenLorebook,
  onOpenKeyPool,
  onOpenWorldState,
  onToggleLoreContext,
  onOpenLanguage,

  // Status Badges
  retrievedCount = 0,
  activeKeysCount = 0,
  totalKeysCount = 0,
  sessionsCount = 0,
  language = 'vi',

  // Summary request state
  isSummaryReq = false,
  setIsSummaryReq
}) {
  const [showParams, setShowParams] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showWorldPicker, setShowWorldPicker] = useState(false);

  const textareaRef = useRef(null);
  const modelPickerRef = useRef(null);
  const worldPickerRef = useRef(null);
  const paramsPickerRef = useRef(null);

  const isBusy = isLoading || isStreaming;
  const spec = getModelSpec(model);
  const limit = spec?.contextLimit || 1048576;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [prompt]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
      if (worldPickerRef.current && !worldPickerRef.current.contains(e.target)) {
        setShowWorldPicker(false);
      }
      if (paramsPickerRef.current && !paramsPickerRef.current.contains(e.target)) {
        setShowParams(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isBusy && prompt.trim()) {
        onSend();
      }
    }
  };

  const linkedBook = books.find(b => b.id === activeBookId) || null;
  const shortModelName = spec?.name || model;

  return (
    <div className="relative border-t border-cyan-500/20 bg-cyber-900/95 backdrop-blur-lg select-none z-30 font-mono">
      {/* TOP SECTION: Donut Gauge + Chat Input Cluster */}
      <div className="px-3 sm:px-6 pt-3 pb-2 flex items-end gap-3 sm:gap-4 max-w-6xl mx-auto w-full">
        {/* Left Side: Circular Progress Ring / Donut Gauge for Context Window */}
        <div className="shrink-0 mb-1">
          <DonutContextGauge
            currentTokens={currentTokens}
            limit={limit}
            rollingThreshold={rollingThreshold}
            isRolled={isRolled}
            onOpenSettings={onOpenContextSettings}
          />
        </div>

        {/* Center: Chat Input Box with 3 Attached Top Tabs */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* The 3 Attached Small Tabs on Top Border */}
          <div className="flex items-center space-x-1 pl-1 z-10 -mb-[1px]">
            {/* Tab 1: [Model: ...] */}
            <div className="relative" ref={modelPickerRef}>
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] rounded-t-md border-t border-l border-r transition-all ${
                  showModelPicker
                    ? 'bg-cyber-950 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-900/90 border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-200'
                }`}
                title="Chọn mô hình AI (Model)"
              >
                <Cpu size={12} className="text-cyan-400" />
                <span className="max-w-[130px] sm:max-w-[180px] truncate">
                  Model: {shortModelName}
                </span>
                <ChevronDown size={10} className="text-slate-400" />
              </button>

              {/* Model Picker Dropdown (drop-up, grouped registry) */}
              {showModelPicker && (
                <div className="absolute left-0 bottom-full mb-2 w-[min(88vw,20rem)] sm:w-96 bg-cyber-950 border border-cyan-500/40 rounded-lg shadow-glow-cyan p-2 z-50 max-h-[70vh] overflow-y-auto space-y-2 animate-fadeIn text-xs">
                  <div className="sticky top-0 z-10 bg-cyber-950 text-[10px] uppercase font-bold text-slate-400 px-1 border-b border-slate-800 pb-1">
                    Select Simulation Model
                  </div>

                  {MODEL_GROUPS.map(group => {
                    const accent = MODEL_ACCENTS[group.accent] || MODEL_ACCENTS.cyan;
                    return (
                      <div key={group.id} className="space-y-1">
                        <div className={`text-[10px] font-semibold px-1 pt-1.5 ${accent.heading}`}>
                          {group.label}
                        </div>
                        {group.ids.map(mId => (
                          <button
                            key={mId}
                            type="button"
                            onClick={() => { setModel(mId); setShowModelPicker(false); }}
                            className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between gap-2 transition-colors ${
                              model === mId ? accent.active : `text-slate-300 ${accent.hover}`
                            }`}
                          >
                            <span className="min-w-0 flex flex-col">
                              <span className="truncate">{MODEL_SPECS[mId]?.name || mId}</span>
                              <span className="truncate text-[9px] text-slate-500 font-normal">
                                {MODEL_SPECS[mId]?.tag || mId}
                              </span>
                            </span>
                            {model === mId && <Check size={13} className={`${accent.check} shrink-0`} />}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tab 2: [Param] — floats upward over the canvas */}
            <div className="relative" ref={paramsPickerRef}>
              <button
                type="button"
                onClick={() => setShowParams(!showParams)}
                className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] rounded-t-md border-t border-l border-r transition-all ${
                  showParams
                    ? 'bg-cyber-950 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-900/90 border-cyan-500/30 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200'
                }`}
                title="Generation parameters (Temperature, Top-P, Max Tokens)"
              >
                <Settings2 size={12} className="text-cyan-400" />
                <span>Param</span>
                {showParams ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
              </button>

              {showParams && (
                <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bottom-full mb-2 z-50 w-[min(92vw,600px)] bg-cyber-950/95 border border-cyan-500/40 rounded-xl shadow-glow-cyan p-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-fadeIn">
                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Temperature:</span>
                      <span className="text-cyan-300 font-bold">{temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.5"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>0.0 (Logic)</span>
                      <span>1.5 (Creative)</span>
                    </div>
                  </div>

                  {/* Top-P */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Top-P:</span>
                      <span className="text-cyan-300 font-bold">{topP}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>0.1 (Focused)</span>
                      <span>1.0 (Diverse)</span>
                    </div>
                  </div>

                  {/* Max Output Tokens */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Max Tokens:</span>
                      <span className="text-cyan-300 font-bold">{maxOutputTokens}</span>
                    </div>
                    <input
                      type="range"
                      min="512"
                      max="8192"
                      step="256"
                      value={maxOutputTokens}
                      onChange={(e) => setMaxOutputTokens(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>512</span>
                      <span>8,192</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Tab 3: [World linked: ...] */}
            <div className="relative" ref={worldPickerRef}>
              <button
                type="button"
                onClick={() => setShowWorldPicker(!showWorldPicker)}
                className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] rounded-t-md border-t border-l border-r transition-all ${
                  showWorldPicker
                    ? 'bg-cyber-950 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-900/90 border-cyan-500/30 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200'
                }`}
                title="Thế giới đang liên kết (World)"
              >
                <Globe size={12} className={linkedBook ? 'text-emerald-400' : 'text-slate-500'} />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">
                  World linked: {linkedBook ? linkedBook.title : 'None'}
                </span>
                <ChevronDown size={10} className="text-slate-400" />
              </button>

              {/* World Picker Dropdown */}
              {showWorldPicker && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-cyber-950 border border-cyan-500/40 rounded-lg shadow-glow-cyan p-2 z-50 max-h-72 overflow-y-auto space-y-1 animate-fadeIn text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-1 border-b border-slate-800 pb-1 flex justify-between">
                    <span>Liên kết World</span>
                    <span className="text-cyan-400">{books.length} Worlds</span>
                  </div>

                  <button
                    onClick={() => { onLinkBook?.(null); setShowWorldPicker(false); }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors ${
                      !activeBookId ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:bg-cyber-900 hover:text-slate-200'
                    }`}
                  >
                    <span>Không liên kết (None)</span>
                    {!activeBookId && <Check size={13} className="text-cyan-400" />}
                  </button>

                  {books.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { onLinkBook?.(b.id); setShowWorldPicker(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors ${
                        activeBookId === b.id ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-cyber-900 hover:text-cyan-300'
                      }`}
                    >
                      <span className="truncate pr-1">{b.title}</span>
                      {activeBookId === b.id && <Check size={13} className="text-cyan-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Textarea Box */}
          <div className="relative flex flex-col bg-cyber-950/95 border border-cyan-500/30 rounded-b-xl rounded-tr-xl p-2.5 focus-within:border-cyan-400 focus-within:shadow-glow-cyan-sm transition-all shadow-inner">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
                placeholder={isBusy ? "Đang xử lý luồng tạo thế giới..." : "Chat here..."}
                className="w-full bg-transparent px-1.5 py-1 text-xs text-slate-100 placeholder-slate-500 resize-none focus:outline-none leading-relaxed max-h-40 font-mono"
              />

              {/* [Send] / [Stop] Button */}
              <div className="shrink-0">
                {isBusy ? (
                  <button
                    onClick={onAbort}
                    type="button"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-500/50 shadow-glow-rose-sm cursor-pointer transition-all animate-fadeIn"
                    title="Dừng luồng tạo"
                  >
                    <Square size={12} className="fill-current text-rose-400" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={onSend}
                    disabled={!prompt.trim()}
                    className={`flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !prompt.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-glow-emerald cursor-pointer'
                    }`}
                  >
                    <span>Send</span>
                    <CornerDownLeft size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Sát viền dưới bên phải của khung chat: Nút/toggle nhỏ [✓ summary req] */}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800/60 text-[10px]">
              <span className="text-slate-500 font-sans hidden sm:inline">
                Enter để gửi, Shift+Enter xuống dòng
              </span>

              <div className="ml-auto flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSummaryReq?.(!isSummaryReq)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all flex items-center space-x-1 cursor-pointer select-none ${
                    isSummaryReq
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-glow-emerald-sm font-semibold'
                      : 'bg-cyber-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                  title="Yêu cầu AI bổ sung phần tóm tắt ngắn (Summary) về diễn biến ở cuối phản hồi"
                >
                  <span className={isSummaryReq ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                    ✓
                  </span>
                  <span>summary req</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Thanh Dock gồm 6 nút vuông lớn xếp ngang có icon */}
      <div className="border-t border-cyan-500/15 bg-cyber-950/80 pl-2 pr-12 sm:px-2 py-2 flex items-center justify-center gap-2 sm:gap-4 select-none">
        {/* 1. Chat Session */}
        <button
          onClick={onOpenSessionDrawer}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md relative"
          title="Mở danh sách phiên chat (Chronicles)"
        >
          <MessageSquare size={18} className="group-hover:scale-110 transition-transform text-cyan-400" />
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-cyan-200 tracking-tight">
            Session
          </span>
          {sessionsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold font-mono">
              {sessionsCount}
            </span>
          )}
        </button>

        {/* 2. Lorebook */}
        <button
          onClick={onOpenLorebook}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md"
          title="Mở Lorebook Database & Multiverse"
        >
          <Database size={18} className="group-hover:scale-110 transition-transform text-cyan-400" />
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-cyan-200 tracking-tight">
            Lorebook
          </span>
        </button>

        {/* 3. Pool API Key */}
        <button
          onClick={onOpenKeyPool}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md relative"
          title="Quản lý Gemini & DeepSeek API Key Vault (BYOK)"
        >
          <KeyRound size={18} className="group-hover:scale-110 transition-transform text-cyan-400" />
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-cyan-200 tracking-tight">
            Pool Key
          </span>
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-cyber-950 border border-slate-700 text-slate-300 font-mono font-semibold">
            {activeKeysCount}/{totalKeysCount}
          </span>
        </button>

        {/* 4. World / Global State */}
        <button
          onClick={onOpenWorldState}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md relative"
          title="Cài đặt World & Global State Matrix"
        >
          <Globe size={18} className="group-hover:scale-110 transition-transform text-emerald-400" />
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-emerald-200 tracking-tight">
            World
          </span>
          {linkedBook && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-cyber-950 animate-pulse" />
          )}
        </button>

        {/* 5. Lore Context */}
        <button
          onClick={onToggleLoreContext}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md relative"
          title="Xem Lore Context đã tiêm vào lượt chat hiện tại"
        >
          <Cpu size={18} className="group-hover:scale-110 transition-transform text-purple-400" />
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-purple-200 tracking-tight">
            Lore Ctx
          </span>
          {retrievedCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-400 text-black font-bold font-mono">
              {retrievedCount}
            </span>
          )}
        </button>

        {/* 6. Language / Translate (A/文) */}
        <button
          onClick={onOpenLanguage}
          className="w-13 h-13 sm:w-15 sm:h-15 p-2 rounded-xl bg-cyber-900/90 border border-slate-800 hover:border-cyan-400/70 hover:bg-cyan-950/30 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center transition-all group shadow-md"
          title="Đổi ngôn ngữ / Translate (A/文)"
        >
          <div className="flex items-center space-x-0.5 text-slate-300 group-hover:text-cyan-300">
            <span className="font-bold text-xs">A</span>
            <span className="text-[10px] opacity-70">/文</span>
          </div>
          <span className="text-[9px] font-mono mt-1 text-slate-300 group-hover:text-cyan-200 uppercase tracking-tight">
            {language}
          </span>
        </button>
      </div>
    </div>
  );
}
