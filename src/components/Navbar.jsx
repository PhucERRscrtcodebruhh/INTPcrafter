import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  BookOpen, 
  Layers, 
  KeyRound, 
  Sliders, 
  Database,
  Cpu,
  User,
  LogOut,
  ShieldCheck,
  Globe,
  ChevronDown
} from 'lucide-react';

const LANGUAGES = [
  { code: 'vi', label: '🇻🇳 Tiếng Việt' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'ko', label: '🇰🇷 한국어' },
];

export default function Navbar({ 
  currentView, 
  onToggleView, 
  activeModel, 
  keyStats = [],
  loreDrawerOpen,
  onToggleLoreDrawer,
  retrievedCount = 0,
  currentUser,
  onOpenLogin,
  onLogout,
  language = 'vi',
  onLanguageChange
}) {
  const activeKeysCount = keyStats.filter(k => k.status === 'active').length;
  const rateLimitedCount = keyStats.filter(k => k.status === 'rate_limited').length;
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <header className="h-14 border-b border-cyan-500/20 bg-cyber-900/90 backdrop-blur-md px-4 flex items-center justify-between select-none z-30">
      {/* Left branding */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow-cyan-sm">
          <Terminal size={18} />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              StoryContainer
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-semibold tracking-wider">
              INTP ENGINE
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
            Deterministic World Simulator & Novel Architecture
          </p>
        </div>
      </div>

      {/* Center: Mode Switcher */}
      <div className="flex items-center bg-cyber-950 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onToggleView('studio')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            currentView === 'studio'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal size={14} />
          <span>AI Studio Canvas</span>
        </button>

        <button
          onClick={() => onToggleView('lorebook')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            currentView === 'lorebook'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database size={14} />
          <span>World Config & Lorebook</span>
        </button>

        <span className="ml-2 mr-1 px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-800 rounded bg-cyber-900 flex items-center">
          Ctrl+K
        </span>
      </div>

      {/* Right controls & status */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Language Selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-cyber-950 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-slate-200 transition-colors"
            title="Ngôn ngữ / Language"
          >
            <Globe size={13} />
            <span className="text-[11px]">{currentLang.label.split(' ')[0]}</span>
            <ChevronDown size={10} />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-cyber-900 border border-cyan-500/30 rounded-lg shadow-glow-cyan-sm overflow-hidden z-50">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onLanguageChange?.(lang.code);
                    setLangDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    language === lang.code
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                      : 'text-slate-300 hover:bg-cyber-950 hover:text-cyan-300'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Key Pool Badge */}
        <div 
          onClick={() => onToggleView('lorebook')}
          title="Click to manage Gemini API Key Pool"
          className="cursor-pointer flex items-center space-x-1.5 px-2.5 py-1 rounded bg-cyber-950 border border-slate-800 hover:border-cyan-500/40 transition-colors"
        >
          <KeyRound size={13} className="text-cyan-400" />
          <span className="text-slate-400">Pool:</span>
          <span className="font-semibold text-slate-200">
            {activeKeysCount}/{keyStats.length || 0}
          </span>
          {rateLimitedCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Some keys in cooldown" />
          )}
          {keyStats.length === 0 && (
            <span className="text-[10px] text-amber-400 font-semibold underline ml-1">BYOK</span>
          )}
        </div>

        {/* Model Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-cyber-950 border border-slate-800">
          <Cpu size={13} className="text-purple-400" />
          <span className="text-slate-400">Model:</span>
          <span className="text-cyan-300 font-semibold">{activeModel}</span>
        </div>

        {/* Lore Drawer Toggle (only in studio view) */}
        {currentView === 'studio' && (
          <button
            onClick={onToggleLoreDrawer}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-colors ${
              loreDrawerOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-cyber-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline">Lore Context</span>
            {retrievedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-400 text-black font-bold">
                {retrievedCount}
              </span>
            )}
          </button>
        )}

        {/* User Account / Profile Pill */}
        {currentUser ? (
          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800/80">
            <button
              onClick={onOpenLogin}
              title={`Tài khoản: ${currentUser.displayName || currentUser.username} (ID: ${currentUser.id}). Bấm để mở panel đăng nhập.`}
              className="flex items-center space-x-2 px-2 py-1 rounded-lg bg-cyber-950 border border-cyan-500/30 hover:border-cyan-400 text-xs transition-all group shadow-glow-cyan-sm"
            >
              <div className="relative flex items-center justify-center">
                {currentUser.avatar ? (
                  <img
                    src={typeof currentUser.avatar === 'string' && currentUser.avatar.startsWith('data:') ? currentUser.avatar : undefined}
                    alt="avatar"
                    className="w-5 h-5 rounded-full object-cover border border-cyan-400"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                    {currentUser.username?.[0]?.toUpperCase() || '0'}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-cyber-950 animate-pulse" />
              </div>
              <div className="flex flex-col items-start leading-tight text-left">
                <div className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center space-x-1">
                  <span>{currentUser.username}</span>
                  <span className="text-[9px] text-cyan-400 font-mono font-normal">ID:{currentUser.id}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono -mt-0.5">
                  {currentUser.role || 'user'}
                </span>
              </div>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Đăng xuất / Chuyển tài khoản"
                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-cyber-950 transition-colors"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-glow-cyan-sm transition-all"
          >
            <User size={13} />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
}
