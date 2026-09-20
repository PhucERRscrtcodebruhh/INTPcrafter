import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Cpu, Zap, Sparkles, BookOpen, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

function SystemNodeComponent({ id, data, selected }) {
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const rules = Array.isArray(data?.rulesAndConstraints)
    ? data.rulesAndConstraints
    : data?.rulesAndConstraints ? [data.rulesAndConstraints] : [];

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-lg bg-cyber-950/95 border transition-all shadow-xl select-none ${
        selected
          ? 'border-purple-400 shadow-glow-cyan ring-1 ring-purple-400'
          : 'border-purple-500/40 hover:border-purple-400/80 hover:shadow-glow-cyan-sm'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-cyber-950" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-cyber-950" />

      {/* Header */}
      <div className="p-2.5 bg-gradient-to-r from-purple-950/90 to-cyber-900 border-b border-purple-500/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-6 h-6 rounded bg-purple-950 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
            <Zap size={13} />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wide truncate">
              {data.systemName || 'System Name'}
            </h4>
            <span className="text-[10px] text-purple-400 font-mono block truncate">
              {data.type || 'Magic System'}
            </span>
          </div>
        </div>

        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-500/40 font-mono shrink-0">
          System
        </span>
      </div>

      {/* Main Body */}
      <div className="p-2.5 space-y-2 text-xs">
        {/* Resource Cost / Toll */}
        {data.resourceCost && (
          <div className="bg-cyber-900/90 p-1.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
              <Sparkles size={10} className="text-purple-400" />
              <span>Cost / Toll:</span>
            </span>
            <span className="text-[11px] font-bold text-purple-300 font-mono truncate max-w-[130px]">
              {data.resourceCost}
            </span>
          </div>
        )}

        {/* Formula / Equation if present */}
        {data.formulaOrEquation && (
          <div className="bg-cyber-900/60 p-1.5 rounded border border-purple-500/20 font-mono text-[10px] text-purple-200">
            <span className="text-slate-500 block text-[8px] uppercase">Invariant Formula:</span>
            ${data.formulaOrEquation}$
          </div>
        )}

        {/* Rules & Invariant Constraints List */}
        {rules.length > 0 && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="w-full flex items-center justify-between text-[10px] text-purple-300 hover:text-purple-200 font-mono"
            >
              <span className="flex items-center space-x-1">
                <AlertCircle size={10} className="text-purple-400" />
                <span>Deterministic Rules ({rules.length})</span>
              </span>
              {isRulesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {isRulesExpanded ? (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {rules.map((rule, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-1 rounded bg-cyber-900/80 border border-purple-500/20 text-[9px] text-purple-200 font-mono"
                  >
                    • {rule}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-mono truncate bg-cyber-900/40 p-1 rounded">
                • {rules[0]}
              </p>
            )}
          </div>
        )}

        {/* Granted Unlocks */}
        {data.unlocks && (Array.isArray(data.unlocks) ? data.unlocks.length > 0 : Boolean(data.unlocks)) && (
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">Unlocks:</span>
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(data.unlocks) ? data.unlocks : [data.unlocks]).slice(0, 3).map((un, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-500/30 text-purple-200 text-[9px] font-mono truncate max-w-[120px]"
                >
                  {un}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const SystemNode = memo(SystemNodeComponent);
