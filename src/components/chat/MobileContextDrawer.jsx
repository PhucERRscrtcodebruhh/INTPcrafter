import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sliders, 
  Zap, 
  BookMarked, 
  Check, 
  Layers, 
  ShieldCheck, 
  Scissors, 
  AlertTriangle,
  Info 
} from 'lucide-react';
import { formatTokenCount, estimateTokens, getModelSpec } from '../../services/tokenEstimator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { api } from '../../services/api';

export default function MobileContextDrawer({
  isOpen = false,
  onClose,
  currentTokens = 0,
  limit = 1048576,
  rollingThreshold = 32768,
  isRolled = false,
  historyStats = null,
  activeModel = 'gemini-3.8-flash',
  sessionId = null,
  bookInstruction = '',
  retrievedLore = [],
  messages = [],
  onUpdateRollingThreshold,
  onCompactSuccess,
  onOpenJournal,
}) {
  const [mounted, setMounted] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactStatus, setCompactStatus] = useState(null);
  const sheetRef = useRef(null);

  const updateParameter = useSettingsStore((state) => state.updateParameter);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const spec = getModelSpec(activeModel);
  const effectiveLimit = Math.max(1, spec?.contextLimit || limit || 1048576);
  const rawPercent = (currentTokens / effectiveLimit) * 100;

  const isRed = rawPercent > 85;
  const isAmber = rawPercent >= 65 && rawPercent <= 85;

  // Preset steps specified: 32k, 64k, 128k, 250k, 1.0M
  const PRESET_STEPS = [
    { label: '32k', value: 32768 },
    { label: '64k', value: 65536 },
    { label: '128k', value: 131072 },
    { label: '250k', value: 256000 },
    { label: '500k', value: 524288 },
    { label: '1.0M', value: 1048576 },
  ].filter(p => p.value <= effectiveLimit);

  // Tier 1 / 2 / 3 Token Estimation
  const tier1Estimated = Math.max(1200, estimateTokens(bookInstruction) + 500);
  const tier2Estimated = Math.max(300, estimateTokens(JSON.stringify(retrievedLore || [])));
  const tier3Estimated = Math.max(0, currentTokens - tier1Estimated - tier2Estimated);

  const tier1Percent = Math.min(100, (tier1Estimated / effectiveLimit) * 100);
  const tier2Percent = Math.min(100 - tier1Percent, (tier2Estimated / effectiveLimit) * 100);
  const tier3Percent = Math.min(100 - tier1Percent - tier2Percent, (tier3Estimated / effectiveLimit) * 100);

  const handleSetContextCap = (targetCap, persist = true) => {
    updateParameter('maxContextTokens', targetCap);
    onUpdateRollingThreshold?.(targetCap, persist);
  };

  const handleCompact = async () => {
    if (!sessionId || isCompacting) return;
    setIsCompacting(true);
    setCompactStatus(null);

    try {
      // Archive older turns into Blank RAG lore
      const res = await api.compactSession(sessionId, 10);
      if (res?.compacted) {
        setCompactStatus({
          type: 'success',
          message: `✓ Đã nén ${res.purgedCount} lượt hội thoại vào Chronicle Journal!`,
        });
        onCompactSuccess?.(res);
      } else {
        setCompactStatus({
          type: 'info',
          message: res?.message || 'Lịch sử hiện tại đã gọn gàng, chưa cần nén.',
        });
      }
    } catch (err) {
      console.error('[MobileContextDrawer] Compact error:', err);
      setCompactStatus({
        type: 'error',
        message: err.message || 'Lỗi khi nén hội thoại.',
      });
    } finally {
      setIsCompacting(false);
    }
  };

  const drawerContent = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm select-none font-mono animate-fadeIn pointer-events-auto"
      onClick={onClose}
    >
      {/* Bottom Sheet Container */}
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0a0f1d] border-t border-cyan-500/30 rounded-t-2xl p-4 shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col max-h-[88vh] overflow-hidden animate-slideUp pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {/* Drag handle bar */}
        <div className="w-full flex justify-center pb-2 shrink-0">
          <div className="w-12 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Header: Total tokens used / max limit with close button */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-glow-cyan-sm">
              <Sliders size={15} />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Context Window
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  {spec?.name || activeModel}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                Total Used:{' '}
                <strong className={`font-mono ${isRed ? 'text-rose-400' : isAmber ? 'text-amber-400' : 'text-cyan-300'}`}>
                  {formatTokenCount(currentTokens)}
                </strong>{' '}
                / <span className="font-mono">{formatTokenCount(effectiveLimit)}</span> ({rawPercent.toFixed(1)}%)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-cyber-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng (Close)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable controls body */}
        <div className="overflow-y-auto no-scrollbar py-3 space-y-3.5 text-xs">
          
          {/* Status banner */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            isRed
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : isAmber
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
          }`}>
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Rolling Status
              </span>
              <div className="text-sm font-bold font-mono">
                {currentTokens.toLocaleString()} tokens
              </div>
            </div>

            <div className="text-right">
              {isRolled ? (
                <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 text-[10px] font-bold">
                  <Scissors size={11} />
                  <span>Rolled ({historyStats?.keptMessages || 0}/{historyStats?.originalMessages || 0})</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
                  <ShieldCheck size={11} />
                  <span>Full History</span>
                </div>
              )}
              <span className="text-[9px] text-slate-400 block mt-0.5">
                Threshold: <strong className="font-mono text-slate-200">{formatTokenCount(rollingThreshold)}</strong>
              </span>
            </div>
          </div>

          {/* Context Window Slider & Presets */}
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyan-500/20 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders size={13} className="text-cyan-400" />
                <span>Context Window Slider (Max Context Cap)</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-mono font-bold text-[10px]">
                {rollingThreshold.toLocaleString()} tokens
              </span>
            </div>

            {/* Stepper / Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_STEPS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handleSetContextCap(preset.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
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
            <div className="space-y-1 pt-1">
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
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>4k</span>
                <span>{formatTokenCount(Math.floor(effectiveLimit / 2))}</span>
                <span>{formatTokenCount(effectiveLimit)} max</span>
              </div>
            </div>
          </div>

          {/* Token Stack Breakdown (3-Tier Envelope) */}
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers size={13} className="text-cyan-400" />
                <span>Token Stack Breakdown</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Free: <strong className="text-emerald-400 font-mono">{formatTokenCount(Math.max(0, effectiveLimit - currentTokens))}</strong>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${Math.max(2, tier1Percent)}%` }}
                className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.7)]"
                title={`Tier 1 (Cached Core): ~${formatTokenCount(tier1Estimated)} tokens`}
              />
              <div
                style={{ width: `${Math.max(1, tier2Percent)}%` }}
                className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                title={`Tier 2 (Live Arc Context): ~${formatTokenCount(tier2Estimated)} tokens`}
              />
              <div
                style={{ width: `${Math.max(1, tier3Percent)}%` }}
                className="h-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]"
                title={`Tier 3 (Active Dialogue): ~${formatTokenCount(tier3Estimated)} tokens`}
              />
            </div>

            {/* Tier Legend */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9px]">
              <div className="p-1.5 rounded bg-cyber-900/60 border border-cyan-500/20 flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-slate-300 font-bold truncate">Tier 1: Core</span>
                </div>
                <span className="text-cyan-300 font-mono mt-0.5">~{formatTokenCount(tier1Estimated)}</span>
              </div>

              <div className="p-1.5 rounded bg-cyber-900/60 border border-emerald-500/20 flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-bold truncate">Tier 2: Arc</span>
                </div>
                <span className="text-emerald-300 font-mono mt-0.5">~{formatTokenCount(tier2Estimated)}</span>
              </div>

              <div className="p-1.5 rounded bg-cyber-900/60 border border-purple-500/20 flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-slate-300 font-bold truncate">Tier 3: Chat</span>
                </div>
                <span className="text-purple-300 font-mono mt-0.5">~{formatTokenCount(tier3Estimated)}</span>
              </div>
            </div>
          </div>

          {/* Quick Action: [⚡ Sync & Compact 20 Chaps] / [⚡ Compact History to Blank RAG] */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyber-950 via-slate-900 to-cyber-950 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Zap size={14} className="text-cyan-400 animate-pulse" />
                <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                  ⚡ Sync & Compact 20 Chaps
                </span>
              </div>
              <span className="text-[9px] text-cyan-400/80 font-mono">
                Reclaim Headroom
              </span>
            </div>

            <p className="text-[10.5px] text-slate-400 font-sans leading-relaxed">
              Tự động tóm tắt các lượt hội thoại cũ, lưu vào <strong>Chronicle Journal (Blank RAG Lore)</strong> và dọn dẹp tin nhắn cũ để giải phóng token.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCompact}
                disabled={isCompacting || !sessionId}
                className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md ${
                  isCompacting
                    ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-950 via-cyan-900/60 to-cyan-950 border-cyan-400 text-cyan-200 hover:text-white hover:border-cyan-300 shadow-glow-cyan-sm active:scale-98'
                }`}
              >
                <Zap size={13} className={isCompacting ? 'animate-spin' : 'text-cyan-400'} />
                <span>{isCompacting ? 'Đang nén lịch sử...' : '⚡ Sync & Compact 20 Chaps'}</span>
              </button>

              {onOpenJournal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenJournal();
                  }}
                  className="px-3 py-2 rounded-lg bg-cyber-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-200 text-xs flex items-center space-x-1 transition-all"
                  title="Mở Chronicle Journal"
                >
                  <BookMarked size={13} className="text-cyan-400" />
                  <span>Journal</span>
                </button>
              )}
            </div>

            {/* Compact Status Feedback */}
            {compactStatus && (
              <div className={`p-2 rounded-lg text-[10.5px] font-sans flex items-center justify-between animate-fadeIn ${
                compactStatus.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : compactStatus.type === 'error'
                    ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                    : 'bg-cyber-900 border border-cyan-500/30 text-cyan-300'
              }`}>
                <div className="flex items-center space-x-1.5">
                  {compactStatus.type === 'success' && <Check size={12} />}
                  {compactStatus.type === 'error' && <AlertTriangle size={12} />}
                  {compactStatus.type === 'info' && <Info size={12} />}
                  <span>{compactStatus.message}</span>
                </div>

                {compactStatus.type === 'success' && onOpenJournal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onOpenJournal();
                    }}
                    className="text-cyan-300 hover:underline text-[10px] font-mono ml-2 shrink-0"
                  >
                    Xem Journal 📜
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-cyan-500/20 flex items-center justify-between text-[10px] shrink-0">
          <span className="text-slate-500 font-sans">
            Tự động lưu & áp dụng cho các lượt chat tới.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 font-bold transition-colors text-xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
