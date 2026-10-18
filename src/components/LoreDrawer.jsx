import React from 'react';
import { 
  X, 
  BookOpen, 
  ShieldAlert, 
  Layers, 
  ExternalLink, 
  Sparkles,
  ChevronRight,
  Activity
} from 'lucide-react';
import { ClientRAGService } from '../services/ragEngine';
import LiveStateDrawer from './LiveStateDrawer';

export default function LoreDrawer({ 
  isOpen, 
  onClose, 
  retrievedLore = [], 
  bookId = null,
  onLiveStateUpdated,
  onNavigateToLorebook 
}) {
  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 h-full border-l border-cyan-500/20 bg-cyber-900/95 backdrop-blur-md flex flex-col z-20 select-none shadow-2xl animate-fadeIn font-mono">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/15 flex items-center justify-between bg-cyber-950/60">
        <div className="flex items-center space-x-2">
          <BookOpen size={16} className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Retrieved Lore Context
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
            {retrievedLore.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyber-850"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <div className="px-4 py-2 bg-cyber-950/40 border-b border-slate-800 text-[11px] text-slate-400 leading-tight">
        These world invariants were automatically retrieved by the MySQL RAG Engine. You can modify emergent <span className="text-[#00f0ff] font-bold">Live States (HEAD)</span> on the fly below.
      </div>

      {/* Lore Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {retrievedLore.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 space-y-2">
            <Layers size={24} className="mx-auto text-slate-600 mb-2" />
            <p>No lore entries currently activated in this turn.</p>
            <p className="text-[11px] text-slate-600">
              Mention characters, locations, factions, or magic systems (e.g. Kaelen, Aether, Synod) in your prompt to trigger RAG injection.
            </p>
          </div>
        ) : (
          retrievedLore.map((item, idx) => {
            const categoryBadgeColor = ClientRAGService.getCategoryColor(item.category);
            const hasActiveLiveState = Boolean(
              item.liveState && (
                item.liveState.status_summary ||
                item.liveState.active_conditions ||
                item.liveState.inventory_or_traits ||
                item.liveState.rules_override
              )
            );

            return (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-lg glass-panel-subtle border transition-all space-y-2.5 text-xs ${
                  hasActiveLiveState
                    ? 'border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.12)] bg-cyber-950/60'
                    : 'border-cyan-500/20 hover:border-cyan-500/40'
                }`}
              >
                {/* Title & Category */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-100 text-xs tracking-wide">
                      {item.title}
                    </h4>
                    {item.aliases && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        aka: {Array.isArray(item.aliases) ? item.aliases.join(', ') : item.aliases}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] border font-semibold tracking-wider uppercase shrink-0 ${categoryBadgeColor}`}>
                    {item.category}
                  </span>
                </div>

                {/* Match reason badge */}
                {item.matchReason && (
                  <div className="text-[10px] text-cyan-400 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20 inline-block">
                    ⚡ {item.matchReason}
                  </div>
                )}

                {/* Live HEAD State Card Preview if active */}
                {hasActiveLiveState && (
                  <div className="p-2 rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-cyan-200 text-[11px] space-y-1">
                    <div className="flex items-center space-x-1.5 text-[#00f0ff] font-semibold text-[10px] uppercase tracking-wider">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]"></span>
                      </span>
                      <span>ACTIVE HEAD OVERLAY:</span>
                    </div>
                    {item.liveState.status_summary && (
                      <p className="text-[11px] text-[#00f0ff] font-mono">
                        • {item.liveState.status_summary}
                      </p>
                    )}
                    {item.liveState.active_conditions && (
                      <p className="text-[10px] text-cyan-300 font-mono">
                        • Buffs/Debuffs: {item.liveState.active_conditions}
                      </p>
                    )}
                    {item.liveState.inventory_or_traits && (
                      <p className="text-[10px] text-cyan-300 font-mono">
                        • Inventory: {item.liveState.inventory_or_traits}
                      </p>
                    )}
                  </div>
                )}

                {/* Rules Box */}
                {(item.rules || item.liveState?.rules_override) && (
                  <div className="p-2 rounded bg-amber-950/30 border border-amber-500/30 text-amber-200 text-[11px] space-y-1">
                    <div className="flex items-center space-x-1 text-amber-400 font-semibold text-[10px] uppercase tracking-wider">
                      <ShieldAlert size={12} />
                      <span>RULES & CONSTRAINTS:</span>
                    </div>
                    {item.liveState?.rules_override && (
                      <div className="text-[11px] font-mono text-amber-300 font-bold">
                        [OVERRIDE]: {item.liveState.rules_override}
                      </div>
                    )}
                    {item.rules && (
                      <div className="whitespace-pre-wrap font-mono leading-relaxed text-amber-100/80">
                        {item.rules}
                      </div>
                    )}
                  </div>
                )}

                {/* Content Box */}
                {item.content && (
                  <div className="text-slate-300 text-[11px] leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                    {item.content}
                  </div>
                )}

                {/* ⚡ Live State (HEAD) Quick-Toggle Drawer */}
                <div className="pt-2 border-t border-slate-800/80">
                  <LiveStateDrawer
                    bookId={item.book_id || bookId}
                    entry={item}
                    liveState={item.liveState}
                    onStateUpdated={(entryId, delta) => {
                      onLiveStateUpdated?.(entryId, delta);
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer link to Lorebook */}
      <div className="p-3 border-t border-cyan-500/15 bg-cyber-950/80">
        <button
          onClick={onNavigateToLorebook}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-semibold transition-all"
        >
          <span>Open Full Lorebook Database</span>
          <ExternalLink size={13} />
        </button>
      </div>
    </aside>
  );
}
