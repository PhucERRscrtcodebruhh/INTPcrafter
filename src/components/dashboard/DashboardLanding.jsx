import React, { useState, useEffect } from 'react';
import ParticleCanvas from './ParticleCanvas';
import AboutSpecsModal from './AboutSpecsModal';
import NeovimMiniGame from './NeovimMiniGame';
import { 
  Terminal, 
  Sparkles, 
  Rocket, 
  Sliders, 
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Palette
} from 'lucide-react';

const SOLVED_STORAGE_KEY = 'intpcrafter_glyph_a_solved';
const THEME_STORAGE_KEY = 'intpcrafter_theme';

const ASCII_INTP = `██╗███╗   ██╗████████╗██████╗ 
██║████╗  ██║╚══██╔══╝██╔══██╗
██║██╔██╗ ██║   ██║   ██████╔╝
██║██║╚██╗██║   ██║   ██╔═══╝ 
██║██║ ╚████║   ██║   ██║     
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝     `;

const THEMES = [
  { id: 'neo-tech', name: 'Neo-Tech', color: 'text-cyan-400', border: 'border-cyan-500/40' },
  { id: 'paper', name: 'Paper', color: 'text-amber-300', border: 'border-amber-500/40' },
  { id: 'ink', name: 'Ink', color: 'text-emerald-400', border: 'border-emerald-500/40' },
];

/**
 * Interactive Cyberpunk Dashboard Landing Page for INTPcrafter
 * - Deep space slate theme (#070b14)
 * - Canvas particle constellation & burst system
 * - Hero typography with ASCII header & dynamic "c R [ _ ] F T E R" title matrix
 * - Floating anime mascot PNG with ambient cyan drop-shadow
 * - Neovim interactive CLI mini-game ("Find the Missing A")
 * - Top navigation with Specs Modal and Theme switcher
 * - Bottom CTA: [ 🚀 Go to Chat // Enter Studio ]
 */
