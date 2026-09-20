import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  User, 
  Zap, 
  MapPin, 
  Clock, 
  Plus, 
  Network, 
  RotateCcw, 
  Download, 
  Sparkles, 
  Layers, 
  Sliders, 
  Info,
  Maximize2
} from 'lucide-react';

import { CharacterNode } from './nodes/CharacterNode';
import { SystemNode } from './nodes/SystemNode';
import { LocationNode } from './nodes/LocationNode';
import { EventNode } from './nodes/EventNode';
import { RelationshipEdge } from './edges/RelationshipEdge';
import NodeInspector from './NodeInspector';
import GraphRagExportModal from './GraphRagExportModal';

// Node and Edge Types Mapping for React Flow
const nodeTypes = {
  character: CharacterNode,
  system: SystemNode,
  location: LocationNode,
  event: EventNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

// Default Seed Graph Template (Nova Aethel Universe)
const DEFAULT_SEED_NODES = [
  {
    id: 'char-kaelen',
    type: 'character',
    position: { x: 100, y: 150 },
    data: {
      name: 'Kaelen Vance',
      aliases: 'The Spire Weaver, Unit 404',
      role: 'Protagonist / Renegade Archivist',
      currentRealm: 'Stage-1 Flux Weaver',
      abilities: ['Obsidian Rapier Weaving', 'Biometric Flux Calibration', 'EM Gradient Sight'],
      personality: 'Pragmatic, calculating, emotionally guarded. Burdened by debt to Iron Synod; never surrenders sister data-core.',
      statusProgression: [
        {
          id: 'prog-1',
          version: '1',
          realmOrLevel: 'Archivist Cadet',
          description: 'Initial harmonic attunement with Nova Aethel lower conduit lattices.',
          timestampOrChapter: 'Year 2095'
        },
        {
          id: 'prog-2',
          version: '2',
          realmOrLevel: 'Stage-1 Flux Weaver',
          description: 'Sustained severe Flux Burn in left hand during conduit breach. Equipped with biometric stabilizing glove.',
          timestampOrChapter: 'Year 2099 - Sector 07 Collapse'
        }
      ],
      notes: 'Carries sister encrypted core in left cybernetic ocular sleeve.'
    }
  },
  {
    id: 'sys-aether',
    type: 'system',
    position: { x: 480, y: 50 },
    data: {
      systemName: 'Resonant Aether Weaving',
      type: 'Magic',
      resourceCost: 'Flux Burn cellular necrosis (optic nerves & fingertips)',
      formulaOrEquation: '\\Delta \\Phi = \\int_{0}^{t} \\omega(\\tau) d\\tau',
      rulesAndConstraints: [
        'RULE 1: Aether cannot be created from nothing; requires ambient resonant conductor.',
        'RULE 2: Overdrawing >3 consecutive patterns triggers acute Flux Burn necrosis.',
        'RULE 3: Cold iron dampens and disrupts resonant frequencies completely.'
      ],
      unlocks: ['Aetheric Blade Synthesis', 'Vocal Frequency Harmonics', 'Sub-grid Leeching']
    }
  },
  {
    id: 'loc-sector07',
    type: 'location',
    position: { x: 480, y: 350 },
    data: {
      name: 'Sector 07: The Drowned Conduits',
      environment: 'Subterranean flooded labyrinth with neon runoff',
      controllingFaction: 'The Iron Synod (Wardens of the Anvil)',
      resources: ['Runoff Aether', 'Discarded Cooling Fluids', 'Black-Market Ciphers'],
      hazards: 'Submerged open electrical circuits cause violent aetheric arc detonations. Visibility <15m.'
    }
  },
  {
    id: 'evt-collapse',
    type: 'event',
    position: { x: 100, y: 480 },
    data: {
      eventTitle: 'Sector 07 Conduit Collapse & Purge',
      timestampOrEpoch: 'Epoch 2099 - Cycle 4',
      participants: ['Kaelen Vance', 'Iron Synod Enforcers', 'Scrapper Clans'],
      outcome: 'Synod Wardens sealed lower tiers with resonant dampers, trapping rogue weavers.',
      consequences: 'Kaelen forced into indentured debt; cipher prices surged 300% across the under-grid.'
    }
  }
];

const DEFAULT_SEED_EDGES = [
  {
    id: 'e-kaelen-aether',
    source: 'char-kaelen',
    target: 'sys-aether',
    type: 'relationship',
    data: {
      relationshipType: 'REQUIRES_ELEMENT',
      label: 'REQUIRES_ELEMENT',
      description: 'Kaelen taps ambient aether through harmonic vocal focus to synthesize his rapier.'
    }
  },
  {
    id: 'e-kaelen-loc',
    source: 'char-kaelen',
    target: 'loc-sector07',
    type: 'relationship',
    data: {
      relationshipType: 'LOCATED_AT',
      label: 'LOCATED_AT',
      description: 'Operating in hiding beneath Sector 07 conduits.'
    }
  },
  {
    id: 'e-evt-kaelen',
    source: 'evt-collapse',
    target: 'char-kaelen',
    type: 'relationship',
    data: {
      relationshipType: 'CAUSES',
      label: 'CAUSES',
      description: 'The collapse inflicted stage-1 Flux Burn on Kaelen and locked his debt contract.'
    }
  },
  {
    id: 'e-evt-loc',
    source: 'evt-collapse',
    target: 'loc-sector07',
    type: 'relationship',
    data: {
      relationshipType: 'LOCATED_AT',
      label: 'LOCATED_AT',
      description: 'Occurred at the primary water-aether intersection in Sector 07.'
    }
  }
];

export default function WorldGraphCanvas({ activeBookId, activeBookTitle }) {
  const storageKey = `storycontainer_graph_book_${activeBookId || 'default'}`;

  // Load from LocalStorage if available
  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.length > 0) return parsed.nodes;
      }
    } catch (e) {}
    return DEFAULT_SEED_NODES;
  });

  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.edges) return parsed.edges;
      }
    } catch (e) {}
    return DEFAULT_SEED_EDGES;
  });

  // Selected elements for Inspector
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  // RAG Exporter Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Auto-save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }));
    } catch (e) {}
  }, [nodes, edges, storageKey]);

  // Connect handler
  const onConnect = useCallback((connection) => {
    const newEdge = {
      ...connection,
      id: `e_${connection.source}_${connection.target}_${Date.now()}`,
      type: 'relationship',
      data: {
        relationshipType: 'OWNS',
        label: 'OWNS',
        description: ''
      }
    };
    setEdges((eds) => addEdge(newEdge, eds));
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeId(null);
  }, [setEdges]);

  // Node selection handler
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  // Edge selection handler
  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  // Pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // Create new Node dynamically
  const handleAddNode = (category) => {
    const id = `${category}_${Date.now()}`;
    const x = 200 + Math.floor(Math.random() * 250);
    const y = 150 + Math.floor(Math.random() * 200);

    let defaultData = {};
    if (category === 'character') {
      defaultData = {
        name: 'New Character',
        role: 'Protagonist',
        currentRealm: 'Mortal Stage 1',
        abilities: ['Basic Technique'],
        personality: 'Determined and cautious.',
        statusProgression: [
          { id: 'prog-1', version: '1', realmOrLevel: 'Mortal Stage 1', description: 'Base state' }
        ]
      };
    } else if (category === 'system') {
      defaultData = {
        systemName: 'New Magic / Science System',
        type: 'Magic',
        resourceCost: 'Stamina toll',
        rulesAndConstraints: ['RULE 1: Must abide by conservation laws.'],
        unlocks: ['Basic Cast']
      };
    } else if (category === 'location') {
      defaultData = {
        name: 'New Location / Sector',
        environment: 'Temperate Frontier',
        controllingFaction: 'Independent',
        resources: ['Mineral ore']
      };
    } else if (category === 'event') {
      defaultData = {
        eventTitle: 'New Timeline Event',
        timestampOrEpoch: 'Epoch 1',
        participants: ['Character 1'],
        outcome: 'Event concluded.'
      };
    }

    const newNode = {
      id,
      type: category,
      position: { x, y },
      data: defaultData
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  // Update Node Data
  const handleUpdateNodeData = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
    );
  }, [setNodes]);

  // Update Edge Data
  const handleUpdateEdgeData = useCallback((edgeId, newEdgeData) => {
    setEdges((eds) =>
      eds.map((e) => (e.id === edgeId ? { ...e, data: newEdgeData, label: newEdgeData.label } : e))
    );
  }, [setEdges]);

  // Delete Node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  // Delete Edge
  const handleDeleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  }, [selectedEdgeId, setEdges]);

  // Reset to default template
  const handleResetTemplate = () => {
    if (window.confirm('Reset this world canvas to default seed template?')) {
      setNodes(DEFAULT_SEED_NODES);
      setEdges(DEFAULT_SEED_EDGES);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-950 overflow-hidden relative select-none">
      {/* Top Action Toolbar */}
      <div className="p-3 bg-cyber-900 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 z-10">
        {/* Left: World / Canvas Title & Node Creators */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 mr-2">
            <Network size={16} className="text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              World Graph // {activeBookTitle || 'Active World'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {/* Node Creation Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleAddNode('character')}
              className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 text-xs font-mono flex items-center space-x-1 transition-all"
              title="Add Character Node"
            >
              <User size={12} />
              <span>+ Character</span>
            </button>

            <button
              onClick={() => handleAddNode('system')}
              className="px-2.5 py-1 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900 text-xs font-mono flex items-center space-x-1 transition-all"
              title="Add Magic/Science System Node"
            >
              <Zap size={12} />
              <span>+ System</span>
            </button>

            <button
              onClick={() => handleAddNode('location')}
              className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 text-xs font-mono flex items-center space-x-1 transition-all"
              title="Add Location Node"
            >
              <MapPin size={12} />
              <span>+ Location</span>
            </button>

            <button
              onClick={() => handleAddNode('event')}
              className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 hover:bg-amber-900 text-xs font-mono flex items-center space-x-1 transition-all"
              title="Add Timeline / Event Node"
            >
              <Clock size={12} />
              <span>+ Event</span>
            </button>
          </div>
        </div>

        {/* Right: RAG Exporter & Reset Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetTemplate}
            className="p-1.5 rounded bg-cyber-850 hover:bg-cyber-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs"
            title="Reset Canvas Template"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs font-mono flex items-center space-x-1.5 shadow-glow-cyan-sm transition-all"
          >
            <Sparkles size={13} />
            <span>Export Graph RAG Context</span>
          </button>
        </div>
      </div>

      {/* Main Canvas & Inspector Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* React Flow Visual Canvas */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            fitView
            className="bg-cyber-950"
          >
            <Background color="#06b6d4" gap={20} size={1} opacity={0.12} />
            <Controls className="!bg-cyber-900 !border-slate-800 !text-slate-200 fill-slate-200" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'character') return '#06b6d4';
                if (n.type === 'system') return '#a855f7';
                if (n.type === 'location') return '#10b981';
                return '#f59e0b';
              }}
              className="!bg-cyber-950/90 !border-cyan-500/20"
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>

          {/* Quick Guidance Hint Overlay */}
          <div className="absolute bottom-4 left-4 bg-cyber-950/90 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 font-mono shadow-xl hidden md:block pointer-events-none z-10">
            <span className="text-cyan-400 font-bold block mb-0.5">Interaction Guide:</span>
            <span>• Drag dots to connect nodes with relationships.</span><br />
            <span>• Click any node/edge to open the polymorphic inspector.</span><br />
            <span>• Click "Export Graph RAG Context" to inject graph paths into LLM.</span>
          </div>
        </div>

        {/* Dynamic Node / Edge Inspector Drawer */}
        <NodeInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNodeData={handleUpdateNodeData}
          onUpdateEdgeData={handleUpdateEdgeData}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          allNodes={nodes}
        />
      </div>

      {/* Graph RAG Context Export Modal */}
      <GraphRagExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        nodes={nodes}
        edges={edges}
        initialSelectedNodeId={selectedNodeId || (nodes.length > 0 ? nodes[0].id : null)}
      />
    </div>
  );
}
