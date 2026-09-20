import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Sparkles, ChevronDown, ChevronUp, Shield, Activity } from 'lucide-react';

function CharacterNodeComponent({ id, data, selected }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const latestProgression = data?.statusProgression?.[data.statusProgression.length - 1];

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-lg bg-cyber-950/95 border transition-all shadow-xl select-none ${
        selected
          ? 'border-cyan-400 shadow-glow-cyan ring-1 ring-cyan-400'
          : 'border-cyan-500/40 hover:border-cyan-400/80 hover:shadow-glow-cyan-sm'
      }`}
    >
      {/* Target & Source Handles for 4 directions */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-cyber-950" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-cyber-950" />

      {/* Header */}
      <div className="p-2.5 bg-gradient-to-r from-cyan-950/90 to-cyber-900 border-b border-cyan-500/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0">
            <User size={13} />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wide truncate">
              {data.name || 'Character Name'}
            </h4>
            <span className="text-[10px] text-cyan-400 font-mono block truncate">
              {data.role || 'Protagonist / Entity'}
            </span>
          </div>
        </div>

        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-mono shrink-0">
          Character
        </span>
      </div>

      {/* Main Body */}
      <div className="p-2.5 space-y-2 text-xs">
        {/* Realm / Cultivation / Level Pill */}
        <div className="flex items-center justify-between bg-cyber-900/90 p-1.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
            <Shield size={10} className="text-cyan-400" />
            <span>Realm / Tier:</span>
          </span>
          <span className="text-[11px] font-bold text-cyan-300 font-mono">
            {data.currentRealm || 'Base Mortal'}
          </span>
        </div>

        {/* Abilities tags */}
        {data.abilities && data.abilities.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">Abilities:</span>
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(data.abilities) ? data.abilities : [data.abilities]).slice(0, 3).map((ab, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-[9px] font-mono truncate max-w-[120px]"
                >
                  {ab}
                </span>
              ))}
              {(Array.isArray(data.abilities) ? data.abilities.length : 1) > 3 && (
                <span className="text-[9px] text-slate-500 font-mono">
                  +{(data.abilities.length - 3)} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Personality snapshot */}
        {data.personality && (
          <p className="text-[11px] text-slate-300 italic line-clamp-2 leading-relaxed bg-cyber-900/50 p-1.5 rounded border border-slate-850">
            "{data.personality}"
          </p>
        )}

        {/* Status Progression Drawer */}
        {data.statusProgression && data.statusProgression.length > 0 && (
          <div className="pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between text-[10px] text-cyan-400/90 hover:text-cyan-300 font-mono py-0.5"
            >
              <span className="flex items-center space-x-1">
                <Activity size={10} />
                <span>Progression ({data.statusProgression.length} stages)</span>
              </span>
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {isExpanded && (
              <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto pr-1">
                {data.statusProgression.map((prog, pIdx) => (
                  <div
                    key={prog.id || pIdx}
                    className="p-1 rounded bg-cyber-900 border border-slate-800 text-[9px] text-slate-300 font-mono"
                  >
                    <div className="flex items-center justify-between text-cyan-400 font-bold">
                      <span>v{prog.version || pIdx + 1}: {prog.realmOrLevel}</span>
                      <span className="text-slate-500 text-[8px]">{prog.timestampOrChapter || ''}</span>
                    </div>
                    <p className="text-slate-400 text-[9px] mt-0.5">{prog.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
