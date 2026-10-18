import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Check, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Sparkles, 
  Activity, 
  Package, 
  Sliders 
} from 'lucide-react';
import { ClientRAGService } from '../services/ragEngine';

export default function LiveStateDrawer({
  bookId,
  entry,
  liveState: propLiveState,
  onStateUpdated,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Current live state (either passed from prop or from entry.liveState)
  const currentLiveState = propLiveState !== undefined ? propLiveState : entry?.liveState;
  const hasActiveMutation = Boolean(
    currentLiveState && (
      currentLiveState.status_summary ||
      currentLiveState.active_conditions ||
      currentLiveState.inventory_or_traits ||
      currentLiveState.rules_override
    )
  );

  const [statusSummary, setStatusSummary] = useState('');
  const [activeConditions, setActiveConditions] = useState('');
  const [inventoryOrTraits, setInventoryOrTraits] = useState('');
  const [rulesOverride, setRulesOverride] = useState('');

  // Sync form inputs when currentLiveState or entry changes
  useEffect(() => {
    if (currentLiveState) {
      setStatusSummary(currentLiveState.status_summary || '');
      setActiveConditions(currentLiveState.active_conditions || '');
      setInventoryOrTraits(currentLiveState.inventory_or_traits || '');
      setRulesOverride(currentLiveState.rules_override || '');
    } else {
      setStatusSummary('');
      setActiveConditions('');
      setInventoryOrTraits('');
      setRulesOverride('');
    }
  }, [currentLiveState, entry?.id]);

  const handleSave = async (e) => {
    e?.stopPropagation();
    if (!bookId || !entry?.id) return;

    setIsSaving(true);
    try {
      const delta = {
        status_summary: statusSummary.trim(),
        active_conditions: activeConditions.trim(),
        inventory_or_traits: inventoryOrTraits.trim(),
        rules_override: rulesOverride.trim() || null,
      };

      const res = await ClientRAGService.upsertLiveState(bookId, entry.id, delta);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onStateUpdated?.(entry.id, res.state || delta);
    } catch (err) {
      alert('Failed to save Live State: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async (e) => {
    e?.stopPropagation();
    if (!bookId || !entry?.id) return;

    if (!window.confirm(`Revert "${entry.title}" back to pure Base Canon? This clears the active HEAD mutation.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await ClientRAGService.clearLiveState(bookId, entry.id);
      setStatusSummary('');
      setActiveConditions('');
      setInventoryOrTraits('');
      setRulesOverride('');
      onStateUpdated?.(entry.id, null);
    } catch (err) {
      alert('Failed to revert Live State: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-mono text-xs w-full select-none" onClick={(e) => e.stopPropagation()}>
      {/* Quick-toggle Header Badge / Button */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] transition-all border ${
            hasActiveMutation
              ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)] hover:bg-[#00f0ff]/20'
              : 'bg-cyber-900/80 border-slate-700/60 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30'
          }`}
          title="Toggle Emergent Live State (HEAD) Overlay drawer"
        >
          {/* Neon cyan pulse indicator when holding an active mutation */}
          {hasActiveMutation ? (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]"></span>
            </span>
          ) : (
            <Zap size={12} className="text-slate-400 group-hover:text-cyan-400" />
          )}

          <span className="font-semibold tracking-wide">
            {hasActiveMutation ? '⚡ Live State (HEAD)' : '⚡ Live State (HEAD)'}
          </span>

          <span className="text-[10px] opacity-70">
            {hasActiveMutation ? '[MUTATED]' : '[CANON]'}
          </span>

          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Short inline preview when drawer is closed but state is mutated */}
        {!isOpen && hasActiveMutation && (
          <div className="truncate text-[10px] text-cyan-300/80 font-mono flex-1 text-right pl-2">
            {currentLiveState.status_summary || currentLiveState.active_conditions}
          </div>
        )}
      </div>

      {/* Expandable Cyberpunk Glassmorphism Drawer */}
      {isOpen && (
        <div className="mt-2.5 p-3 rounded-lg bg-cyber-950/90 backdrop-blur-md border border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.08)] space-y-2.5 animate-fadeIn">
          {/* Drawer Title Bar */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#00f0ff]/20">
            <div className="flex items-center space-x-1.5 text-[11px] text-[#00f0ff] font-bold uppercase tracking-wider">
              <Activity size={13} className="text-[#00f0ff]" />
              <span>HEAD State Delta — {entry?.title || 'Entity'}</span>
            </div>
            {hasActiveMutation && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00f0ff]/20 border border-[#00f0ff]/40 text-[#00f0ff] font-bold">
                ACTIVE OVERLAY
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-400 leading-tight">
            Emergent world state overlay. Injected in-memory at prompt assembly without invalidating L1/L2 canon cache.
          </p>

          {/* Field 1: Status Summary */}
          <div className="space-y-1">
            <label className="text-[10px] text-cyan-400 font-semibold uppercase flex items-center space-x-1">
              <Sparkles size={11} />
              <span>Status Summary (HEAD):</span>
            </label>
            <input
              type="text"
              value={statusSummary}
              onChange={(e) => setStatusSummary(e.target.value)}
              placeholder="e.g. Đấu Vương, đang trọng thương tại Hắc Giác Vực"
              className="w-full px-2.5 py-1 text-xs bg-cyber-900 border border-slate-700/80 focus:border-[#00f0ff] rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/50 transition-all font-mono"
            />
          </div>

          {/* Field 2: Active Conditions */}
          <div className="space-y-1">
            <label className="text-[10px] text-cyan-400 font-semibold uppercase flex items-center space-x-1">
              <Sliders size={11} />
              <span>Active Conditions / Buffs / Debuffs:</span>
            </label>
            <input
              type="text"
              value={activeConditions}
              onChange={(e) => setActiveConditions(e.target.value)}
              placeholder="e.g. Mất đấu khí tạm thời, bị truy nã, phong ấn kinh mạch"
              className="w-full px-2.5 py-1 text-xs bg-cyber-900 border border-slate-700/80 focus:border-[#00f0ff] rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/50 transition-all font-mono"
            />
          </div>

          {/* Field 3: Inventory or Active Traits */}
          <div className="space-y-1">
            <label className="text-[10px] text-cyan-400 font-semibold uppercase flex items-center space-x-1">
              <Package size={11} />
              <span>Current Inventory / Traits / Phenomena:</span>
            </label>
            <input
              type="text"
              value={inventoryOrTraits}
              onChange={(e) => setInventoryOrTraits(e.target.value)}
              placeholder="e.g. Dị hỏa: Thanh Liên Địa Tâm Hỏa, Dược Lão linh hồn hộ thể"
              className="w-full px-2.5 py-1 text-xs bg-cyber-900 border border-slate-700/80 focus:border-[#00f0ff] rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/50 transition-all font-mono"
            />
          </div>

          {/* Field 4: Rules Override */}
          <div className="space-y-1">
            <label className="text-[10px] text-amber-400 font-semibold uppercase flex items-center space-x-1">
              <ShieldAlert size={11} />
              <span>Immediate Rules Override (Priority Enforcement):</span>
            </label>
            <textarea
              rows={2}
              value={rulesOverride}
              onChange={(e) => setRulesOverride(e.target.value)}
              placeholder="Overrides or extends base canon rules for this entity (e.g. Tuyệt đối không thể dùng đấu khí trong 7 ngày tới)."
              className="w-full px-2.5 py-1 text-xs bg-cyber-900 border border-amber-500/30 focus:border-amber-400 rounded text-amber-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            {hasActiveMutation ? (
              <button
                type="button"
                onClick={handleRevert}
                disabled={isSaving}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 transition-all text-[11px]"
                title="Clear Live State and revert entity back to pure Base Canon"
              >
                <RotateCcw size={11} />
                <span>Revert Canon</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 italic">Pure base canon active</span>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 rounded text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-[#00f0ff] hover:bg-[#33f3ff] text-black font-bold text-[11px] shadow-[0_0_10px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check size={12} className="text-black" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Zap size={12} className="text-black" />
                    <span>{isSaving ? 'Saving...' : 'Save HEAD State'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
