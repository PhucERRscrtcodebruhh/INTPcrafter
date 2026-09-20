import React, { useState, useMemo } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Layers, 
  BrainCircuit, 
  Sparkles, 
  Network, 
  Sliders, 
  Code2, 
  FileText,
  Zap
} from 'lucide-react';
import { buildNodeContextGraph, getNodeTitle } from '../../utils/graphRagExporter';
import { formatTokenCount } from '../../services/tokenEstimator';

export default function GraphRagExportModal({
  isOpen,
  onClose,
  nodes = [],
  edges = [],
  initialSelectedNodeId = null
}) {
  if (!isOpen) return null;

  const [selectedRootId, setSelectedRootId] = useState(
    initialSelectedNodeId || (nodes.length > 0 ? nodes[0].id : '')
  );
  const [maxDepth, setMaxDepth] = useState(2);
  const [viewMode, setViewMode] = useState('markdown'); // 'markdown' | 'json'
  const [isCopied, setIsCopied] = useState(false);

  // Compute graph RAG context dynamically
  const ragContext = useMemo(() => {
    return buildNodeContextGraph(nodes, edges, selectedRootId, maxDepth);
  }, [nodes, edges, selectedRootId, maxDepth]);

  const handleCopy = () => {
    const textToCopy = viewMode === 'markdown' 
      ? ragContext.structuredMarkdown 
      : JSON.stringify(ragContext.jsonGraph, null, 2);
    
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const isMd = viewMode === 'markdown';
    const content = isMd ? ragContext.structuredMarkdown : JSON.stringify(ragContext.jsonGraph, null, 2);
    const filename = `graph_rag_${selectedRootId || 'context'}_depth${maxDepth}.${isMd ? 'md' : 'json'}`;
    const blob = new Blob([content], { type: isMd ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="max-w-4xl w-full max-h-[90vh] bg-cyber-950 border border-cyan-500/30 rounded-xl flex flex-col shadow-glow-cyan overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-cyber-900 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow-cyan-sm">
              <Network size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center space-x-2">
                <span>Graph-Based RAG Context Exporter</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Multi-hop deterministic knowledge graph traversal for zero-contradiction LLM prompts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-cyber-800 text-slate-400 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="p-4 bg-cyber-950/80 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Root Node Selector */}
          <div>
            <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
              Focus Entity (Root Node)
            </label>
            <select
              value={selectedRootId}
              onChange={(e) => setSelectedRootId(e.target.value)}
              className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  [{n.type.toUpperCase()}] {getNodeTitle(n)}
                </option>
              ))}
            </select>
          </div>

          {/* Depth Slider */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="text-purple-400 uppercase tracking-wider flex items-center space-x-1">
                <Sliders size={11} />
                <span>Traversal Depth: {maxDepth} Hops</span>
              </span>
              <span className="text-slate-500">
                {maxDepth === 1 ? 'Direct only' : maxDepth === 2 ? 'Recommended' : 'Broad Subgraph'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 bg-cyber-900 h-1.5 rounded cursor-pointer"
            />
          </div>

          {/* Quick Stats Banner */}
          <div className="bg-cyber-900/90 rounded border border-cyan-500/20 p-2 flex items-center justify-around font-mono text-[11px]">
            <div className="text-center">
              <span className="text-slate-500 block text-[9px] uppercase">Entities</span>
              <span className="text-cyan-300 font-bold">{ragContext.totalNodesIncluded}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-slate-500 block text-[9px] uppercase">Interlinks</span>
              <span className="text-purple-300 font-bold">{ragContext.totalEdgesIncluded}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-slate-500 block text-[9px] uppercase">Est. Tokens</span>
              <span className="text-emerald-300 font-bold">{formatTokenCount(ragContext.estimatedTokens)}</span>
            </div>
          </div>
        </div>

        {/* View Mode Tabs & Action Bar */}
        <div className="px-4 py-2 bg-cyber-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setViewMode('markdown')}
              className={`px-3 py-1 rounded font-mono text-[11px] flex items-center space-x-1.5 transition-colors ${
                viewMode === 'markdown'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={12} />
              <span>Deterministic Markdown Prompt</span>
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1 rounded font-mono text-[11px] flex items-center space-x-1.5 transition-colors ${
                viewMode === 'json'
                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 size={12} />
              <span>Graph JSON Structure</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-[11px] font-mono flex items-center space-x-1 transition-colors"
            >
              <Download size={12} />
              <span>Export File</span>
            </button>
            <button
              onClick={handleCopy}
              className="px-3.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-[11px] font-mono flex items-center space-x-1 shadow-glow-cyan-sm transition-all"
            >
              {isCopied ? <Check size={13} className="text-black" /> : <Copy size={13} />}
              <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Context'}</span>
            </button>
          </div>
        </div>

        {/* Content Preview Box */}
        <div className="flex-1 p-4 overflow-y-auto bg-cyber-950 font-mono text-xs text-slate-200 select-text leading-relaxed">
          <pre className="whitespace-pre-wrap font-mono p-4 rounded-lg bg-cyber-900/60 border border-slate-800 text-[11px] text-slate-300">
            {viewMode === 'markdown' ? ragContext.structuredMarkdown : JSON.stringify(ragContext.jsonGraph, null, 2)}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-cyber-900 border-t border-cyan-500/20 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-1.5 text-cyan-400">
            <Zap size={13} />
            <span>Ready for prompt injection into &lt;thinking&gt; RAG context window</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-cyber-850 hover:bg-cyber-800 text-slate-300 text-xs font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
