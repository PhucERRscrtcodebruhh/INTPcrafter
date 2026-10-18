import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatTokenCount, getModelSpec } from '../../services/tokenEstimator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { api } from '../../services/api';

export default function MobileContextDrawer({
  isOpen = false,
  onClose,
  currentTokens = 0,
  limit = 1048576,
  rollingThreshold = 32768,
  activeModel = 'gemini-3.8-flash',
  sessionId = null,
  onUpdateRollingThreshold,
  onCompactSuccess,
  onOpenJournal,
}) {
  const [mounted, setMounted] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactStatus, setCompactStatus] = useState(null);

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

  // Preset steps: 32k, 64k, 128k, 250k, 1.0M
  const PRESET_STEPS = [
    { label: '32k', value: 32768 },
    { label: '64k', value: 65536 },
    { label: '128k', value: 131072 },
    { label: '250k', value: 256000 },
    { label: '500k', value: 524288 },
    { label: '1.0M', value: 1048576 },
  ].filter((p) => p.value <= effectiveLimit);

  const handleSetContextCap = (targetCap, persist = true) => {
    updateParameter('maxContextTokens', targetCap);
    onUpdateRollingThreshold?.(targetCap, persist);
  };

  const handleCompactHistory = async () => {
    if (!sessionId || isCompacting) return;
    setIsCompacting(true);
    setCompactStatus(null);

    try {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:hidden">
      {/* Backdrop tap to close */}
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      
      {/* Bottom Sheet Drawer */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#070b14] border-t border-cyan-500/40 rounded-t-2xl p-4 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl z-10 animate-in slide-in-from-bottom duration-200"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            <h3 className="font-mono text-sm font-bold text-slate-200 tracking-wider uppercase">
              CONTEXT MONITOR & BUDGET
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white font-mono text-lg px-2 cursor-pointer transition-colors"
            title="Đóng (Close)"
          >
            ✕
          </button>
        </div>

        {/* Sliders & Context Info */}
        <div className="space-y-4 font-mono text-xs text-slate-300">
          <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded border border-slate-800">
            <span>Active Context Window:</span>
            <span className="text-cyan-400 font-bold">
              {formatTokenCount(currentTokens)} / {formatTokenCount(effectiveLimit)}
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center text-slate-400 mb-1.5">
              <label>Max Context Ceiling (Sliding Cap):</label>
              <span className="text-cyan-300 font-bold">{rollingThreshold.toLocaleString()} tokens</span>
            </div>

            {/* Stepper preset buttons */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_STEPS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleSetContextCap(p.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                    rollingThreshold === p.value
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <input 
              type="range" 
              min="32000" 
              max={effectiveLimit} 
              step="16000"
              value={rollingThreshold} 
              onChange={(e) => handleSetContextCap(Number(e.target.value), false)}
              onMouseUp={(e) => handleSetContextCap(Number(e.target.value), true)}
              onTouchEnd={(e) => handleSetContextCap(Number(e.target.value), true)}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>32k min</span>
              <span>{formatTokenCount(Math.floor(effectiveLimit / 2))}</span>
              <span>{formatTokenCount(effectiveLimit)} max</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleCompactHistory}
            disabled={isCompacting || !sessionId}
            className="w-full py-2.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 font-bold rounded tracking-wide transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isCompacting ? (
              <span>Đang nén lịch sử...</span>
            ) : (
              <span>⚡ COMPACT RECENT 20 CHAPS TO LORE</span>
            )}
          </button>

          {/* Compact Status Feedback */}
          {compactStatus && (
            <div className={`p-2.5 rounded-lg text-[11px] flex items-center justify-between animate-fadeIn ${
              compactStatus.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                : compactStatus.type === 'error'
                  ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 border border-cyan-500/30 text-cyan-300'
            }`}>
              <span>{compactStatus.message}</span>
              {compactStatus.type === 'success' && onOpenJournal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenJournal();
                  }}
                  className="text-cyan-300 hover:underline text-[10px] ml-2 shrink-0"
                >
                  Xem Journal 📜
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
