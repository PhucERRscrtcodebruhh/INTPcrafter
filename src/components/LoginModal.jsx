import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Sparkles, 
  X,
  KeyRound,
  Terminal
} from 'lucide-react';
import { api } from '../services/api';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('0');
  const [password, setPassword] = useState('0000');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login(username, password);
      if (res.success && res.user) {
        localStorage.setItem('storycontainer_user', JSON.stringify(res.user));
        localStorage.setItem('storycontainer_token', res.token);
        onLoginSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDev = () => {
    setUsername('0');
    setPassword('0000');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-950/85 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className="w-full max-w-md glass-panel border border-cyan-500/40 rounded-xl shadow-glow-cyan overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-cyber-900/80">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Terminal size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wider text-cyan-400 uppercase">
                StoryContainer Access Gateway
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Developer Neural Matrix Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-cyan-400 p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Default hint notice */}
          <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyan-500/30 text-xs text-slate-300 space-y-1">
            <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold text-[11px] uppercase tracking-wider">
              <KeyRound size={13} />
              <span>Default Dev Account Credentials</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>Account ID: <strong className="text-cyan-300">0</strong> (hoặc <strong className="text-cyan-300">dev</strong>)</span>
              <span>Pass: <strong className="text-cyan-300">0000</strong></span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {/* Username / ID Input */}
          <div className="space-y-1.5 text-xs">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              Account ID / Username
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter 0 or dev"
                className="w-full pl-9 pr-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5 text-xs">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              Access Passcode
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter 0000"
                className="w-full pl-9 pr-9 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold uppercase tracking-wider shadow-glow-cyan transition-all"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Neural Signature...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Authenticate & Enter System</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleQuickDev}
              className="w-full py-1.5 text-[11px] text-slate-400 hover:text-cyan-300 font-mono text-center transition-colors"
            >
              Fill Default Dev (ID: 0 / 0000)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
