import React, { useState, useRef, useEffect } from 'react';
import { 
  Gauge, 
  Sliders, 
  RotateCcw, 
  Info, 
  Sparkles, 
  AlertCircle,
  Scissors,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';
import { formatTokenCount, getModelSpec } from '../services/tokenEstimator';

export default function ContextBar({
  currentTokens = 0,
  activeModel = 'gemini-3.8-flash',
  rollingThreshold = 32768,
  onUpdateRollingThreshold,
  isRolled = false,
  historyStats = null,
  books = [],
  activeBookId = null,
  onLinkBook
}) {
  const [showThresholdPicker, setShowThresholdPicker] = useState(false);
  const [showWorldPicker, setShowWorldPicker] = useState(false);
  const worldPickerRef = useRef(null);

  const spec = getModelSpec(activeModel);
  const limit = spec.contextLimit;
  const usagePercent = Math.min(100, Math.max(0.01, (currentTokens / limit) * 100));
  const thresholdPercent = Math.min(100, (rollingThreshold / limit) * 100);

  // Close world picker on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (worldPickerRef.current && !worldPickerRef.current.contains(e.target)) {
        setShowWorldPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Preset token thresholds
  const presets = [
    { label: '8k Tokens', value: 8192 },
    { label: '16k Tokens', value: 16384 },
    { label: '32k Tokens', value: 32768 },
    { label: '64k Tokens', value: 65536 },
    { label: '128k Tokens', value: 131072 },
    { label: '256k Tokens', value: 262144 },
    { label: 'Max Context', value: Math.floor(limit * 0.9) }
  ].filter(p => p.value <= limit);

  const linkedBook = books.find(b => b.id === activeBookId) || null;

  return (
    <div className="relative border-b border-cyan-500/15 bg-cyber-900/60 px-4 py-2 select-none font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Token Count & Model Limit Gauge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Gauge size={14} className="text-cyan-400" />
            <span className="text-slate-400">Context Window:</span>
            <span className="font-bold text-cyan-300">
              {formatTokenCount(currentTokens)}
            </span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400 font-mono">
              {formatTokenCount(limit)} tokens
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyber-950 border border-slate-800 text-slate-400">
              {usagePercent < 0.1 ? '<0.1%' : `${usagePercent.toFixed(1)}%`}
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="w-20 sm:w-28 h-2 bg-cyber-950 rounded-full border border-slate-800 overflow-hidden relative">
            {/* Rolling threshold marker line */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${thresholdPercent}%` }}
              title={`Rolling Trigger: ${formatTokenCount(rollingThreshold)} tokens`}
            />
            {/* Current context bar */}
            <div
              className={`h-full transition-all duration-500 ${
                currentTokens >= rollingThreshold 
                  ? 'bg-amber-400 shadow-glow-amber' 
                  : 'bg-cyan-400 shadow-glow-cyan-sm'
              }`}
              style={{ width: `${Math.max(1, usagePercent)}%` }}
            />
          </div>
        </div>

        {/* Center/Right: Linked World & Rolling Controller */}
        <div className="flex items-center space-x-2.5">
          {/* Linked World / Lorebook Dropdown */}
          <div className="relative" ref={worldPickerRef}>
            <button
              onClick={() => setShowWorldPicker(!showWorldPicker)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border text-xs transition-all ${
                linkedBook
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-glow-cyan-sm'
                  : 'bg-cyber-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Link this story session to a dedicated Lore World container"
            >
              <Globe size={13} className={linkedBook ? 'text-cyan-400' : 'text-slate-500'} />
              <span className="text-slate-400">World:</span>
              <span className="font-semibold text-slate-200 max-w-[120px] truncate">
                {linkedBook ? linkedBook.title : 'None (Unlinked)'}
              </span>
              <ChevronDown size={11} className="text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {showWorldPicker && (
              <div className="absolute right-0 mt-1 w-64 bg-cyber-900 border border-cyan-500/40 rounded-lg shadow-glow-cyan p-1.5 z-40 space-y-1 animate-fadeIn">
                <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                  <span>Linked Story World</span>
                  <span className="text-cyan-400 font-mono">{books.length} Worlds</span>
                </div>

                <button
                  onClick={() => { onLinkBook?.(null); setShowWorldPicker(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                    !activeBookId ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:bg-cyber-950 hover:text-slate-200'
                  }`}
                >
                  <div>
                    <div>None (No World Linked)</div>
                    <div className="text-[10px] text-slate-500">RAG will not inject lore</div>
                  </div>
                  {!activeBookId && <Check size={13} className="text-cyan-400" />}
                </button>

                {books.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { onLinkBook?.(b.id); setShowWorldPicker(false); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                      activeBookId === b.id ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-cyber-950 hover:text-cyan-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{b.title}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{b.entry_count || 0} lore entries</div>
                    </div>
                    {activeBookId === b.id && <Check size={13} className="text-cyan-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status of Rolling */}
          {isRolled && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] animate-pulse">
              <Scissors size={12} />
              <span>
                Rolled ({historyStats?.keptMessages || 0}/{historyStats?.originalMessages || 0})
              </span>
            </div>
          )}

          {/* Rolling Trigger Setting Button */}
          <button
            onClick={() => setShowThresholdPicker(!showThresholdPicker)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-cyber-950 border border-cyan-500/30 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-all text-xs"
            title="Configure context rolling threshold"
          >
            <Sliders size={12} className="text-cyan-400" />
            <span className="text-slate-400">Roll at:</span>
            <span className="font-semibold text-cyan-300">
              {formatTokenCount(rollingThreshold)}
            </span>
          </button>
        </div>
      </div>

      {/* Popover / Drawer for adjusting Rolling Threshold */}
      {showThresholdPicker && (
        <div className="mt-2 p-3 rounded-lg glass-panel border border-cyan-500/30 bg-cyber-950/95 shadow-glow-cyan z-30">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/15">
            <div className="flex items-center space-x-1.5 text-cyan-400">
              <RotateCcw size={13} />
              <span className="font-semibold text-xs uppercase tracking-wider">
                Rolling Context Window Settings
              </span>
            </div>
            <button
              onClick={() => setShowThresholdPicker(false)}
              className="text-xs text-slate-400 hover:text-cyan-300"
            >
              Close ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Khi dung lượng hội thoại đạt ngưỡng này, hệ thống sẽ tự động <strong>cuộn ngữ cảnh (Rolling Context)</strong>: giữ nguyên Master System Instruction và Lorebook RAG, đồng thời cắt bớt các tin nhắn cũ để bảo toàn logic và tránh tràn token.
          </p>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => onUpdateRollingThreshold(p.value)}
                className={`px-2.5 py-1 rounded text-xs border transition-all ${
                  rollingThreshold === p.value
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Range Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Tùy chỉnh ngưỡng cuộn:</span>
              <span className="text-cyan-300 font-mono font-semibold">
                {rollingThreshold.toLocaleString()} tokens
              </span>
            </div>
            <input
              type="range"
              min="4096"
              max={Math.min(limit, 524288)}
              step="4096"
              value={rollingThreshold}
              onChange={(e) => onUpdateRollingThreshold(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
