import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, RotateCcw, AlertTriangle, Sparkles, Send } from 'lucide-react';

const SOLVED_STORAGE_KEY = 'intpcrafter_glyph_a_solved';

/**
 * Neovim Interactive Buffer ("Find the Missing A" CLI Mini-Game)
 * - Modes: NORMAL, INSERT, COMMAND
 * - Supported Commands: :s/_/A/, :s/_/A/g, :restore, :fix, :wq
 * - Insert Mode: Press 'i' then 'A'
 * - Floating wandering [A] node with click-to-solve & auto-type animation
 * - Emerald Green lualine on completion + sessionStorage persistence
 */
export default function NeovimMiniGame({ 
  isSolved, 
  onSolve, 
  onReset,
  onParticleBurst 
}) {
  const [mode, setMode] = useState('NORMAL'); // 'NORMAL' | 'INSERT' | 'COMMAND'
  const [commandInput, setCommandInput] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isTypingAuto, setIsTypingAuto] = useState(false);
  const [flyingGlyph, setFlyingGlyph] = useState(false);
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  // Focus terminal input
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Keyboard navigation for Vim mode shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if typing in other forms outside this page or modal
      if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target !== inputRef.current)) {
        return;
      }

      if (isSolved) return;

      // Escape key returns to NORMAL mode
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('NORMAL');
        setCommandInput('');
        setErrorMessage(null);
        return;
      }

      if (mode === 'NORMAL') {
        if (e.key === ':') {
          e.preventDefault();
          setMode('COMMAND');
          setCommandInput(':');
          focusInput();
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          setMode('INSERT');
          setCommandInput('');
          focusInput();
        }
      } else if (mode === 'INSERT') {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          triggerSolveSuccess('INSERT: Added glyph "A"');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isSolved]);

  const triggerSolveSuccess = (source = 'command') => {
    onSolve();
    onParticleBurst?.();
    setMode('NORMAL');
    setCommandInput('');
    setErrorMessage(null);
  };

  // Execute typed Vim command
  const handleCommandSubmit = (e) => {
    e?.preventDefault();
    if (isSolved) return;

    const trimmed = commandInput.trim().toLowerCase();

    // Check valid solve commands
    const validCommands = [
      ':s/_/a/',
      ':s/_/a/g',
      ':s/_/a',
      ':restore',
      ':fix',
      ':wq',
      's/_/a/',
      's/_/a/g',
      'restore',
      'fix',
    ];

    if (validCommands.includes(trimmed)) {
      triggerSolveSuccess();
    } else if (trimmed === ':q' || trimmed === ':q!' || trimmed === ':w') {
      triggerSolveSuccess();
    } else {
      setErrorMessage(`E492: Not an editor command: ${commandInput}`);
      setTimeout(() => setErrorMessage(null), 3000);
      setCommandInput(':');
    }
  };

  // Click on Wandering Floating [A]
  const handleFloatingAClick = () => {
    if (isSolved || isTypingAuto) return;

    setIsTypingAuto(true);
    setFlyingGlyph(true);
    setMode('COMMAND');
    setCommandInput(':');

    const targetCmd = ':s/_/A/g';
    let idx = 1;

    const typeInterval = setInterval(() => {
      if (idx <= targetCmd.length) {
        setCommandInput(targetCmd.slice(0, idx));
        idx++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setIsTypingAuto(false);
          setFlyingGlyph(false);
          triggerSolveSuccess('wandering_a');
        }, 300);
      }
    }, 45);
  };

  return (
    <div className="w-full flex flex-col items-center select-none font-mono">
      {/* Neovim Window Box */}
      <div 
        ref={terminalRef}
        onClick={focusInput}
        className={`w-full max-w-3xl rounded-xl border transition-all duration-300 overflow-hidden shadow-2xl relative ${
          isSolved 
            ? 'bg-cyber-950/90 border-emerald-500/40 shadow-[0_0_30px_rgba(0,255,170,0.15)]' 
            : 'bg-cyber-950/95 border-cyan-500/30 hover:border-cyan-400/50 shadow-[0_0_35px_rgba(0,240,255,0.12)]'
        }`}
      >
        {/* Top Neovim Window Title Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-cyber-900/90 border-b border-cyan-500/20 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
            <span className="text-[11px] font-bold text-slate-300 ml-2 flex items-center gap-1.5 tracking-wider">
              <Terminal size={12} className={isSolved ? 'text-emerald-400' : 'text-cyan-400'} />
              NVIM // matrix_title.lua
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            {isSolved ? (
              <span className="flex items-center gap-1 text-emerald-400 font-bold tracking-wider">
                <CheckCircle2 size={12} />
                MODIFIED [RO]
              </span>
            ) : (
              <span className="text-amber-400/80 font-bold tracking-wider animate-pulse">
                [GLITCH DETECTED]
              </span>
            )}
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-mono">lua:utf-8</span>
          </div>
        </div>

        {/* Neovim Buffer Content */}
        <div className="p-4 sm:p-5 font-mono text-xs sm:text-sm space-y-1.5 leading-relaxed bg-black/40">
          {/* Line 1: Comment warning */}
          <div className="flex items-start">
            <span className="w-7 sm:w-8 shrink-0 text-slate-600 text-right pr-3 select-none">1</span>
            <span className="text-slate-500 italic">
              -- SYSTEM WARNING: Glyph <span className="text-amber-400 font-bold">'A' (0x41)</span> detached from matrix
            </span>
          </div>

          {/* Line 2: Matrix variable */}
          <div className="flex items-start">
            <span className="w-7 sm:w-8 shrink-0 text-slate-600 text-right pr-3 select-none">2</span>
            <div>
              <span className="text-violet-400 font-semibold">local</span>{' '}
              <span className="text-cyan-200">matrix</span>{' '}
              <span className="text-slate-400">=</span>{' '}
              <span className="text-emerald-300">"</span>
              <span className="text-slate-100 font-bold">INTP </span>
              {isSolved ? (
                <span className="text-cyan-300 font-extrabold tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-lock-flash">
                  C R A F T E R
                </span>
              ) : (
                <>
                  <span className="text-slate-200">c R </span>
                  <span className="inline-block px-1.5 py-0.2 mx-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-400 font-black tracking-widest animate-glitch-amber">
                    _
                  </span>
                  <span className="text-slate-200"> F T E R</span>
                </>
              )}
              <span className="text-emerald-300">"</span>
            </div>
          </div>

          {/* Line 3: Hint comment */}
          <div className="flex items-start">
            <span className="w-7 sm:w-8 shrink-0 text-slate-600 text-right pr-3 select-none">3</span>
            {isSolved ? (
              <span className="text-emerald-400/90 font-medium">
                -- STATUS: Matrix parity verified. Quantum narrative engine online.
              </span>
            ) : (
              <span className="text-slate-500 italic">
                -- Hint: Type <code className="text-cyan-300 not-italic font-bold bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-500/30">:s/_/A/</code> or press <code className="text-amber-300 not-italic font-bold bg-amber-950/60 px-1 py-0.5 rounded border border-amber-500/30">'i'</code> then <code className="text-cyan-300 not-italic font-bold bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-500/30">'A'</code>, or tap wandering [A]
              </span>
            )}
          </div>
        </div>

        {/* Classic Neovim lualine Status Bar */}
        <div 
          className={`flex flex-wrap items-center justify-between px-2.5 py-1 text-[11px] font-bold tracking-wider transition-colors duration-300 ${
            isSolved 
              ? 'bg-emerald-950/90 border-t border-emerald-500/40 text-emerald-300' 
              : 'bg-cyber-900 border-t border-cyan-500/20 text-slate-300'
          }`}
        >
          {/* Left pill */}
          <div className="flex items-center space-x-2">
            {isSolved ? (
              <div className="flex items-center">
                <span className="bg-emerald-400 text-black px-2.5 py-0.5 rounded-sm font-black text-[10px] tracking-widest uppercase shadow-[0_0_10px_rgba(0,255,170,0.4)]">
                  RESTORED
                </span>
                <span className="text-emerald-300 font-bold ml-2 text-[10px] sm:text-xs">
                  200 OK | "Story engine ready."
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <span 
                  className={`px-2 py-0.5 rounded-sm font-black text-[10px] tracking-widest uppercase ${
                    mode === 'INSERT'
                      ? 'bg-emerald-500 text-black'
                      : mode === 'COMMAND'
                      ? 'bg-amber-500 text-black'
                      : 'bg-cyan-400 text-black'
                  }`}
                >
                  {mode}
                </span>
                <span className="text-slate-400 ml-2 hidden sm:inline text-[10px]">
                  main* | utf-8 | lua
                </span>
              </div>
            )}
          </div>

          {/* Right indicator */}
          <div className="flex items-center space-x-2 text-[10px] font-mono">
            {isSolved ? (
              <span className="text-emerald-400 font-bold tracking-widest">
                SYNCHRONIZED // 100%
              </span>
            ) : (
              <span className="text-slate-400">
                100% 3:28
              </span>
            )}
          </div>
        </div>

        {/* Command Line Input / Bottom status line */}
        <div className="px-3 py-2 bg-black/60 border-t border-cyan-500/10 flex items-center justify-between min-h-[36px]">
          {isSolved ? (
            <div className="flex items-center justify-between w-full text-xs">
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <Sparkles size={13} />
                Title matrix locked: "INTP CRAFTER"
              </span>
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[10px] text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition-all"
                title="Replay glitch puzzle"
              >
                <RotateCcw size={11} />
                <span>Reset Glitch</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCommandSubmit} className="flex items-center w-full gap-2 text-xs">
              {errorMessage ? (
                <div className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse text-xs">
                  <AlertTriangle size={13} />
                  <span>{errorMessage}</span>
                </div>
              ) : (
                <div className="flex items-center w-full gap-1.5">
                  <span className={`font-bold ${mode === 'COMMAND' ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {mode === 'INSERT' ? '-- INSERT --' : ':'}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={mode === 'COMMAND' ? commandInput.replace(/^:/, '') : commandInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCommandInput(mode === 'COMMAND' ? `:${val.replace(/^:/, '')}` : val);
                      if (mode !== 'COMMAND') setMode('COMMAND');
                    }}
                    onFocus={() => {
                      if (mode === 'NORMAL') setMode('COMMAND');
                      if (!commandInput.startsWith(':')) setCommandInput(':');
                    }}
                    placeholder={
                      mode === 'INSERT' 
                        ? "Type 'A' to restore glyph, or press Esc for normal mode" 
                        : "Type :s/_/A/ or :restore and press Enter..."
                    }
                    className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 outline-none border-none text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[10px] text-cyan-300 hover:bg-cyan-900/60 transition-colors flex items-center gap-1"
                  >
                    <span>EXEC</span>
                    <Send size={10} />
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Floating Wandering [A] Glyph (Direct Input / Mobile Click Fallback) */}
      {!isSolved && (
        <div className="mt-5 flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={handleFloatingAClick}>
            {/* Ambient Cyan/Violet Aura Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/30 via-violet-500/20 to-amber-500/30 rounded-2xl blur-lg group-hover:opacity-100 opacity-60 transition duration-500 animate-pulse" />

            {/* Wandering Glyph Box */}
            <div 
              className={`relative px-4 py-2.5 rounded-xl border border-cyan-400/50 bg-cyber-950/90 backdrop-blur-md flex items-center space-x-3 shadow-[0_0_20px_rgba(0,240,255,0.25)] group-hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] group-hover:border-cyan-300 transition-all transform active:scale-95 ${
                flyingGlyph ? '-translate-y-12 scale-110 opacity-0 transition-all duration-300' : 'animate-wand-float'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400/30 to-violet-500/30 border border-cyan-300/60 flex items-center justify-center text-cyan-200 font-black text-lg tracking-widest shadow-glow-cyan-sm">
                A
              </div>

              <div className="flex flex-col text-left leading-tight">
                <span className="text-[11px] font-extrabold text-cyan-300 tracking-wider flex items-center gap-1">
                  DETACHED GLYPH [ A ]
                  <span className="text-[9px] text-amber-400 font-mono font-normal">(0x41)</span>
                </span>
                <span className="text-[9px] text-slate-400 tracking-wider font-mono">
                  (Lơ lửng, bấm vào hoặc gõ lệnh)
                </span>
              </div>

              <span className="text-xs text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30">
                ↵
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
