import React, { useEffect, useRef } from 'react';
import { 
  X, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Code2, 
  Sparkles, 
  ExternalLink, 
  Terminal,
  Layers,
  Zap,
  GitBranch
} from 'lucide-react';

/**
 * AboutSpecsModal
 * - Modern native <dialog> adhering to modern-web-guidance:
 *   Uses `closedby="any"`, showModal(), light-dismiss fallback, and entry/exit transitions.
 * - Highlights Developer Portfolio, Zero-Cache-Miss RAG, AES-256 Key Vault, and AGPLv3.
 */
export default function AboutSpecsModal({ isOpen, onClose }) {
  const dialogRef = useRef(null);

  // Sync open/close state with native dialog methods
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle native cancel / close events
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Fallback for browsers that do not support `closedby="any"` (modern-web-guidance: light-dismiss-a-dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event) => {
        if (event.target !== dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (!isDialogContent) {
          dialog.close();
        }
      };

      dialog.addEventListener('click', handleBackdropClick);
      return () => dialog.removeEventListener('click', handleBackdropClick);
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="about-specs-title"
      className="m-auto p-0 bg-transparent text-slate-200 outline-none max-w-3xl w-[92vw] max-h-[88vh] backdrop:bg-cyber-950/80 backdrop:backdrop-blur-md rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(0,240,255,0.15)] font-mono z-50 overflow-hidden"
    >
      <div className="flex flex-col max-h-[88vh] bg-cyber-900/95 border border-cyan-500/20 rounded-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-500/25 bg-cyber-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/90 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-glow-cyan-sm">
              <Terminal size={16} />
            </div>
            <div>
              <h2 id="about-specs-title" className="text-sm sm:text-base font-bold uppercase tracking-wider text-cyan-200">
                SYSTEM SPECS // DEVELOPER PORTFOLIO
              </h2>
              <p className="text-[10px] text-cyan-400/70 tracking-widest uppercase">
                INTPcrafter StoryContainer Architecture
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold tracking-widest">
              SYS::ONLINE
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors border border-transparent hover:border-rose-500/30"
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-300">
          {/* Section 1: Developer Portfolio & Vision */}
          <section className="bg-cyber-950/70 border border-cyan-500/20 rounded-xl p-4 sm:p-5 relative overflow-hidden group hover:border-cyan-400/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-cyan-100 uppercase tracking-wider text-sm">
                    INTP AI Systems Architect & Creative Engineer
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-400/30">
                    CREATOR
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-xs">
                  Dedicated to engineering autonomous narrative generation frameworks that bridge the gap between creative literary intuition and deterministic systems architecture. INTPcrafter represents a zero-compromise platform designed for infinite world persistence, deep character memory, and high-velocity streaming prose.
                </p>
                <div className="pt-1 italic text-cyan-400/80 text-xs">
                  “Craft story from nowhere — where algorithmic logic meets limitless imagination.”
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Zero-Cache-Miss RAG Architecture */}
          <section className="bg-cyber-950/70 border border-violet-500/20 rounded-xl p-4 sm:p-5 relative overflow-hidden group hover:border-violet-400/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-violet-950/80 border border-violet-500/30 text-violet-300 shrink-0">
                <Database size={18} />
              </div>
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-violet-200 uppercase tracking-wider text-sm">
                    Zero-Cache-Miss RAG Architecture
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-900/60 text-violet-300 border border-violet-400/30 font-bold">
                    3-TIER KV CACHE
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-xs">
                  Engineered with a high-throughput three-tier KV cache and polymorphic lore graph:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-cyber-900/90 border border-violet-500/20">
                    <span className="text-[10px] font-bold text-violet-300 block mb-0.5">TIER 1 // MEMORY LRU</span>
                    <p className="text-[11px] text-slate-400">Sub-millisecond retrieval of active Chronicle state & recent turns.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyber-900/90 border border-violet-500/20">
                    <span className="text-[10px] font-bold text-violet-300 block mb-0.5">TIER 2 // PREFIX CACHING</span>
                    <p className="text-[11px] text-slate-400">Dynamic system prompt prefix reuse saving up to 85% input token costs.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyber-900/90 border border-violet-500/20">
                    <span className="text-[10px] font-bold text-violet-300 block mb-0.5">TIER 3 // GRAPH-RAG</span>
                    <p className="text-[11px] text-slate-400">Bi-directional entity relationship nodes with contextual vector synthesis.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: AES-256 Key Vault (BYOK) */}
          <section className="bg-cyber-950/70 border border-amber-500/20 rounded-xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-400/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-950/80 border border-amber-500/30 text-amber-300 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-amber-200 uppercase tracking-wider text-sm">
                    AES-256-GCM Key Vault // BYOK Model
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-400/30 font-bold">
                    ZERO PLAINTEXT
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-xs">
                  Your credentials are strictly protected. Client-side Bring-Your-Own-Key architecture encrypts API tokens before transit. Supports intelligent load balancing, quota distribution, and automatic rate-limit rotation across Google Gemini, DeepSeek, OpenRouter, and Groq pools.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: AGPLv3 Open Source & Specs */}
          <section className="bg-cyber-950/70 border border-emerald-500/20 rounded-xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-400/40 transition-all">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 shrink-0">
                <Code2 size={18} />
              </div>
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-emerald-200 uppercase tracking-wider text-sm">
                    Open Source License & Engine Stack
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-400/30 font-bold">
                    AGPL-3.0
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  Distributed under the GNU Affero General Public License v3.0. Guaranteed software freedom, reproducible narrative intelligence, and community-driven AI craft.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    React 18 + Vite 6
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    TailwindCSS + KaTeX
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    Express + MySQL/SQLite
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    Google GenAI SDK 2.23
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-cyan-500/25 bg-cyber-950/80 text-xs">
          <div className="flex items-center space-x-3 text-slate-400">
            <a 
              href="https://aistudio.google.com/apikey" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              <span>Google AI Studio</span>
              <ExternalLink size={11} />
            </a>
            <span>•</span>
            <span className="text-slate-500">v1.0.0 AGPLv3</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold tracking-wider uppercase transition-all shadow-glow-cyan-sm active:scale-95"
          >
            [ Close // Esc ]
          </button>
        </div>
      </div>
    </dialog>
  );
}
