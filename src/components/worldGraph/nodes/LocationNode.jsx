import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MapPin, Globe, Flag, Layers, AlertTriangle } from 'lucide-react';

function LocationNodeComponent({ id, data, selected }) {
  const resources = Array.isArray(data?.resources)
    ? data.resources
    : data?.resources ? [data.resources] : [];

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-lg bg-cyber-950/95 border transition-all shadow-xl select-none ${
        selected
          ? 'border-emerald-400 shadow-glow-cyan ring-1 ring-emerald-400'
          : 'border-emerald-500/40 hover:border-emerald-400/80 hover:shadow-glow-cyan-sm'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-cyber-950" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-cyber-950" />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-cyber-950" />

      {/* Header */}
      <div className="p-2.5 bg-gradient-to-r from-emerald-950/90 to-cyber-900 border-b border-emerald-500/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
            <MapPin size={13} />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wide truncate">
              {data.name || 'Location Name'}
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono block truncate">
              {data.environment || 'Urban / Biome'}
            </span>
          </div>
        </div>

        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 font-mono shrink-0">
          Location
        </span>
      </div>

      {/* Main Body */}
      <div className="p-2.5 space-y-2 text-xs">
        {/* Controlling Faction */}
        <div className="bg-cyber-900/90 p-1.5 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
            <Flag size={10} className="text-emerald-400" />
            <span>Faction:</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-300 font-mono truncate max-w-[130px]">
            {data.controllingFaction || 'Unclaimed / Neutral'}
          </span>
        </div>

        {/* Resources */}
        {resources.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
              <Layers size={10} className="text-emerald-400" />
              <span>Key Resources:</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {resources.slice(0, 4).map((res, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-[9px] font-mono truncate max-w-[120px]"
                >
                  {res}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hazards */}
        {data.hazards && (
          <div className="bg-amber-950/30 border border-amber-500/20 p-1.5 rounded text-[10px] text-amber-200 flex items-start space-x-1">
            <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-relaxed">{data.hazards}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const LocationNode = memo(LocationNodeComponent);