export default function DashboardLanding({ onEnterStudio, currentUser, onOpenLogin }) {
  // Mini-game solved state (persisted in sessionStorage)
  const [isSolved, setIsSolved] = useState(() => {
    return sessionStorage.getItem(SOLVED_STORAGE_KEY) === 'true';
  });

  // Specs Modal state
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

  // Theme state ('neo-tech' | 'paper' | 'ink')
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'neo-tech';
  });

  // Particle burst trigger
  const [burstTrigger, setBurstTrigger] = useState(false);

  const handleSolve = () => {
    setIsSolved(true);
    sessionStorage.setItem(SOLVED_STORAGE_KEY, 'true');
    setBurstTrigger(true);
    setTimeout(() => setBurstTrigger(false), 2000);
  };

  const handleReset = () => {
    setIsSolved(false);
    sessionStorage.removeItem(SOLVED_STORAGE_KEY);
  };

  const cycleTheme = () => {
    const currentIndex = THEMES.findIndex((t) => t.id === currentTheme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length].id;
    setCurrentTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  // Theme-specific accent classes
  const themeClasses = {
    'neo-tech': 'text-cyan-400 shadow-glow-cyan',
    'paper': 'text-amber-300 shadow-glow-amber',
    'ink': 'text-emerald-400 shadow-glow-emerald',
  };

  return (
    <div className={`relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-mono select-none bg-[#070b14] text-slate-100 ${
      currentTheme === 'paper' ? 'theme-paper' : currentTheme === 'ink' ? 'theme-ink' : 'theme-neo-tech'
    }`}>
      {/* Interactive 60fps HTML5 Particle Canvas */}
      <ParticleCanvas triggerBurst={burstTrigger} />

      {/* Cyberpunk Grid Background Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.035] bg-[linear-gradient(to_right,#00f0ff_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff_1px,transparent_1px)] bg-[size:3rem_3rem]" 
        aria-hidden="true" 
      />

      {/* 1. TOP NAVIGATION BAR */}
      <header className="relative z-30 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-cyan-500/15 bg-[#070b14]/80 backdrop-blur-md">
        {/* Top-left: [ About Me // System Specs ] */}
        <button
          onClick={() => setIsSpecsOpen(true)}
          className="group flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/40 hover:border-cyan-400/60 text-cyan-300 text-xs sm:text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(0,240,255,0.08)] hover:shadow-glow-cyan-sm active:scale-95"
        >
          <span className="text-cyan-400 group-hover:rotate-45 transition-transform duration-300">
            ::
          </span>
          <span>ABOUT ME // SPECS</span>
        </button>

        {/* Center / Mascot Status Badge (Hidden on very small screens) */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-800 bg-cyber-950/70 text-[10px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="tracking-widest uppercase">ENGINE: HYDE + GRAPH-RAG ONLINE</span>
        </div>

        {/* Top-right: Theme Switcher Badge & User Profile */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={cycleTheme}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyber-950/60 hover:bg-cyber-900/80 hover:border-cyan-400 text-xs transition-all shadow-sm active:scale-95"
            title="Click to switch theme"
          >
            <Palette size={13} className="text-cyan-400" />
            <span className="text-slate-400 text-[10px]">THEME:</span>
            <span className="font-bold uppercase tracking-wider text-cyan-300">
              {THEMES.find((t) => t.id === currentTheme)?.name || 'NEO-TECH'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. HERO SPLIT SECTION (Center) */}
      <main className="relative z-20 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column (Typography & Title Matrix) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
            {/* System Status Pill */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-950/30 text-[10px] sm:text-[11px] text-cyan-300 tracking-widest uppercase">
              <span className={`w-2 h-2 rounded-full ${isSolved ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span>
                {isSolved ? 'SYSTEM STATUS: FULL MATRIX SYNCHRONIZED' : 'STATUS: DETACHED GLYPH (0x41) DETECTED'}
              </span>
            </div>

            {/* Stylized Block Header: INTP */}
            <div className="relative group">
              <pre className="text-[13px] sm:text-[16px] md:text-[19px] lg:text-[22px] font-bold text-cyan-400 leading-none select-none drop-shadow-[0_0_15px_rgba(0,240,255,0.7)] tracking-tighter">
                {ASCII_INTP}
              </pre>
            </div>

            {/* Sub-header: c R [ _ ] F T E R vs C R A F T E R */}
            <div className="pt-1">
              {isSolved ? (
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[0.25em] sm:tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_25px_rgba(0,240,255,0.85)] animate-lock-flash flex items-center justify-center lg:justify-start">
                  C R A F T E R
                </h1>
              ) : (
                <div className="flex items-center justify-center lg:justify-start text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.18em] sm:tracking-[0.28em] text-slate-200">
                  <span className="text-slate-300">c R </span>
                  {/* Glitching Red/Amber Cursor Slot */}
                  <span className="inline-flex items-center justify-center mx-1 sm:mx-2 px-2 sm:px-3 py-0.5 rounded-lg bg-amber-500/15 border-2 border-amber-500/70 text-amber-400 animate-glitch-amber shadow-[0_0_16px_rgba(245,158,11,0.5)]">
                    _
                  </span>
                  <span className="text-slate-300">F T E R</span>
                </div>
              )}
            </div>

            {/* Tagline */}
            <div className="space-y-1">
              <p className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-[0.2em] text-cyan-200/90 drop-shadow-sm">
                “CRAFT STORY FROM NOWHERE.”
              </p>
              <p className="text-xs sm:text-xs text-slate-400 font-mono tracking-wider max-w-md">
                Autonomous Narrative Intelligence • Zero-Cache-Miss RAG • AES-256 BYOK Vault
              </p>
            </div>

            {/* Neovim Interactive Buffer Mini-Game */}
            <div className="w-full pt-4">
              <NeovimMiniGame
                isSolved={isSolved}
                onSolve={handleSolve}
                onReset={handleReset}
                onParticleBurst={() => {
                  setBurstTrigger(true);
                  setTimeout(() => setBurstTrigger(false), 2000);
                }}
              />
            </div>
          </div>

          {/* Right Column (Mascot Showcase) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            {/* Ambient Background Aura Glow */}
            <div className="absolute w-72 h-72 sm:w-80 sm:h-80 bg-gradient-to-tr from-cyan-500/20 via-violet-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Mascot Showcase Card with seamless blending and drop shadow */}
            <div className="relative group flex flex-col items-center">
              {/* Subtle tech brackets HUD */}
              <div className="absolute -top-3 -left-3 text-cyan-500/40 text-xs font-mono select-none">
                ┌── [MASCOT::AI_CO_PILOT]
              </div>
              <div className="absolute -bottom-3 -right-3 text-cyan-500/40 text-xs font-mono select-none">
                [PARITY_OK] ──┘
              </div>

              {/* Anime Mascot Transparent PNG */}
              <div className="relative animate-float-slow transition-transform duration-500 hover:scale-[1.02]">
                <img
                  src="/assets/mascot-transparent.png"
                  alt="INTPcrafter Mascot"
                  className="w-64 sm:w-72 md:w-80 lg:w-96 object-contain pointer-events-auto select-none transition-all duration-500"
                  style={{
                    filter: 'drop-shadow(0 0 24px rgba(0, 240, 255, 0.35))',
                  }}
                  onError={(e) => {
                    // Fallback to /mascot_error.png if /assets/mascot-transparent.png fails
                    if (e.target.src !== `${window.location.origin}/mascot_error.png`) {
                      e.target.src = '/mascot_error.png';
                    }
                  }}
                />
              </div>

              {/* Mascot Status Label */}
              <div className="mt-2 text-center">
                <span className="text-[10px] tracking-widest text-cyan-400/80 uppercase font-mono bg-cyber-950/80 px-2.5 py-1 rounded-full border border-cyan-500/20 shadow-glow-cyan-sm">
                  INTP-COGNITIVE // AESTHETIC RECEPTOR
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. BOTTOM CALL-TO-ACTION SECTION */}
      <footer className="relative z-30 w-full py-6 px-4 flex flex-col items-center justify-center bg-gradient-to-t from-[#070b14] via-[#070b14]/90 to-transparent">
        <button
          onClick={onEnterStudio}
          className="group relative inline-flex items-center justify-center px-8 sm:px-12 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-cyan-400/30 to-violet-500/20 hover:from-cyan-400/40 hover:via-cyan-300/50 hover:to-violet-400/30 border-2 border-cyan-400/60 hover:border-cyan-300 text-cyan-100 hover:text-white font-extrabold text-sm sm:text-base tracking-[0.2em] uppercase transition-all duration-300 shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:shadow-[0_0_40px_rgba(0,240,255,0.65)] hover:scale-105 active:scale-95 cursor-pointer"
        >
          {/* Subtle button scanline shimmer */}
          <span className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          </span>

          <Rocket size={18} className="mr-2 text-cyan-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          <span>GO TO CHAT // ENTER STUDIO</span>
          <ChevronRight size={18} className="ml-2 text-cyan-300 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-2.5 text-[10px] text-slate-500 tracking-widest uppercase">
          StoryContainer Engine • AGPL-3.0 License • Always Accessible
        </p>
      </footer>

      {/* About Me & System Specs Modal */}
      <AboutSpecsModal
        isOpen={isSpecsOpen}
        onClose={() => setIsSpecsOpen(false)}
      />
    </div>
  );
}
