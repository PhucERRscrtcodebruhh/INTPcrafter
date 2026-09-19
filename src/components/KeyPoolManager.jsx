import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Plus, 
  Trash2, 
  Play, 
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import { GeminiPoolService } from '../services/geminiPool';

export default function KeyPoolManager() {
  const [keysList, setKeysList] = useState([]);
  const [rawKeyInputs, setRawKeyInputs] = useState(['', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [notification, setNotification] = useState(null);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const data = await GeminiPoolService.getKeysStatus();
      setKeysList(data);
      if (data.length > 0 && rawKeyInputs.every(k => !k)) {
        // If empty inputs, prefill with existing masked placeholders or count
        const newInputs = data.map(() => '');
        while (newInputs.length < 5) newInputs.push('');
        setRawKeyInputs(newInputs);
      }
    } catch (err) {
      console.error('Failed to load key pool:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
    // Auto-refresh countdown every 5s
    const timer = setInterval(() => {
      loadKeys();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleInputChange = (index, value) => {
    const updated = [...rawKeyInputs];
    updated[index] = value;
    setRawKeyInputs(updated);
  };

  const handleAddKeyInput = () => {
    if (rawKeyInputs.length < 10) {
      setRawKeyInputs([...rawKeyInputs, '']);
    }
  };

  const handleRemoveKeyInput = (index) => {
    if (rawKeyInputs.length > 1) {
      const updated = rawKeyInputs.filter((_, i) => i !== index);
      setRawKeyInputs(updated);
    }
  };

  const handleSaveKeys = async () => {
    const validKeys = rawKeyInputs.map(k => k.trim()).filter(Boolean);
    if (validKeys.length === 0) {
      setNotification({ type: 'error', message: 'Please enter at least one valid Gemini API Key.' });
      return;
    }

    setIsSaving(true);
    try {
      await GeminiPoolService.saveKeys(validKeys);
      setNotification({ type: 'success', message: `Successfully saved ${validKeys.length} keys to secure pool.` });
      // Reset inputs to clean
      setRawKeyInputs(validKeys.map(() => ''));
      loadKeys();
    } catch (err) {
      setNotification({ type: 'error', message: 'Save failed: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetStatuses = async () => {
    try {
      await GeminiPoolService.resetPool();
      loadKeys();
      setNotification({ type: 'success', message: 'All key rate-limit cooldowns and error flags have been reset.' });
    } catch (err) {
      setNotification({ type: 'error', message: 'Reset failed: ' + err.message });
    }
  };

  const handleTestKey = async (keyString, id) => {
    setTestingKeyId(id);
    try {
      const res = await GeminiPoolService.testKey(keyString);
      setTestResults(prev => ({ ...prev, [id]: res }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error: err.message } }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const activeCount = keysList.filter(k => k.status === 'active').length;
  const rateLimitedCount = keysList.filter(k => k.status === 'rate_limited').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <KeyRound size={16} />
            <span>Dynamic API Key Rotation Pool</span>
          </h2>
          <p className="text-xs text-slate-400">
            Intelligent Round-Robin rotation across 5-10 Gemini API keys with automatic 429 quota fallback.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetStatuses}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs transition-all"
            title="Reset cooldowns and errors"
          >
            <RotateCcw size={13} />
            <span>Reset Cooldowns</span>
          </button>
          <button
            onClick={loadKeys}
            className="p-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-cyan-300"
            title="Refresh status"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded text-xs flex items-center justify-between ${
          notification.type === 'success' 
            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg glass-panel-subtle border border-cyan-500/20 flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Keys Registered</span>
            <span className="text-base font-bold text-slate-100">{keysList.length} / 10</span>
          </div>
          <KeyRound size={20} className="text-cyan-400 opacity-60" />
        </div>

        <div className="p-3 rounded-lg glass-panel-subtle border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Active & Ready</span>
            <span className="text-base font-bold text-emerald-400">{activeCount} keys</span>
          </div>
          <CheckCircle2 size={20} className="text-emerald-400 opacity-60" />
        </div>

        <div className="p-3 rounded-lg glass-panel-subtle border border-amber-500/20 flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Rate-Limited (Cooldown)</span>
            <span className="text-base font-bold text-amber-400">{rateLimitedCount} keys</span>
          </div>
          <AlertTriangle size={20} className="text-amber-400 opacity-60" />
        </div>
      </div>

      {/* Live Key Pool Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Current Pool Health & Live Telemetry
          </h3>
          <span className="text-[11px] text-slate-500">
            Auto-rotates next on each query or 429
          </span>
        </div>

        {keysList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 glass-panel rounded-lg">
            No API keys configured yet. Enter 5 to 10 Gemini API keys in the setup form below to enable generation.
          </div>
        ) : (
          <div className="glass-panel rounded-lg overflow-hidden border border-cyan-500/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/15 bg-cyber-950/60 text-slate-400 text-[11px]">
                  <th className="p-3 font-semibold">KEY ID</th>
                  <th className="p-3 font-semibold">KEY SIGNATURE</th>
                  <th className="p-3 font-semibold">STATUS</th>
                  <th className="p-3 font-semibold">TOTAL CALLS</th>
                  <th className="p-3 font-semibold">COOLDOWN / DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {keysList.map(k => {
                  const statusStyle = GeminiPoolService.formatKeyStatus(k.status);

                  return (
                    <tr key={k.id} className="hover:bg-cyber-900/40 transition-colors">
                      <td className="p-3 font-mono text-cyan-300 font-bold">
                        #{k.id}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {k.masked}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border font-semibold tracking-wide ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {k.callCount} calls
                      </td>
                      <td className="p-3 text-[11px] text-slate-400">
                        {k.status === 'rate_limited' && k.cooldownSecondsRemaining > 0 ? (
                          <span className="text-amber-400 font-mono flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span>Auto-recovers in {k.cooldownSecondsRemaining}s</span>
                          </span>
                        ) : k.errorMsg ? (
                          <span className="text-rose-400">{k.errorMsg}</span>
                        ) : (
                          <span className="text-emerald-400/80">Standing by</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Key Setup & Configuration Section */}
      <div className="glass-panel p-4 sm:p-5 rounded-lg border border-cyan-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Configure Key Rotation Pool (5 - 10 Keys)
            </h3>
            <p className="text-[11px] text-slate-400">
              Input 5 to 10 Gemini API Keys from Google AI Studio. Stored in MySQL and rotated in memory.
            </p>
          </div>
          <button
            onClick={handleAddKeyInput}
            disabled={rawKeyInputs.length >= 10}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyber-900 border border-slate-700 text-xs text-slate-300 hover:text-cyan-300 disabled:opacity-40"
          >
            <Plus size={12} />
            <span>Add Slot</span>
          </button>
        </div>

        <div className="space-y-2">
          {rawKeyInputs.map((val, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <span className="w-10 text-right font-mono text-slate-500 text-xs shrink-0">
                #{idx + 1}
              </span>
              <input
                type="password"
                placeholder={keysList[idx] ? `Saved Key (${keysList[idx].masked}) - enter new to replace` : `Paste Gemini API Key #${idx + 1}...`}
                value={val}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                className="flex-1 bg-cyber-950 border border-slate-800 focus:border-cyan-500/60 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none font-mono"
              />

              {/* Test key if input has value */}
              {val.trim() && (
                <button
                  type="button"
                  onClick={() => handleTestKey(val.trim(), `input_${idx}`)}
                  disabled={testingKeyId === `input_${idx}`}
                  className="px-2.5 py-1.5 rounded bg-cyber-900 border border-slate-800 text-cyan-400 hover:bg-cyan-950 text-xs font-mono shrink-0"
                  title="Test key connection"
                >
                  {testingKeyId === `input_${idx}` ? 'Testing...' : 'Test'}
                </button>
              )}

              {rawKeyInputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveKeyInput(idx)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Test result messages */}
        {Object.entries(testResults).map(([id, res]) => (
          <div key={id} className={`p-2.5 rounded text-xs font-mono ${
            res.success ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300' : 'bg-rose-950/50 border border-rose-500/40 text-rose-300'
          }`}>
            {res.success ? `✓ Key verified successfully! Model ping response: "${res.response}"` : `✗ Key check failed: ${res.error}`}
          </div>
        ))}

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSaveKeys}
            disabled={isSaving}
            className="flex items-center space-x-2 px-5 py-2 rounded bg-cyan-400 text-black font-semibold text-xs hover:bg-cyan-300 shadow-glow-cyan-sm transition-all"
          >
            <ShieldCheck size={14} />
            <span>{isSaving ? 'Saving Pool...' : 'Update & Save Key Pool'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
