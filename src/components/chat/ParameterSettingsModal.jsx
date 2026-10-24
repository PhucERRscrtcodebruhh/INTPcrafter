import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Save, 
  Sliders, 
  Cpu, 
  Layers, 
  Globe, 
  Sparkles, 
  Trash2, 
  Check, 
  Tag, 
  Plus, 
  ShieldAlert,
  Zap,
  Info
} from 'lucide-react';
import { useSettingsStore, BUILTIN_PRESETS, DEFAULT_SAFETY_SETTINGS } from '../../store/useSettingsStore';
import { resolveModelCapabilities } from '../../config/modelRegistry';

const GOOGLE_SAFETY_CATEGORIES = [
  { id: 'HARM_CATEGORY_HATE_SPEECH', label: 'Hate Speech' },
  { id: 'HARM_CATEGORY_HARASSMENT', label: 'Harassment' },
  { id: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', label: 'Sexually Explicit' },
  { id: 'HARM_CATEGORY_DANGEROUS_CONTENT', label: 'Dangerous Content' },
  { id: 'HARM_CATEGORY_CIVIC_INTEGRITY', label: 'Civic Integrity' },
];

const GOOGLE_SAFETY_THRESHOLDS = [
  { value: 'OFF', label: 'Off (OFF)' },
  { value: 'BLOCK_NONE', label: 'Block None (BLOCK_NONE)' },
  { value: 'BLOCK_ONLY_HIGH', label: 'Block Few (BLOCK_ONLY_HIGH)' },
  { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Block Some (BLOCK_MEDIUM_AND_ABOVE)' },
  { value: 'BLOCK_LOW_AND_ABOVE', label: 'Block Most (BLOCK_LOW_AND_ABOVE)' },
];

export default function ParameterSettingsModal({
  isOpen,
  onClose,
  model = 'gemini-3.8-flash',
  provider = 'gemini'
}) {
  const {
    parameters,
    updateParameter,
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
  const isGoogle = schema.provider === 'google';
  const supportsGoogleThinking = isGoogle && schema.reasoningType !== 'none';

  // Getters that fallback gracefully between OpenAI and Google keys
  const getTemperature = () => parameters.temperature ?? (isGoogle ? 1.0 : 0.7);
  const getTopP = () => isGoogle
    ? (parameters.topP ?? 0.95)
    : (parameters.top_p ?? parameters.topP ?? 0.95);
  const getMaxTokens = () => isGoogle
    ? (parameters.maxOutputTokens || 8192)
    : (parameters.max_completion_tokens || parameters.max_tokens || parameters.maxOutputTokens || 2048);
  const getPresencePenalty = () => Number(parameters.presence_penalty ?? parameters.presencePenalty ?? 0.0);
  const getFrequencyPenalty = () => Number(parameters.frequency_penalty ?? parameters.frequencyPenalty ?? 0.0);

  const handleParamChange = (key, value) => {
    if (!isGoogle) {
      // Map to standard OpenAI payload layout properties
      if (key === 'maxOutputTokens') key = 'max_completion_tokens';
      if (key === 'topP') key = 'top_p';
      if (key === 'presencePenalty') key = 'presence_penalty';
      if (key === 'frequencyPenalty') key = 'frequency_penalty';
    }
    updateParameter(key, value);
  };

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

  const currentSafetySettings = Array.isArray(parameters.safetySettings) && parameters.safetySettings.length > 0
    ? parameters.safetySettings
    : DEFAULT_SAFETY_SETTINGS;

  const getSafetyThreshold = (category) => {
    const entry = currentSafetySettings.find((s) => s.category === category);
    return entry?.threshold || 'BLOCK_NONE';
  };

  const handleSafetyChange = (category, threshold) => {
    if (!isGoogle) return;
    const updated = GOOGLE_SAFETY_CATEGORIES.map((cat) => ({
      category: cat.id,
      threshold: cat.id === category ? threshold : getSafetyThreshold(cat.id),
    }));
    updateParameter('safetySettings', updated);
  };

  // Stepped slider mapping for Thinking Level (Gemini 4 Argon & Gemini 3.x)
  const thinkingLevels = ['minimal', 'low', 'medium', 'high'];
  const effectiveThinkingLevel = thinkingLevels.includes(String(parameters.thinkingLevel || '').toLowerCase())
    ? String(parameters.thinkingLevel).toLowerCase()
    : (schema.thinkingDefault || 'medium');
  const currentLevelIndex = thinkingLevels.indexOf(effectiveThinkingLevel);

  // Stepped slider mapping for Reasoning Effort (OpenAI / DeepSeek)
  const reasoningEfforts = ['auto', 'low', 'medium', 'high'];
  const currentEffortIndex = reasoningEfforts.indexOf(parameters.reasoningEffort || 'auto');

  const currentTemp = Number(getTemperature());
  const currentTopP = Number(getTopP());
  const currentMaxTokens = Number(getMaxTokens());
  const currentPresencePenalty = getPresencePenalty();
  const currentFrequencyPenalty = getFrequencyPenalty();

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
                  {isGoogle ? 'Google GenAI' : 'OpenAI Compatible'}
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

          {/* GOOGLE AI STUDIO: SYSTEM INSTRUCTIONS (Strictly isolated to isGoogle) */}
          {isGoogle && (
            <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-xl border border-cyan-500/30">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2 text-[#00f0ff]">
                  <Sparkles size={15} />
                  <label htmlFor="google-system-instructions" className="font-bold uppercase tracking-wider text-slate-200 cursor-pointer">
                    System instructions
                  </label>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">config.systemInstruction</span>
              </div>
              <textarea
                id="google-system-instructions"
                rows={4}
                placeholder="Optional tone and style instructions for the model (maps directly to config.systemInstruction)..."
                value={parameters.systemInstruction || ''}
                onChange={(e) => handleParamChange('systemInstruction', e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00f0ff] resize-y font-sans leading-relaxed"
              />
            </div>
          )}
          
          {/* SECTION 1: SAMPLING & HYPERPARAMETERS */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Zap size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  1. {isGoogle ? 'Sampling & Diversity (Google AI Studio)' : 'OpenAI Hyperparameters'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                {isGoogle ? '@google/genai Schema' : 'OpenAI Chat Completions Schema'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Temperature Slider (0.0 to 2.0) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">
                    {isGoogle ? 'Temperature:' : 'temperature:'}
                  </span>
                  <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                    {currentTemp.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={currentTemp}
                  onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0 (Deterministic)</span>
                  <span>{isGoogle ? '1.0 (Default)' : '0.7 (Default)'}</span>
                  <span>2.0 (High Chaos)</span>
                </div>
              </div>

              {/* Top P / top_p Slider (0.0 to 1.0) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">
                    {isGoogle ? 'Top P (Nucleus):' : 'top_p (Nucleus):'}
                  </span>
                  <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                    {currentTopP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={currentTopP}
                  onChange={(e) => handleParamChange('topP', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0 (Tight)</span>
                  <span>0.95</span>
                  <span>1.0 (Full Distribution)</span>
                </div>
              </div>

              {/* Conditional Top K for Google Only (1 to 100) */}
              {isGoogle && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold">Top K (Google GenAI):</span>
                    <span className="text-[#00f0ff] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                      {parameters.topK ?? 40}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={parameters.topK ?? 40}
                    onChange={(e) => handleParamChange('topK', parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1 (Narrow)</span>
                    <span>40 (Default)</span>
                    <span>100 (Max)</span>
                  </div>
                </div>
              )}

              {/* Conditional Penalties for OpenAI Compatible Only (presence_penalty & frequency_penalty) */}
              {!isGoogle && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">presence_penalty:</span>
                      <input
                        type="number"
                        min="-2.0"
                        max="2.0"
                        step="0.1"
                        value={currentPresencePenalty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!Number.isNaN(val)) {
                            handleParamChange('presencePenalty', Math.min(2.0, Math.max(-2.0, val)));
                          }
                        }}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-1.5 py-0.5 text-right text-amber-400 font-bold focus:outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min="-2.0"
                      max="2.0"
                      step="0.1"
                      value={currentPresencePenalty}
                      onChange={(e) => handleParamChange('presencePenalty', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>-2.0</span>
                      <span>0.0 (Neutral)</span>
                      <span>+2.0 (Encourage new topics)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold">frequency_penalty:</span>
                      <input
                        type="number"
                        min="-2.0"
                        max="2.0"
                        step="0.1"
                        value={currentFrequencyPenalty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!Number.isNaN(val)) {
                            handleParamChange('frequencyPenalty', Math.min(2.0, Math.max(-2.0, val)));
                          }
                        }}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-1.5 py-0.5 text-right text-amber-400 font-bold focus:outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min="-2.0"
                      max="2.0"
                      step="0.1"
                      value={currentFrequencyPenalty}
                      onChange={(e) => handleParamChange('frequencyPenalty', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>-2.0</span>
                      <span>0.0 (Neutral)</span>
                      <span>+2.0 (Reduce repetition)</span>
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
              {/* maxOutputTokens (Google) vs max_completion_tokens (OpenAI) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">
                    {isGoogle ? 'Max Output Tokens:' : 'max_completion_tokens:'}
                  </span>
                  <input
                    type="number"
                    min="256"
                    max={maxOutputCap}
                    step="256"
                    value={currentMaxTokens}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 256;
                      handleParamChange('maxOutputTokens', Math.min(val, maxOutputCap));
                    }}
                    className="w-24 bg-slate-900 border border-cyan-500/30 rounded px-1.5 py-0.5 text-right text-cyan-300 font-bold focus:outline-none"
                  />
                </div>
                <input
                  type="range"
                  min="256"
                  max={maxOutputCap}
                  step="256"
                  value={Math.min(currentMaxTokens, maxOutputCap)}
                  onChange={(e) => handleParamChange('maxOutputTokens', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>256</span>
                  <span>{isGoogle ? '8,192' : '2,048'}</span>
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
                {isGoogle ? 'Stop Sequences (config.stopSequences):' : 'Stop Sequences (payload.stop):'}
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

          {/* SECTION 3 (GOOGLE ONLY): THINKING CONFIG (Strictly wrapped in isGoogle guard) */}
          {isGoogle && (
            <div className="thinking-config space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2 text-[#00f0ff]">
                  <Cpu size={15} />
                  <span className="font-bold uppercase tracking-wider text-slate-200">
                    3. Thinking Config (Google AI Studio)
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">
                  Type: {schema.reasoningType}
                </span>
              </div>

              {supportsGoogleThinking ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                    <div>
                      <span className="font-semibold text-slate-200 block">Thinking</span>
                      <span className="text-[10px] text-slate-400">
                        {schema.reasoningType === 'google-level'
                          ? 'Enable Gemini 3/4 reasoning effort (thinkingLevel — purges sampling keys when active)'
                          : 'Enable legacy Gemini 2.5 Pro token-budgeted reasoning (thinkingBudget)'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(parameters.thinkingEnabled)}
                        onChange={(e) => handleParamChange('thinkingEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                    </label>
                  </div>

                  {parameters.thinkingEnabled && schema.reasoningType === 'google-level' && (
                    <div className="space-y-2.5 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="font-semibold">Thinking Level (thinkingConfig.thinkingLevel):</span>
                        <span className="text-[#00f0ff] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                          {effectiveThinkingLevel.toUpperCase()}
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="1"
                        value={currentLevelIndex >= 0 ? currentLevelIndex : 2}
                        onChange={(e) => handleParamChange('thinkingLevel', thinkingLevels[parseInt(e.target.value, 10)])}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                      />

                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1 gap-1.5">
                        {thinkingLevels.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleParamChange('thinkingLevel', lvl)}
                            className={`flex-1 uppercase px-2 py-1 rounded transition-colors ${
                              effectiveThinkingLevel === lvl
                                ? 'text-[#00f0ff] bg-cyan-950 border border-cyan-500/40 font-bold'
                                : 'text-slate-500 bg-slate-950/60 border border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {parameters.thinkingEnabled && schema.reasoningType === 'google-budget' && (
                    <div className="space-y-3 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-slate-300">
                        <span className="font-semibold">Thinking Budget (Legacy 2.5 Pro):</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={
                              parameters.thinkingBudget === 'auto' || parameters.thinkingBudget === -1
                                ? 'auto'
                                : [1024, 2048, 4096, 8192].includes(Number(parameters.thinkingBudget))
                                  ? String(parameters.thinkingBudget)
                                  : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'auto') {
                                handleParamChange('thinkingBudget', 'auto');
                              } else if (val === 'custom') {
                                handleParamChange('thinkingBudget', 2048);
                              } else {
                                handleParamChange('thinkingBudget', parseInt(val, 10));
                              }
                            }}
                            className="bg-slate-950 text-[#00f0ff] text-xs border border-cyan-500/40 rounded px-2 py-1 font-mono focus:outline-none focus:border-[#00f0ff]"
                          >
                            <option value="auto">auto (Default 2048)</option>
                            <option value="1024">1024 tokens (Min)</option>
                            <option value="2048">2048 tokens (Default)</option>
                            <option value="4096">4096 tokens</option>
                            <option value="8192">8192 tokens</option>
                            <option value="custom">Custom Budget...</option>
                          </select>

                          {parameters.thinkingBudget !== 'auto' && parameters.thinkingBudget !== -1 && (
                            <input
                              type="number"
                              min="1024"
                              max={maxOutputCap}
                              step="256"
                              value={Number(parameters.thinkingBudget) || 2048}
                              onChange={(e) => {
                                const raw = parseInt(e.target.value, 10);
                                if (Number.isFinite(raw)) {
                                  handleParamChange('thinkingBudget', Math.min(Math.max(1024, raw), maxOutputCap));
                                }
                              }}
                              className="w-24 bg-slate-950 border border-cyan-500/40 rounded px-2 py-1 text-right text-cyan-300 font-bold focus:outline-none"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center space-x-2 text-slate-500">
                  <Info size={16} className="shrink-0 text-slate-600" />
                  <span className="text-[11px]">
                    Thinking controls are not applicable for this Gemini/Gemma variant. Standard sampling controls remain active.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3 (OPENAI ONLY): OPENAI / DEEPSEEK REASONING EFFORT */}
          {!isGoogle && schema.reasoningType === 'openai-effort' && (
            <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Cpu size={15} />
                  <span className="font-bold uppercase tracking-wider text-slate-200">
                    3. OpenAI Reasoning Effort
                  </span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono">
                  payload.reasoning_effort
                </span>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold">reasoning_effort:</span>
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
                    onChange={(e) => handleParamChange('reasoningEffort', reasoningEfforts[parseInt(e.target.value, 10)])}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
                    {reasoningEfforts.map((effort) => (
                      <button
                        key={effort}
                        type="button"
                        onClick={() => handleParamChange('reasoningEffort', effort)}
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
              </div>
            </div>
          )}

          {/* SECTION 4: CONTEXT & TRANSPORT */}
          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-[#00f0ff]">
                <Globe size={15} />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  {isGoogle ? '4. Context, Grounding & Transport' : '4. Stream & Transport Options'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">{isGoogle ? 'Tool Bindings' : 'OpenAI SSE Stream'}</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Google Search Grounding (Strictly isolated to isGoogle) */}
              {isGoogle && schema.supportsGroundingSearch && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200 block">Grounding with Google Search</span>
                    <span className="text-[10px] text-slate-400">Attach real-time web search results to the generation</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(parameters.groundingWithGoogleSearch)}
                      onChange={(e) => handleParamChange('groundingWithGoogleSearch', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00f0ff]"></div>
                  </label>
                </div>
              )}

              {/* URL Context (Strictly isolated to isGoogle) */}
              {isGoogle && schema.supportsUrlContext && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200 block">URL Context Fetching</span>
                    <span className="text-[10px] text-slate-400">Allow model to pull full page contents from links in prompt</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(parameters.urlContext)}
                      onChange={(e) => handleParamChange('urlContext', e.target.checked)}
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
                    checked={Boolean(parameters.resendFiles)}
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
                    checked={Boolean(parameters.disableStreaming)}
                    onChange={(e) => updateParameter('disableStreaming', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 5: GOOGLE AI STUDIO SAFETY SETTINGS (Strictly wrapped in isGoogle guard) */}
          {isGoogle && (
            <div className="safety-settings space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2 text-[#00f0ff]">
                  <ShieldAlert size={15} />
                  <span className="font-bold uppercase tracking-wider text-slate-200">
                    5. Safety Settings (Google AI Studio)
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">config.safetySettings</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {GOOGLE_SAFETY_CATEGORIES.map((cat) => {
                  const currentThreshold = getSafetyThreshold(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/70 border border-slate-800"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{cat.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{cat.id}</span>
                      </div>
                      <select
                        value={currentThreshold}
                        onChange={(e) => handleSafetyChange(cat.id, e.target.value)}
                        className="bg-slate-950 text-cyan-300 text-xs border border-cyan-500/30 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-[#00f0ff]"
                      >
                        {GOOGLE_SAFETY_THRESHOLDS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
