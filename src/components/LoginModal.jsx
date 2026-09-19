import React, { useState } from 'react';
import { Terminal, ShieldCheck, Lock, User, Eye, EyeOff, X, KeyRound, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const { t } = useTranslation('vi');
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (tab === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await api.login(username, password);
        localStorage.setItem('storycontainer_user', JSON.stringify(res.user));
        localStorage.setItem('storycontainer_token', res.token);
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      } else {
        const res = await api.register(username, password);
        localStorage.setItem('storycontainer_user', JSON.stringify(res.user));
        localStorage.setItem('storycontainer_token', res.token);
        setSuccessMsg(t('auth.registerSuccess'));
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(res.user);
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  const quickDevLogin = async () => {
    setUsername('0');
    setPassword('0000');
    setError(null);
    setLoading(true);
    try {
      const res = await api.login('0', '0000');
      localStorage.setItem('storycontainer_user', JSON.stringify(res.user));
      localStorage.setItem('storycontainer_token', res.token);
      if (onLoginSuccess) onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="glass-panel max-w-md w-full rounded-xl overflow-hidden shadow-glow-cyan flex flex-col relative bg-cyber-950 border border-cyan-500/40">
        
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/30 flex justify-between items-center bg-cyber-900/50">
          <div className="flex items-center gap-2">
            <Terminal className="text-cyan-400 w-5 h-5" />
            <h2 className="text-cyan-400 font-bold tracking-wider">{t('auth.title')}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-cyan-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cyan-500/20 bg-cyber-950">
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'login' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/20' : 'text-slate-400 hover:text-cyan-300'}`}
            onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
          >
            <KeyRound className="w-4 h-4" />
            {t('auth.login')}
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'register' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/20' : 'text-slate-400 hover:text-cyan-300'}`}
            onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
          >
            <UserPlus className="w-4 h-4" />
            {t('auth.register')}
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-400 text-sm mb-6 text-center">{t('auth.subtitle')}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded text-green-400 text-sm text-center">
              {successMsg}
              <div className="mt-2 text-xs text-green-300/80">
                {t('auth.byokWarning')}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-cyan-400 uppercase tracking-wider">{t('auth.username')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-cyber-900 border border-cyan-500/30 rounded py-2 pl-10 pr-3 text-slate-200 focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm transition-all"
                  placeholder="ID / Username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-cyan-400 uppercase tracking-wider">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cyber-900 border border-cyan-500/30 rounded py-2 pl-10 pr-10 text-slate-200 focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {tab === 'register' && (
              <div className="space-y-1">
                <label className="text-xs text-cyan-400 uppercase tracking-wider">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-cyber-900 border border-cyan-500/30 rounded py-2 pl-10 pr-3 text-slate-200 focus:outline-none focus:border-cyan-400 focus:shadow-glow-cyan-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500 rounded text-cyan-100 font-medium flex items-center justify-center gap-2 transition-all shadow-glow-cyan-sm disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? t('auth.verifying') : (tab === 'login' ? t('auth.authenticate') : t('auth.createAccount'))}
            </button>
          </form>

          {tab === 'login' && (
            <div className="mt-6 pt-4 border-t border-cyan-500/20">
              <div className="text-xs text-slate-400 text-center mb-3">
                {t('auth.devHint')}
              </div>
              <button
                type="button"
                onClick={quickDevLogin}
                disabled={loading}
                className="w-full py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
              >
                {t('auth.devQuick')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
