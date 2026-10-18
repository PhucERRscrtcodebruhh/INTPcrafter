import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Save, 
  Sliders, 
  Cpu, 
  Layers, 
  Search, 
  Globe, 
  Sparkles, 
  Trash2, 
  Check, 
  Tag, 
  Plus, 
  ShieldAlert,
  SlidersHorizontal,
  Zap,
  Info
} from 'lucide-react';
import { useSettingsStore, BUILTIN_PRESETS } from '../../store/useSettingsStore';
import { resolveModelCapabilities } from '../../config/modelRegistry';

export default function ParameterSettingsModal({
  isOpen,
  onClose,
  model = 'gemini-3.8-flash',
  provider = 'gemini'
}) {
  const {
    parameters,
    updateParameter,
    updateParameters,
    resetToDefaults,
    activePreset,
    customPresets,
    applyPreset,
    savePreset,
    deletePreset,
  } = useSettingsStore();

  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [stopInput, setStopInput] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const schema = resolveModelCapabilities(provider, model);
  const maxOutputCap = schema.maxOutputTokensCap || 16384;

  const handleAddStopSequence = (e) => {
    e?.preventDefault();
    if (!stopInput.trim()) return;
    const clean = stopInput.trim();
    const current = parameters.stopSequences || [];
    if (!current.includes(clean)) {
      updateParameter('stopSequences', [...current, clean]);
    }
    setStopInput('');
  };

  const handleRemoveStopSequence = (seq) => {
    const current = parameters.stopSequences || [];
    updateParameter('stopSequences', current.filter((s) => s !== seq));
  };

  const handleSavePresetSubmit = (e) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName('');
      setIsSavingPreset(false);
    }
  };

  // Stepped slider mapping for Thinking Level
  const thinkingLevels = ['auto', 'low', 'medium', 'high'];
  const currentLevelIndex = thinkingLevels.indexOf(parameters.thinkingLevel || 'auto');

  // Stepped slider mapping for Reasoning Effort
  const reasoningEfforts = ['auto', 'low', 'medium', 'high'];
  const currentEffortIndex = reasoningEfforts.indexOf(parameters.reasoningEffort || 'auto');

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm select-none font-mono animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl h-full bg-[#020617] text-slate-200 border-l border-cyan-500/30 flex flex-col shadow-2xl overflow-hidden animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="p-4 border-b border-cyan-500/20 bg-[#020617]/95 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.25)]">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                  LLM Parameter Cockpit
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-[#00f0ff]/40 text-[#00f0ff] font-bold">
                  {schema.provider === 'google' ? 'Google GenAI' : 'OpenAI Compatible'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans flex items-center gap-1.5 mt-0.5">
                Target Model: <span className="text-cyan-300 font-mono font-semibold">{model}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={resetToDefaults}
              title="Reset parameters to defaults"
              className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 flex items-center space-x-1 transition-all"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Close Cockpit (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preset Selector & Manager Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Preset:</span>
            <select
              value={activePreset}
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-slate-900 text-cyan-300 text-xs border border-cyan-500/30 rounded px-2.5 py-1 font-mono focus:outline-none focus:border-[#00f0ff]"
            >
              <optgroup label="Built-in Presets">
                {BUILTIN_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              {customPresets.length > 0 && (
                <optgroup label="User Custom Presets">
                  {customPresets.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {activePreset === 'Custom' && <option value="Custom">Custom (Unsaved)</option>}
            </select>

            {customPresets.some((p) => p.name === activePreset) && (
              <button
                type="button"
                onClick={() => deletePreset(activePreset)}
                className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40"
                title="Delete current custom preset"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!isSavingPreset ? (
              <button
                type="button"
                onClick={() => setIsSavingPreset(true)}
                className="px-2.5 py-1 rounded text-xs bg-cyan-950/60 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-cyan-900/50 flex items-center space-x-1 transition-all"
              >
                <Save size={12} />
                <span>Save Preset</span>
              </button>
            ) : (
              <form onSubmit={handleSavePresetSubmit} className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="bg-slate-900 border border-cyan-400/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-32"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 rounded bg-[#00f0ff] text-slate-950 font-bold hover:bg-cyan-300"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(false)}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Scrollable Cockpit Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
          
          {/* SECTION 1: SAMPLING CONTROLS */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Zap size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  1. Sampling & Diversity
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Universal Entropy</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Temperature Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Temperature:</span>
                  <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                    {parameters.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={parameters.temperature}
                  onChange={(e) => updateParameter('temperature', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0 (Deterministic)</span>
                  <span>1.0</span>
                  <span>2.0 (High Chaos)</span>
                </div>
              </div>

              {/* Top P Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Top P (Nucleus):</span>
                  <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                    {parameters.topP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={parameters.topP}
                  onChange={(e) => updateParameter('topP', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0 (Tight)</span>
                  <span>0.95</span>
                  <span>1.0 (Full Distribution)</span>
                </div>
              </div>

              {/* Conditional Top K for Google */}
              {schema.supportsTopK && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold">Top K (Google GenAI):</span>
                    <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                      {parameters.topK}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="64"
                    step="1"
                    value={parameters.topK}
                    onChange={(e) => updateParameter('topK', parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1 (Narrow)</span>
                    <span>40 (Default)</span>
                    <span>64 (Max)</span>
                  </div>
                </div>
              )}

              {/* Conditional Penalties for OpenAI Compatible */}
              {schema.supportsPenalties && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">Frequency Penalty:</span>
                      <span className="text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/30">
                        {parameters.frequencyPenalty.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-2.0"
                      max="2.0"
                      step="0.1"
                      value={parameters.frequencyPenalty}
                      onChange={(e) => updateParameter('frequencyPenalty', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>-2.0</span>
                      <span>0.0 (Neutral)</span>
                      <span>+2.0 (Reduce repetition)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">Presence Penalty:</span>
                      <span className="text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/30">
                        {parameters.presencePenalty.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-2.0"
                      max="2.0"
                      step="0.1"
                      value={parameters.presencePenalty}
                      onChange={(e) => updateParameter('presencePenalty', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>-2.0</span>
                      <span>0.0 (Neutral)</span>
                      <span>+2.0 (Encourage new topics)</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* SECTION 2: LIMITS & STOP SEQUENCES */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Layers size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  2. Token Limits & Stop Sequences
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Capped at {maxOutputCap.toLocaleString()} tokens</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Max Output Tokens */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Max Output Tokens:</span>
                  <input
                    type="number"
                    min="256"
                    max={maxOutputCap}
                    step="256"
                    value={parameters.maxOutputTokens}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 256;
                      updateParameter('maxOutputTokens', Math.min(val, maxOutputCap));
                    }}
                    className="w-24 bg-slate-900 border border-cyan-500/30 rounded px-1.5 py-0.5 text-right text-cyan-300 font-bold focus:outline-none"
                  />
                </div>
                <input
                  type="range"
                  min="256"
                  max={maxOutputCap}
                  step="256"
                  value={parameters.maxOutputTokens}
                  onChange={(e) => updateParameter('maxOutputTokens', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>256</span>
                  <span>4,096</span>
                  <span>{maxOutputCap.toLocaleString()}</span>
                </div>
              </div>

              {/* Max Context Tokens (Rolling Pruner Cap) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Max Context Window Cap:</span>
                  <span className="text-cyan-300 font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                    {(parameters.maxContextTokens || 32768).toLocaleString()} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min="4096"
                  max="524288"
                  step="4096"
                  value={parameters.maxContextTokens || 32768}
                  onChange={(e) => updateParameter('maxContextTokens', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>4k</span>
                  <span>32k (Chronicle default)</span>
                  <span>512k</span>
                </div>
              </div>
            </div>

            {/* Stop Sequences Tag Input */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-semibold text-slate-300 block">
                Stop Sequences (Generation terminates on encounter):
              </label>
              
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {(parameters.stopSequences || []).map((seq, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs"
                  >
                    <Tag size={10} />
                    <span>{JSON.stringify(seq)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStopSequence(seq)}
                      className="hover:text-rose-400 p-0.5"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {(parameters.stopSequences || []).length === 0 && (
                  <span className="text-[11px] text-slate-600 italic">No stop sequences configured.</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="e.g. ###, [END], <|im_end|>"
                  value={stopInput}
                  onChange={(e) => setStopInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStopSequence();
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00f0ff]"
                />
                <button
                  type="button"
                  onClick={handleAddStopSequence}
                  className="px-3 py-1 rounded-lg bg-cyan-950 border border-[#00f0ff]/40 text-[#00f0ff] hover:bg-cyan-900/60 flex items-center space-x-1"
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: REASONING & EXTENDED THINKING */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Cpu size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  3. Reasoning & Extended Thinking
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                Type: {schema.reasoningType}
              </span>
            </div>

            {/* Sub-variant A: Gemini 3.x (google-level) */}
            {schema.reasoningType === 'google-level' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                  <div>
                    <span className="font-semibold text-slate-200 block">Thinking Toggle</span>
                    <span className="text-[10px] text-slate-400">Enable Gemini 3.x internal reasoning process</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.thinkingEnabled}
                      onChange={(e) => updateParameter('thinkingEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                  </label>
                </div>

                {parameters.thinkingEnabled && (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">Thinking Level:</span>
                      <span className="text-[#00f0ff] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                        {parameters.thinkingLevel}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={currentLevelIndex >= 0 ? currentLevelIndex : 0}
                      onChange={(e) => updateParameter('thinkingLevel', thinkingLevels[parseInt(e.target.value, 10)])}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                    />

                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
                      {thinkingLevels.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => updateParameter('thinkingLevel', lvl)}
                          className={`uppercase px-2 py-0.5 rounded ${
                            parameters.thinkingLevel === lvl
                              ? 'text-[#00f0ff] bg-cyan-950 border border-cyan-500/40 font-bold'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-variant B: Gemini 2.5 (google-budget) */}
            {schema.reasoningType === 'google-budget' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                  <div>
                    <span className="font-semibold text-slate-200 block">Thinking Toggle</span>
                    <span className="text-[10px] text-slate-400">Enable Gemini 2.5 token-budgeted reasoning</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.thinkingEnabled}
                      onChange={(e) => updateParameter('thinkingEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                  </label>
                </div>

                {parameters.thinkingEnabled && (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">Thinking Budget:</span>
                      <span className="text-[#00f0ff] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                        {parameters.thinkingBudget === -1 ? 'AUTO (-1)' : `${parameters.thinkingBudget} tokens`}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateParameter('thinkingBudget', -1)}
                        className={`flex-1 py-1 rounded text-xs border ${
                          parameters.thinkingBudget === -1
                            ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        Auto (-1)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateParameter('thinkingBudget', 0)}
                        className={`flex-1 py-1 rounded text-xs border ${
                          parameters.thinkingBudget === 0
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        Off (0)
                      </button>
                      {[2048, 4096, 8192].map((budget) => (
                        <button
                          key={budget}
                          type="button"
                          onClick={() => updateParameter('thinkingBudget', budget)}
                          className={`flex-1 py-1 rounded text-xs border ${
                            parameters.thinkingBudget === budget
                              ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] font-bold'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {budget}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="65535"
                      step="512"
                      value={parameters.thinkingBudget === -1 ? 0 : parameters.thinkingBudget}
                      onChange={(e) => updateParameter('thinkingBudget', parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff] mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Sub-variant C: OpenAI / DeepSeek Reasoning (openai-effort) */}
            {schema.reasoningType === 'openai-effort' && (
              <div className="space-y-3 pt-1">
                {/* Reasoning Effort Stepped Slider */}
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold">Reasoning Effort:</span>
                    <span className="text-amber-400 uppercase font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40">
                      {parameters.reasoningEffort}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={currentEffortIndex >= 0 ? currentEffortIndex : 0}
                    onChange={(e) => updateParameter('reasoningEffort', reasoningEfforts[parseInt(e.target.value, 10)])}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
                    {reasoningEfforts.map((effort) => (
                      <button
                        key={effort}
                        type="button"
                        onClick={() => updateParameter('reasoningEffort', effort)}
                        className={`uppercase px-2 py-0.5 rounded ${
                          parameters.reasoningEffort === effort
                            ? 'text-amber-300 bg-amber-950 border border-amber-500/40 font-bold'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {effort}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Radio Buttons for Reasoning Summary & Mode */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      Reasoning Summary:
                    </span>
                    <div className="flex gap-2">
                      {['unset', 'enabled', 'disabled'].map((val) => (
                        <label key={val} className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            name="reasoningSummary"
                            value={val}
                            checked={parameters.reasoningSummary === val}
                            onChange={() => updateParameter('reasoningSummary', val)}
                            className="accent-amber-400"
                          />
                          <span className={`text-[10px] ${parameters.reasoningSummary === val ? 'text-amber-300 font-bold' : 'text-slate-400'}`}>
                            {val}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      Reasoning Mode:
                    </span>
                    <div className="flex gap-2">
                      {['unset', 'parsed', 'raw'].map((val) => (
                        <label key={val} className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            name="reasoningMode"
                            value={val}
                            checked={parameters.reasoningMode === val}
                            onChange={() => updateParameter('reasoningMode', val)}
                            className="accent-amber-400"
                          />
                          <span className={`text-[10px] ${parameters.reasoningMode === val ? 'text-amber-300 font-bold' : 'text-slate-400'}`}>
                            {val}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-variant D: None */}
            {schema.reasoningType === 'none' && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center space-x-2 text-slate-500">
                <Info size={16} className="shrink-0 text-slate-600" />
                <span className="text-[11px]">
                  Reasoning / Thinking controls are not applicable for this model variant.
                </span>
              </div>
            )}
          </div>

          {/* SECTION 4: CONTEXT & TOOLS */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Globe size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  4. Context, Grounding & Transport
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Tool Bindings</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Google Search Grounding */}
              {schema.supportsGroundingSearch && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200 block">Grounding with Google Search</span>
                    <span className="text-[10px] text-slate-400">Attach real-time web search results to the generation</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.groundingWithGoogleSearch}
                      onChange={(e) => updateParameter('groundingWithGoogleSearch', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                  </label>
                </div>
              )}

              {/* URL Context */}
              {schema.supportsUrlContext && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200 block">URL Context Fetching</span>
                    <span className="text-[10px] text-slate-400">Allow model to pull full page contents from links in prompt</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.urlContext}
                      onChange={(e) => updateParameter('urlContext', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                  </label>
                </div>
              )}

              {/* Resend Files */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">Resend Files</span>
                  <span className="text-[10px] text-slate-400">Preserve multimodal attachments across conversation turns</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parameters.resendFiles}
                    onChange={(e) => updateParameter('resendFiles', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                </label>
              </div>

              {/* Disable Streaming */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">Disable Streaming</span>
                  <span className="text-[10px] text-slate-400">Receive single complete response block (blocking HTTP POST)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parameters.disableStreaming}
                    onChange={(e) => updateParameter('disableStreaming', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-cyan-500/20 bg-[#020617] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Active Schema: <span className="text-[#00f0ff] font-bold">{schema.provider}</span> | Max Cap: <span className="text-cyan-300 font-bold">{maxOutputCap.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold hover:brightness-110 shadow-glow-cyan-sm transition-all text-xs"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
