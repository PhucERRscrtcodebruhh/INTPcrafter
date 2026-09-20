import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-cyber-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`w-full ${maxWidth} glass-panel border-t md:border border-cyan-500/30 rounded-t-2xl md:rounded-lg shadow-glow-cyan overflow-hidden flex flex-col max-h-[88vh] md:max-h-[90vh] pb-safe`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 md:py-4 border-b border-cyan-500/20 bg-cyber-900/80">
          <div className="flex items-center space-x-2 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold tracking-wider text-cyan-400 uppercase truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-cyber-800 transition-colors"
            title="Close / Done"
            aria-label="Close"
          >
            <span className="text-xs font-mono font-bold mr-1 hidden sm:inline">Close</span>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
