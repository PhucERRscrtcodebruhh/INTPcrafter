import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sliders, 
  Scissors, 
  Zap, 
  BookMarked, 
  Check, 
  Info, 
  Layers, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { formatTokenCount, estimateTokens, getModelSpec } from '../../services/tokenEstimator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { api } from '../../services/api';

export default function ContextControllerBubble({
  currentTokens = 0,
  limit = 1048576,
  rollingThreshold = 32768,
  isRolled = false,
  historyStats = null,
  activeModel = 'gemini-3.8-flash',
  sessionId = null,
  bookId = null,
  bookInstruction = '',
  retrievedLore = [],
  messages = [],
  onUpdateRollingThreshold,
  onCompactSuccess,
  onOpenJournal,
  size = 44, // Default desktop size
  isMobileBadge = false, // When true, renders in ultra-compact mobile format
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactStatus, setCompactStatus] = useState(null); // { type: 'success'|'error'|'info', message: string }
  const popoverRef = useRef(null);

  // Settings store integration
  const parameters = useSettingsStore((state) => state.parameters);
  const updateParameter = useSettingsStore((state) => state.updateParameter);

  // Active limit and capacity calculation
  const spec = getModelSpec(activeModel);
  const maxModelLimit = spec?.contextLimit || limit || 1048576;
  const effectiveLimit = Math.max(1, maxModelLimit);

  const rawPercent = effectiveLimit > 0 ? (currentTokens / effectiveLimit) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0.5, rawPercent));

  // Dynamic capacity glow & color styling
  // 0% - 60%: Cyan (#00f0ff)
  // 60% - 85%: Amber (#f59e0b)
  // > 85%: Rose/Red (#f43f5e)
  const isHot = rawPercent >= 85;
  const isWarm = rawPercent >= 60 && rawPercent < 85;
  const isCool = rawPercent < 60;

  const accentColor = isHot ? '#f43f5e' : isWarm ? '#f59e0b' : '#00f0ff';
  const glowStyle = isHot 
    ? 'shadow-[0_0_12px_rgba(244,63,94,0.65)] border-rose-500/70 text-rose-300' 
    : isWarm 
      ? 'shadow-[0_0_10px_rgba(245,158,11,0.5)] border-amber-500/60 text-amber-300' 
      : 'shadow-[0_0_10px_rgba(0,240,255,0.4)] border-cyan-400/60 text-cyan-300';

  // SVG Radial meter math
  const strokeWidth = isMobileBadge ? 3 : 3.5;
  const svgSize = isMobileBadge ? 36 : size;
  const radius = (svgSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  // Threshold marker angle
  const thresholdPercent = Math.min(100, (rollingThreshold / effectiveLimit) * 100);
  const thresholdAngle = (thresholdPercent / 100) * 360;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const markerX = svgSize / 2 + radius * Math.cos(thresholdRad);
  const markerY = svgSize / 2 + radius * Math.sin(thresholdRad);

  // Label text inside radial circle
  const displayPercent = rawPercent < 0.1 && rawPercent > 0 
    ? '<0.1%' 
    : rawPercent >= 10 
      ? `${Math.round(rawPercent)}%` 
      : `${rawPercent.toFixed(1)}%`;

  // Tier Token Breakdown calculation
  // Tier 1: System & Core Invariants (Cached prefix)
  // Tier 2: Live State & World Context (Active RAG)
  // Tier 3: Rolling Conversation History & Prompts
  const tier1Estimated = Math.max(1200, estimateTokens(bookInstruction) + 500);
  const tier2Estimated = Math.max(300, estimateTokens(JSON.stringify(retrievedLore || [])));
  const tier3Estimated = Math.max(0, currentTokens - tier1Estimated - tier2Estimated);

  const tier1Percent = Math.min(100, (tier1Estimated / effectiveLimit) * 100);
  const tier2Percent = Math.min(100 - tier1Percent, (tier2Estimated / effectiveLimit) * 100);
  const tier3Percent = Math.min(100 - tier1Percent - tier2Percent, (tier3Estimated / effectiveLimit) * 100);

  // Preset caps defined in requirements: 32k, 64k, 128k, 250k, 500k, 1.0M
  const PRESET_CAPS = [
    { label: '32k', value: 32768 },
    { label: '64k', value: 65536 },
    { label: '128k', value: 131072 },
    { label: '250k', value: 256000 },
    { label: '500k', value: 524288 },
    { label: '1.0M', value: 1048576 },
  ].filter(p => p.value <= effectiveLimit);

  // Handle Context Limit adjustment
  const handleSetContextCap = (targetCap, persist = true) => {
    updateParameter('maxContextTokens', targetCap);
    onUpdateRollingThreshold?.(targetCap, persist);
  };

  // Handle Compact History to Blank RAG Lore action
  const handleCompact = async () => {
    if (!sessionId || isCompacting) return;
    setIsCompacting(true);
    setCompactStatus(null);

    try {
      const res = await api.compactSession(sessionId, 10);
      if (res?.compacted) {
        setCompactStatus({
          type: 'success',
          message: `✓ Đã nén ${res.purgedCount} lượt chat cũ vào Chronicle Journal!`,
        });
        onCompactSuccess?.(res);
      } else {
        setCompactStatus({
          type: 'info',
          message: res?.message || 'Lịch sử hiện tại đã gọn gàng, chưa cần nén.',
        });
      }
    } catch (err) {
      console.error('[ContextController] Compact error:', err);
      setCompactStatus({
        type: 'error',
        message: err.message || 'Lỗi khi nén hội thoại.',
      });
    } finally {
      setIsCompacting(false);
    }
  };

  // Keyboard shortcut: Escape closes popover
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside listener for desktop popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* ============================================================== */}
      {/* COLLAPSED STATE: Radial Meter Bubble (Desktop & Mobile modes)  */}
      {/* ============================================================== */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center justify-center shrink-0 rounded-full bg-cyber-950/90 border transition-all duration-200 cursor-pointer select-none active:scale-95 ${glowStyle} ${
          isMobileBadge ? 'w-9 h-9 md:hidden' : 'w-11 h-11'
        } ${className}`}
        title={`Context Window: ${formatTokenCount(currentTokens)} / ${formatTokenCount(effectiveLimit)} tokens (${rawPercent.toFixed(1)}%)\nRolling Cap: ${formatTokenCount(rollingThreshold)} tokens\nNhấp để mở Context Controller & Bộ nén Blank RAG.`}
      >
        {/* Ambient Glow Aura */}
        <div 
          className="absolute inset-0 rounded-full blur-xs opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        {/* SVG Radial Progress Arc */}
        <svg 
          width={svgSize} 
          height={svgSize} 
          className="transform -rotate-90 pointer-events-none"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Background Track Circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="#141b2d"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Threshold Marker Dot */}
          {thresholdPercent > 0 && thresholdPercent < 100 && (
            <circle
              cx={markerX}
              cy={markerY}
              r={strokeWidth / 2 + 0.8}
              fill="#f59e0b"
              stroke="#06080d"
              strokeWidth="0.8"
            />
          )}

          {/* Dynamic Fill Arc */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Label: Text % or Format */}
        <span className={`absolute font-mono font-bold tracking-tighter ${
          isMobileBadge ? 'text-[9px]' : 'text-[10px]'
        } ${isHot ? 'text-rose-300' : isWarm ? 'text-amber-300' : 'text-cyan-300'}`}>
          {displayPercent}
        </span>
      </button>

      {/* ============================================================== */}
      {/* EXPANDED STATE: Cyberpunk Popover / Mobile Bottom Sheet         */}
      {/* ============================================================== */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-xs select-none font-mono animate-fadeIn p-0 md:p-4"
          onClick={() => setIsOpen(false)}
        >
          <div 
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-xl max-h-[90vh] md:max-h-[85vh] bg-[#020617] border-t md:border border-cyan-500/40 rounded-t-2xl md:rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.22)] flex flex-col overflow-hidden animate-slideUp md:animate-scaleUp"
          >
            {/* Mobile Sheet Handle Bar */}
            <div className="w-full pt-2.5 pb-1 flex justify-center md:hidden shrink-0">
              <div className="w-12 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Header Bar */}
            <div className="px-4 py-3 border-b border-cyan-500/20 bg-[#020617]/95 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] shadow-glow-cyan-sm">
                  <Sliders size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
                      Context Window Controller
                    </h3>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                      {spec?.name || activeModel}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">
                    Max Model Headroom: <span className="text-cyan-300 font-mono font-semibold">{formatTokenCount(effectiveLimit)}</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-cyber-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 space-y-4 overflow-y-auto no-scrollbar text-xs">
              
              {/* 1. Status Telemetry Banner */}
              <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                isHot 
                  ? 'bg-rose-950/40 border-rose-500/40' 
                  : isWarm 
                    ? 'bg-amber-950/40 border-amber-500/40' 
                    : 'bg-cyan-950/40 border-cyan-500/30'
              }`}>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Active Token Utilization
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-xl font-bold font-mono tracking-tight ${
                      isHot ? 'text-rose-400' : isWarm ? 'text-amber-400' : 'text-cyan-300'
                    }`}>
                      {formatTokenCount(currentTokens)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      / {formatTokenCount(effectiveLimit)} tokens ({rawPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {isRolled ? (
                    <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-bold">
                      <Scissors size={12} />
                      <span>Rolled ({historyStats?.keptMessages || 0}/{historyStats?.originalMessages || 0})</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
                      <ShieldCheck size={12} />
                      <span>100% History Active</span>
                    </div>
                  )}
                  <span className="text-[9px] text-slate-400 block mt-1">
                    Threshold: <strong className="text-slate-300 font-mono">{formatTokenCount(rollingThreshold)}</strong>
                  </span>
                </div>
              </div>

              {/* 2. Token Stack Breakdown (Tier 1 / 2 / 3 Stacked Visualization) */}
              <div className="p-3.5 rounded-xl bg-cyber-950 border border-cyan-500/20 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers size={13} className="text-cyan-400" />
                    <span>Token Stack Breakdown (3-Tier Envelope)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Remaining: <strong className="text-emerald-400 font-mono">{formatTokenCount(Math.max(0, effectiveLimit - currentTokens))}</strong>
                  </span>
                </div>

                {/* Multi-segment Horizontal Progress Bar */}
                <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden flex shadow-inner">
                  {/* Tier 1: System & Core Invariants */}
                  <div 
                    style={{ width: `${Math.max(2, tier1Percent)}%` }}
                    className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.7)] transition-all duration-300"
                    title={`Tier 1 (Cached Prefix): ~${formatTokenCount(tier1Estimated)} tokens`}
                  />
                  {/* Tier 2: Live State & World Context */}
                  <div 
                    style={{ width: `${Math.max(1, tier2Percent)}%` }}
                    className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] transition-all duration-300"
                    title={`Tier 2 (Live Context): ~${formatTokenCount(tier2Estimated)} tokens`}
                  />
                  {/* Tier 3: Conversation History */}
                  <div 
                    style={{ width: `${Math.max(1, tier3Percent)}%` }}
                    className="h-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)] transition-all duration-300"
                    title={`Tier 3 (Active Dialogue): ~${formatTokenCount(tier3Estimated)} tokens`}
                  />
                </div>

                {/* Legend & Breakdown Items */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
                  <div className="p-2 rounded-lg bg-cyber-900/60 border border-cyan-500/20 flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-glow-cyan-sm" />
                      <span className="font-bold text-slate-300 truncate">Tier 1: Core Cache</span>
                    </div>
                    <span className="text-cyan-300 font-mono font-semibold mt-1">
                      ~{formatTokenCount(tier1Estimated)} tokens
                    </span>
                    <span className="text-[9px] text-slate-500">Sys Prompt & Magic Canon</span>
                  </div>

                  <div className="p-2 rounded-lg bg-cyber-900/60 border border-emerald-500/20 flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-glow-emerald-sm" />
                      <span className="font-bold text-slate-300 truncate">Tier 2: Live Context</span>
                    </div>
                    <span className="text-emerald-300 font-mono font-semibold mt-1">
                      ~{formatTokenCount(tier2Estimated)} tokens
                    </span>
                    <span className="text-[9px] text-slate-500">Arc & Active Lore Entities</span>
                  </div>

                  <div className="p-2 rounded-lg bg-cyber-900/60 border border-purple-500/20 flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                      <span className="font-bold text-slate-300 truncate">Tier 3: Chat Turns</span>
                    </div>
                    <span className="text-purple-300 font-mono font-semibold mt-1">
                      ~{formatTokenCount(tier3Estimated)} tokens
                    </span>
                    <span className="text-[9px] text-slate-500">Rolling Dialogue History</span>
                  </div>
                </div>
              </div>

              {/* 3. Context Window Slider (Max Context Cap) */}
              <div className="p-3.5 rounded-xl bg-cyber-950 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Sliders size={13} className="text-cyan-400" />
                    <span>Rolling Window Cap (Max Context Cap)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-mono font-bold text-[11px]">
                    {rollingThreshold.toLocaleString()} tokens
                  </span>
                </div>

                {/* Stepper / Preset Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CAPS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleSetContextCap(preset.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        rollingThreshold === preset.value
                          ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 shadow-glow-cyan-sm font-bold scale-102'
                          : 'bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Range Slider */}
                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="4096"
                    max={effectiveLimit}
                    step="4096"
                    value={rollingThreshold}
                    onChange={(e) => handleSetContextCap(parseInt(e.target.value, 10), false)}
                    onMouseUp={(e) => handleSetContextCap(parseInt(e.target.value, 10), true)}
                    onTouchEnd={(e) => handleSetContextCap(parseInt(e.target.value, 10), true)}
                    className="w-full h-2 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>4k (Minimal)</span>
                    <span>{formatTokenCount(Math.floor(effectiveLimit / 2))}</span>
                    <span>{formatTokenCount(effectiveLimit)} (Full Model Limit)</span>
                  </div>
                </div>
              </div>

              {/* 4. Quick Compact Action: [⚡ Compact History to Blank RAG] */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyber-950 via-slate-900 to-cyber-950 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Zap size={14} className="text-[#00f0ff] animate-pulse" />
                    <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                      Quick Compact Action
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-400/80 font-mono">
                    Free up token headroom
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Tự động tóm tắt các lượt hội thoại cũ, lưu vào <strong>Chronicle Journal (Blank RAG Lore)</strong> và dọn dẹp các tin nhắn cũ để giải phóng bộ nhớ token tức thì.
                </p>

                {/* Action Button */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCompact}
                    disabled={isCompacting || !sessionId}
                    className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md ${
                      isCompacting
                        ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400 animate-pulse'
                        : 'bg-gradient-to-r from-cyan-950 via-cyan-900/60 to-cyan-950 border-cyan-400 text-cyan-200 hover:text-white hover:border-[#00f0ff] shadow-glow-cyan-sm active:scale-98'
                    }`}
                  >
                    <Zap size={13} className={isCompacting ? 'animate-spin' : 'text-[#00f0ff]'} />
                    <span>{isCompacting ? 'Đang nén lịch sử hội thoại...' : '⚡ Compact History to Blank RAG'}</span>
                  </button>

                  {onOpenJournal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenJournal();
                      }}
                      className="px-3 py-2 rounded-lg bg-cyber-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-200 text-xs flex items-center space-x-1.5 transition-all"
                      title="Mở Chronicle Journal để xem ghi chú đã nén"
                    >
                      <BookMarked size={13} className="text-cyan-400" />
                      <span className="hidden sm:inline">Xem Nhật Ký</span>
                    </button>
                  )}
                </div>

                {/* Compact Feedback Banner */}
                {compactStatus && (
                  <div className={`p-2 rounded-lg text-[11px] font-sans flex items-center justify-between animate-fadeIn ${
                    compactStatus.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                      : compactStatus.type === 'error'
                        ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                        : 'bg-cyber-900 border border-cyan-500/30 text-cyan-300'
                  }`}>
                    <div className="flex items-center space-x-1.5">
                      {compactStatus.type === 'success' && <Check size={13} />}
                      {compactStatus.type === 'error' && <AlertTriangle size={13} />}
                      {compactStatus.type === 'info' && <Info size={13} />}
                      <span>{compactStatus.message}</span>
                    </div>

                    {compactStatus.type === 'success' && onOpenJournal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenJournal();
                        }}
                        className="text-cyan-300 hover:underline text-[10px] font-mono ml-2 shrink-0"
                      >
                        Mở Journal 📜
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Footer Action */}
            <div className="p-3 border-t border-cyan-500/20 bg-cyber-950 flex items-center justify-between text-[11px] shrink-0">
              <span className="text-slate-500 font-sans">
                Thay đổi có hiệu lực ngay lập tức cho các lượt chat tới.
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 font-bold transition-all text-xs"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
