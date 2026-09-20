import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sliders, 
  Sparkles, 
  Cpu, 
  ChevronUp, 
  ChevronDown,
  CornerDownLeft,
  Settings2
} from 'lucide-react';
import { MODEL_SPECS, estimateTokens, formatTokenCount } from '../services/tokenEstimator';

export default function ControlBar({
  prompt,
  setPrompt,
  onSend,
  isLoading,
  model,
  setModel,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxOutputTokens,
  setMaxOutputTokens,
}) {
  const [showParams, setShowParams] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea based on input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim()) {
        onSend();
      }
    }
  };

  const currentInputTokens = estimateTokens(prompt);

  return (
    <div className="border-t border-cyan-500/20 bg-cyber-900/95 backdrop-blur-md p-2 sm:p-2.5 select-none z-20">
      {/* Parameter Adjustment Drawer (Collapsible) */}
      {showParams && (
        <div className="mb-3 p-3 rounded-lg glass-panel-subtle border border-cyan-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-fadeIn">
          {/* Temperature Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Temperature (Creativity):</span>
              <span className="text-cyan-300 font-mono font-semibold">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1 bg-cyber-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>0.0 (Deterministic)</span>
              <span>1.5 (Expressive)</span>
            </div>
          </div>

          {/* Top-P Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Top-P (Nucleus Sampling):</span>
              <span className="text-cyan-300 font-mono font-semibold">{topP}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value))}
              className="w-full h-1 bg-cyber-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>0.1 (Focused)</span>
              <span>1.0 (Diverse)</span>
            </div>
          </div>

          {/* Max Output Tokens Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Max Output Tokens:</span>
              <span className="text-cyan-300 font-mono font-semibold">{maxOutputTokens}</span>
            </div>
            <input
              type="range"
              min="512"
              max="8192"
              step="256"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-cyber-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>512</span>
              <span>8,192</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Control Input Bar */}
      <div className="space-y-2">
        {/* Top bar controls: Model dropdown, Parameter toggler, Token counter */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            {/* Model Selector Dropdown */}
            <div className="flex items-center space-x-1.5 bg-cyber-950 px-2.5 py-1 rounded border border-slate-800">
              <Cpu size={13} className="text-cyan-400" />
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <optgroup label="Gemini 3.x Flagship">
                  <option value="gemini-3.8-flash" className="bg-cyber-900 text-slate-200">
                    gemini-3.8-flash (1M Agentic SOTA)
                  </option>
                  <option value="gemini-3.7-flash" className="bg-cyber-900 text-slate-200">
                    gemini-3.7-flash (1M High Speed)
                  </option>
                  <option value="gemini-3.6-flash" className="bg-cyber-900 text-slate-200">
                    gemini-3.6-flash (1M Fast & Balanced)
                  </option>
                  <option value="gemini-3.5-flash-lite" className="bg-cyber-900 text-slate-200">
                    gemini-3.5-flash-lite (1M Ultra-Fast)
                  </option>
                  <option value="gemini-3.1-pro" className="bg-cyber-900 text-slate-200">
                    gemini-3.1-pro (1M Deep Reasoning)
                  </option>
                </optgroup>
                <optgroup label="Gemini 2.5 Series">
                  <option value="gemini-2.5-pro" className="bg-cyber-900 text-slate-200">
                    gemini-2.5-pro (2M Long Context)
                  </option>
                  <option value="gemini-2.5-flash" className="bg-cyber-900 text-slate-200">
                    gemini-2.5-flash (1M High Precision)
                  </option>
                </optgroup>
                <optgroup label="Gemma 4 Open Weights">
                  <option value="gemma-4-31b-it" className="bg-cyber-900 text-slate-200">
                    gemma-4-31b-it (128K Dense Nuance)
                  </option>
                  <option value="gemma-4-26b-a4b-it" className="bg-cyber-900 text-slate-200">
                    gemma-4-26b-a4b-it (128K MoE Speed)
                  </option>
                </optgroup>
              </select>
            </div>

            {/* Parameter Drawer Toggle */}
            <button
              onClick={() => setShowParams(!showParams)}
              className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors ${
                showParams
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-cyber-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings2 size={12} />
              <span>Params</span>
              {showParams ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>

          {/* Typing Prompt Token Counter */}
          <div className="flex items-center space-x-2 text-slate-400">
            {prompt.trim().length > 0 && (
              <span className="text-[11px] text-slate-400 font-mono">
                Prompt: <span className="text-cyan-300">{currentInputTokens}</span> tokens
              </span>
            )}
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Shift+Enter for newline
            </span>
          </div>
        </div>

        {/* Textarea and Send Button Container */}
        <div className="relative flex items-end bg-cyber-950 border border-cyan-500/30 rounded-lg focus-within:border-cyan-400 focus-within:shadow-glow-cyan-sm transition-all overflow-hidden">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Direct the world simulation, describe character actions, or formulate story directives..."
            className="w-full bg-transparent px-2.5 py-1.5 sm:py-2 text-xs text-slate-100 placeholder-slate-600 resize-none focus:outline-none leading-relaxed max-h-48"
          />

          <div className="p-1 sm:p-1.5 shrink-0">
            <button
              onClick={onSend}
              disabled={isLoading || !prompt.trim()}
              className={`flex items-center space-x-1 px-2.5 py-1 sm:py-1.5 rounded text-xs font-semibold transition-all ${
                isLoading || !prompt.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-glow-cyan-sm cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <CornerDownLeft size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
