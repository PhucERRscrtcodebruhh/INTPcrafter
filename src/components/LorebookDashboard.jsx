import React, { useState } from 'react';
import { 
  Database, 
  KeyRound, 
  Cpu, 
  Layers, 
  ArrowLeft 
} from 'lucide-react';
import LorebookManager from './LorebookManager';
import KeyPoolManager from './KeyPoolManager';
import InstructionEditor from './InstructionEditor';

export default function LorebookDashboard({ onBackToStudio }) {
  const [activeTab, setActiveTab] = useState('lore');

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-950 overflow-hidden">
      {/* Sub-Header Tabs */}
      <div className="border-b border-cyan-500/20 bg-cyber-900/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToStudio}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyber-950 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Chat Studio</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-800" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            System Config & Lore Matrix
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-cyber-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('lore')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              activeTab === 'lore'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={13} />
            <span>Lorebook Database</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              activeTab === 'keys'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={13} />
            <span>API Key Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('instruction')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              activeTab === 'instruction'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={13} />
            <span>Master Instruction</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'lore' && <LorebookManager />}
        {activeTab === 'keys' && <KeyPoolManager />}
        {activeTab === 'instruction' && <InstructionEditor />}
      </div>
    </div>
  );
}
