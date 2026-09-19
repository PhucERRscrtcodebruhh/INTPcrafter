import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_INSTRUCTION = `You are the StoryContainer Engine — a Deterministic World Simulator & Creative Writing Co-pilot operating under strict INTP cognitive architecture.

CORE SIMULATION LAWS:
1. DETERMINISTIC WORLD SIMULATION: Maintain absolute adherence to the established world rules, physical laws, magic constraints, and causality defined in the [WORLD KNOWLEDGE BASE CONTEXT].
2. ZERO CONTRADICTIONS: Never contradict established constraints, magic costs, character backstories, or physics laws. If a constraint prevents an action, portray the realistic failure or cost.
3. COGNITIVE NUANCE & ATMOSPHERE: Deliver evocative, immersive, and sensory-rich narrative prose. Character dialogue must reflect distinct worldviews, internal motives, and linguistic quirks.
4. CAUSAL CONSISTENCY: Every action has logical ripple effects. Magic systems exert physical or mental tolls. Factions act according to their self-interest and ideology.
5. RESPECT RETRIEVED LORE: If lore entries are activated in the context block below, treat them as immutable historical facts and cosmological constants of the story universe.
6. INTP COGNITIVE TRACE (<thinking>):
Before generating the canonical narrative text, you MUST output your internal reasoning inside a <thinking>...</thinking> block:
- Rule & Logic Verification: Check against active constraints in [WORLD KNOWLEDGE BASE CONTEXT].
- Causal & Mathematical Equations: Formulate physical/magic constraints using standard LaTeX ($...$ inline or $$...$$ block) where relevant.
- Tactical & Continuity Analysis: Evaluate character psychology and consequence pathways.
After closing </thinking>, provide your vivid story narrative.`;

export default function InstructionEditor() {
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInstruction();
  }, []);

  const loadInstruction = async () => {
    setIsLoading(true);
    try {
      const res = await api.getInstruction();
      setInstruction(res.instruction || DEFAULT_INSTRUCTION);
    } catch (err) {
      setError('Failed to load instruction: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.updateInstruction(instruction);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset Master System Instruction to default INTP World Simulator standard?')) {
      setInstruction(DEFAULT_INSTRUCTION);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 space-y-4 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Cpu size={16} />
            <span>Master System Instruction Matrix</span>
          </h2>
          <p className="text-xs text-slate-400">
            Governs the cognitive constraints, narrative voice, and deterministic causality of the AI simulation model.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset Default</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 shadow-glow-cyan-sm transition-all"
          >
            {savedSuccess ? (
              <>
                <Check size={14} className="text-black" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>{isSaving ? 'Saving...' : 'Save Instruction'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Editor Box */}
      <div className="flex-1 flex flex-col glass-panel rounded-lg border border-cyan-500/20 overflow-hidden">
        <div className="p-2.5 bg-cyber-950/80 border-b border-cyan-500/15 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-cyan-300">system_configs.master_system_instruction</span>
          <span className="font-mono text-[11px] text-slate-500">
            {instruction.length} chars | ~{Math.ceil(instruction.length / 4)} tokens
          </span>
        </div>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isLoading}
          placeholder="Enter world simulator master instructions..."
          className="flex-1 w-full bg-cyber-950/40 p-4 font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none focus:bg-cyber-950/70 select-text"
        />
      </div>

      <div className="text-[11px] text-slate-500 flex items-center space-x-1">
        <ShieldCheck size={12} className="text-cyan-400" />
        <span>
          Note: This instruction is prepended to every generation turn, followed by dynamically retrieved [WORLD KNOWLEDGE BASE CONTEXT] from your Lorebook.
        </span>
      </div>
    </div>
  );
}
