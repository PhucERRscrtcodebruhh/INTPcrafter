import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Cpu,
  BookOpen,
  Info
} from 'lucide-react';
import { api } from '../services/api';

const WORLD_TEMPLATES = [
  {
    name: 'Cyberpunk Hard Sci-Fi',
    instruction: `WORLD PROTOCOL: CYBERPUNK DETERMINISTIC REALITY
1. TECHNOLOGY & HARDWARE: All augmentations require power sources, cooling mechanisms, and neural interfaces. EMP blasts disable unsheilded cybernetics.
2. CORPORATE HEGEMONY: Megacorporations control bandwidth, life-support, and private law enforcement. Information is currency.
3. INTP TONE: Gritty, sensory-rich, calculating, anti-sentimental, focused on technical mechanics and systemic causality.`
  },
  {
    name: 'Eastern Xianxia Cultivation',
    instruction: `WORLD PROTOCOL: TU TIÊN THẾ GIỚI (DAOIST CULTIVATION)
1. CULTIVATION REALMS & QI: Qi absorption follows spiritual root affinity. Breakthroughs require celestial tribulation and risk Qi deviation (Tẩu hỏa nhập ma).
2. KARMA & CAUSALITY: Every life taken incurs karmic tether. Heavenly Dao enforces balance with zero emotional bias.
3. INTP TONE: Analytical deconstruction of traditional cultivation tropes, mathematical Qi dynamics, strategic cultivation economics.`
  },
  {
    name: 'Grimdark High Fantasy',
    instruction: `WORLD PROTOCOL: GRIMDARK DETERMINISTIC FANTASY
1. MAGIC COSTS BLOOD: Magic cannot generate ex-nihilo matter. Channeling arcane flux causes physical rot or psychological dissociation.
2. COMBAT REALISM: Armor degrades; fatigue impairs reaction speed; injuries require realistic medical care or fester.
3. INTP TONE: Visceral, morally gray, geopolitical realism, unsparing depiction of cause-and-effect.`
  }
];

export default function WorldInstructionEditor({ book, onBookUpdated }) {
  const [instruction, setInstruction] = useState(book?.system_instruction || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setInstruction(book?.system_instruction || '');
  }, [book?.id, book?.system_instruction]);

  const handleSave = async () => {
    if (!book?.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.updateBook(book.id, {
        system_instruction: instruction
      });
      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        onBookUpdated?.({ ...book, system_instruction: instruction });
      }
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = (tmpl) => {
    if (instruction.trim() && !window.confirm(`Overwrite current world instructions with "${tmpl.name}" template?`)) {
      return;
    }
    setInstruction(tmpl.instruction);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 space-y-4 select-none font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Cpu size={16} />
            <span>World Master Instruction — {book?.title}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Dedicated narrative constraints, behavioral protocols, and prohibited tropes tied solely to this World container.
          </p>
        </div>

        <div className="flex items-center space-x-2">
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
                <span>{isSaving ? 'Saving...' : 'Save World Instruction'}</span>
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

      {/* Preset Template Quick-Inject */}
      <div className="flex items-center space-x-2 text-xs text-slate-400 overflow-x-auto pb-1">
        <span className="flex items-center space-x-1 text-cyan-300">
          <Sparkles size={13} />
          <span>Quick Templates:</span>
        </span>
        {WORLD_TEMPLATES.map(tmpl => (
          <button
            key={tmpl.name}
            onClick={() => handleApplyTemplate(tmpl)}
            className="px-2.5 py-1 rounded bg-cyber-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-[11px] whitespace-nowrap transition-colors"
          >
            {tmpl.name}
          </button>
        ))}
      </div>

      {/* Editor Box */}
      <div className="flex-1 flex flex-col glass-panel rounded-lg border border-cyan-500/20 overflow-hidden">
        <div className="p-2.5 bg-cyber-950/80 border-b border-cyan-500/15 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-cyan-300">lore_books.system_instruction [ID: {book?.id}]</span>
          <span className="font-mono text-[11px] text-slate-500">
            {instruction.length} chars | ~{Math.ceil(instruction.length / 4)} tokens
          </span>
        </div>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={`Define World-level instructions for "${book?.title}" (e.g., world narrative perspective, tone, forbidden clichés, output format)...`}
          className="flex-1 w-full bg-cyber-950/40 p-4 font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none focus:bg-cyber-950/70 select-text"
        />
      </div>

      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
        <Info size={13} className="text-cyan-400 shrink-0" />
        <span>
          Whenever a Chat Session links to <strong>{book?.title}</strong>, this instruction is dynamically merged into the AI prompt alongside the Global System Instruction and retrieved Lorebook context.
        </span>
      </div>
    </div>
  );
}
