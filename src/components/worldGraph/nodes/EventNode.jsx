import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, Calendar, Users, Award, GitCommit } from 'lucide-react';

function EventNodeComponent({ id, data, selected }) {
  const participants = Array.isArray(data?.participants)
    ? data.participants
    : data?.participants ? [data.participants] : [];

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-lg bg-cyber-950/95 border transition-all shadow-xl select-none ${
        selected
          ? 'border-amber-400 shadow-glow-cyan ring-1 ring-amber-400'
          : 'border-amber-500/40 hover:border-amber-400/80 hover:shadow-glow-cyan-sm'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-cyber-950" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-cyber-950" />

      {/* Header */}
      <div className="p-2.5 bg-gradient-to-r from-amber-950/90 to-cyber-900 border-b border-amber-500/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-6 h-6 rounded bg-amber-950 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0">
            <Clock size={13} />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wide truncate">
              {data.eventTitle || 'Event Title'}
            </h4>
            <span className="text-[10px] text-amber-400 font-mono block truncate">
              {data.timestampOrEpoch || 'Epoch / Epoch 0'}
            </span>
          </div>
        </div>

        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-500/40 font-mono shrink-0">
          Timeline
        </span>
      </div>

      {/* Main Body */}
      <div className="p-2.5 space-y-2 text-xs">
        {/* Outcome summary */}
        {data.outcome && (
          <div className="bg-cyber-900/90 p-1.5 rounded border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1 mb-0.5">
              <Award size={10} className="text-amber-400" />
              <span>Outcome:</span>
            </span>
            <p className="text-[11px] text-slate-200 font-mono line-clamp-2 leading-relaxed">
              {data.outcome}
            </p>
          </div>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
              <Users size={10} className="text-amber-400" />
              <span>Participants:</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {participants.slice(0, 3).map((p, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/30 text-amber-200 text-[9px] font-mono truncate max-w-[120px]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Consequences */}
        {data.consequences && (
          <div className="bg-cyber-900/40 border border-slate-800 p-1.5 rounded text-[10px] text-slate-400">
            <span className="text-amber-400 font-bold block text-[9px]">Causal Aftermath:</span>
            <span className="line-clamp-2 leading-relaxed">{data.consequences}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const EventNode = memo(EventNodeComponent);
