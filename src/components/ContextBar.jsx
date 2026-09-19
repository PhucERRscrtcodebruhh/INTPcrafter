import React, { useState } from 'react';
import { 
  Gauge, 
  Sliders, 
  RotateCcw, 
  Info, 
  Sparkles, 
  AlertCircle,
  Scissors
} from 'lucide-react';
import { formatTokenCount, getModelSpec } from '../services/tokenEstimator';

export default function ContextBar({
  currentTokens = 0,
  activeModel = 'gemini-3.8-flash',
  rollingThreshold = 32768,
  onUpdateRollingThreshold,
  isRolled = false,
  historyStats = null
}) {
  const [showThresholdPicker, setShowThresholdPicker] = useState(false);
  const spec = getModelSpec(activeModel);
  const limit = spec.contextLimit;
  const usagePercent = Math.min(100, Math.max(0.01, (currentTokens / limit) * 100));
  const thresholdPercent = Math.min(100, (rollingThreshold / limit) * 100);

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

  return (
    <div className="relative border-b border-cyan-500/15 bg-cyber-900/60 px-4 py-2 select-none">
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
          <div className="w-24 sm:w-36 h-2 bg-cyber-950 rounded-full border border-slate-800 overflow-hidden relative">
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

        {/* Right: Rolling Context Threshold Controller */}
        <div className="flex items-center space-x-2">
          {/* Status of Rolling */}
          {isRolled && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] animate-pulse">
              <Scissors size={12} />
              <span>
                Window Rolled ({historyStats?.keptMessages || 0}/{historyStats?.originalMessages || 0} msgs active)
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
