import React from 'react';
import { RotateCcw, Sliders, Scissors, Info } from 'lucide-react';
import Modal from './Modal';
import { formatTokenCount } from '../services/tokenEstimator';

export default function ContextSettingsModal({
  isOpen,
  onClose,
  rollingThreshold = 32768,
  onUpdateRollingThreshold,
  limit = 1048576,
  currentTokens = 0,
  isRolled = false,
  historyStats = null
}) {
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rolling Context Window Settings"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 font-mono select-none text-xs">
        {/* Status Banner */}
        <div className="p-3 rounded-lg bg-cyber-950 border border-cyan-500/25 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Usage</span>
            <span className="text-sm font-bold text-cyan-300">
              {formatTokenCount(currentTokens)} <span className="text-slate-500 font-normal">/ {formatTokenCount(limit)} tokens</span>
            </span>
          </div>

          {isRolled ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-950/70 border border-amber-500/40 text-amber-300">
              <Scissors size={13} />
              <span>Rolled ({historyStats?.keptMessages || 0}/{historyStats?.originalMessages || 0})</span>
            </div>
          ) : (
            <span className="text-[11px] text-emerald-400 font-semibold">
              ✓ Full History Active
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
          Khi tổng dung lượng hội thoại đạt tới <strong>ngưỡng cuộn (Rolling Context)</strong>, hệ thống sẽ bảo toàn Master System Prompt và Lorebook RAG, đồng thời tự động nén hoặc cắt bớt các tin nhắn đầu của phiên để duy trì tính nhất quán mà không bị tràn token.
        </p>

        {/* Preset Buttons */}
        <div>
          <label className="text-[11px] font-semibold text-slate-300 block mb-2 uppercase tracking-wider">
            Các mốc cuộn khuyến nghị (Presets):
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => {
                  onUpdateRollingThreshold(p.value, true);
                  onClose();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  rollingThreshold === p.value
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-glow-cyan-sm font-bold'
                    : 'bg-cyber-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range Slider */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300">Tùy chỉnh ngưỡng cuộn:</span>
            <span className="text-cyan-300 font-bold font-mono text-xs">
              {rollingThreshold.toLocaleString()} tokens
            </span>
          </div>
          <input
            type="range"
            min="4096"
            max={Math.min(limit, 524288)}
            step="4096"
            value={rollingThreshold}
            onChange={(e) => onUpdateRollingThreshold(parseInt(e.target.value, 10), false)}
            className="w-full h-1.5 bg-cyber-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>4,096 tokens</span>
            <span>{formatTokenCount(Math.min(limit, 524288))}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
