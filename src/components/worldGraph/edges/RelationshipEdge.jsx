import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

const RELATIONSHIP_COLORS = {
  MUTUAL_ENEMY: { stroke: '#f43f5e', bg: 'bg-rose-950/90', text: 'text-rose-300', border: 'border-rose-500/50' },
  CONTRADICTS: { stroke: '#f43f5e', bg: 'bg-rose-950/90', text: 'text-rose-300', border: 'border-rose-500/50' },
  OWNS: { stroke: '#f59e0b', bg: 'bg-amber-950/90', text: 'text-amber-300', border: 'border-amber-500/50' },
  CREATES: { stroke: '#f59e0b', bg: 'bg-amber-950/90', text: 'text-amber-300', border: 'border-amber-500/50' },
  UPGRADES_TO: { stroke: '#06b6d4', bg: 'bg-cyan-950/90', text: 'text-cyan-300', border: 'border-cyan-500/50' },
  CAUSES: { stroke: '#06b6d4', bg: 'bg-cyan-950/90', text: 'text-cyan-300', border: 'border-cyan-500/50' },
  REQUIRES_ELEMENT: { stroke: '#a855f7', bg: 'bg-purple-950/90', text: 'text-purple-300', border: 'border-purple-500/50' },
  SUB_SYSTEM_OF: { stroke: '#a855f7', bg: 'bg-purple-950/90', text: 'text-purple-300', border: 'border-purple-500/50' },
  LOCATED_AT: { stroke: '#10b981', bg: 'bg-emerald-950/90', text: 'text-emerald-300', border: 'border-emerald-500/50' },
  MEMBER_OF: { stroke: '#10b981', bg: 'bg-emerald-950/90', text: 'text-emerald-300', border: 'border-emerald-500/50' },
  ALLIED_WITH: { stroke: '#3b82f6', bg: 'bg-blue-950/90', text: 'text-blue-300', border: 'border-blue-500/50' },
  PARTICIPATES_IN: { stroke: '#eab308', bg: 'bg-yellow-950/90', text: 'text-yellow-300', border: 'border-yellow-500/50' },
  CUSTOM: { stroke: '#94a3b8', bg: 'bg-slate-900/90', text: 'text-slate-300', border: 'border-slate-700' }
};

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const relType = data?.relationshipType || 'OWNS';
  const label = data?.label || relType;
  const colors = RELATIONSHIP_COLORS[relType] || RELATIONSHIP_COLORS.CUSTOM;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#22d3ee' : colors.stroke,
          strokeWidth: selected ? 2.5 : 1.75,
          strokeDasharray: data?.bidirectional ? '4 4' : undefined,
          filter: selected ? 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' : 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-md transition-all cursor-pointer ${
              colors.bg
            } ${colors.text} ${colors.border} ${
              selected ? 'ring-2 ring-cyan-400 scale-110 shadow-glow-cyan-sm' : 'hover:scale-105'
            }`}
            title={data?.description ? `${label}: ${data.description}` : label}
          >
            {label}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
