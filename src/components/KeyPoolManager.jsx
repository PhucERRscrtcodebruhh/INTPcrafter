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
  Info,
  Activity,
  Globe,
  Cpu,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { GeminiPoolService } from '../services/geminiPool';
import { api } from '../services/api';

const PROVIDERS = [
  { 
    id: 'gemini', 
    name: 'Google Gemini', 
    badge: 'Flagship 1M-2M', 
    icon: '🔷', 
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40',
    placeholder: 'AIzaSy...',
    endpoint: 'https://generativelanguage.googleapis.com',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
  { 
    id: 'deepseek', 
    name: 'DeepSeek AI', 
    badge: 'OpenAI-Compatible', 
    icon: '🟣', 
    color: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
    placeholder: 'sk-... (DeepSeek API Key)',
    endpoint: 'https://api.deepseek.com/v1',
    docsUrl: 'https://platform.deepseek.com/api_keys'
  },
  { 
    id: 'openrouter', 
    name: 'OpenRouter', 
    badge: 'Universal Router', 
    icon: '🌐', 
    color: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
    placeholder: 'sk-or-v1-... (OpenRouter API Key)',
    endpoint: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys'
  },
  { 
    id: 'huggingface', 
    name: 'Hugging Face', 
    badge: 'Serverless Inference', 
    icon: '🤗', 
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    placeholder: 'hf_... (Hugging Face User Access Token)',
    endpoint: 'https://api-inference.huggingface.co/v1',
    docsUrl: 'https://huggingface.co/settings/tokens'
  }
];

export default function KeyPoolManager() {
  const [activeProvider, setActiveProvider] = useState('gemini');
  const [keysList, setKeysList] = useState([]);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  
  const getDraftKey = (prov) => `storycontainer_key_drafts_${prov}`;

  const [rawKeyInputs, setRawKeyInputs] = useState(() => {
    try {
      const saved = localStorage.getItem(getDraftKey('gemini'));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['', '', '', '', ''];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [notification, setNotification] = useState(null);

  const currentProviderConfig = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];

  const loadKeys = async (isBackground = false, targetProvider = activeProvider) => {
    if (!isBackground) setIsLoading(true);
    try {
      const data = await GeminiPoolService.getKeysStatus(targetProvider);
      setKeysList(data || []);
    } catch (err) {
      console.error('Failed to load key pool:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Switch drafts when activeProvider changes
    try {
      const saved = localStorage.getItem(getDraftKey(activeProvider));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRawKeyInputs(parsed);
        } else {
          setRawKeyInputs(['', '', '']);
        }
      } else {
        setRawKeyInputs(activeProvider === 'gemini' ? ['', '', '', '', ''] : ['', '']);
      }
    } catch {
      setRawKeyInputs(['', '']);
    }

    loadKeys(false, activeProvider);
  }, [activeProvider]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadKeys(true, activeProvider);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeProvider]);

  const handleInputChange = (index, value) => {
    const updated = [...rawKeyInputs];
    updated[index] = value;
    setRawKeyInputs(updated);
    try {
      localStorage.setItem(getDraftKey(activeProvider), JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddKeyInput = () => {
    if (rawKeyInputs.length < 10) {
      const updated = [...rawKeyInputs, ''];
      setRawKeyInputs(updated);
      try {
        localStorage.setItem(getDraftKey(activeProvider), JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleRemoveKeyInput = (index) => {
    if (rawKeyInputs.length > 1) {
      const updated = rawKeyInputs.filter((_, i) => i !== index);
      setRawKeyInputs(updated);
      try {
        localStorage.setItem(getDraftKey(activeProvider), JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleSaveKeys = async () => {
    const validKeys = rawKeyInputs.map(k => k.trim()).filter(Boolean);
    if (validKeys.length === 0) {
      setNotification({ type: 'error', message: `Please enter at least one valid ${currentProviderConfig.name} Key.` });
      return;
    }

    setIsSaving(true);
    try {
      await GeminiPoolService.saveKeys(validKeys, activeProvider, customBaseUrl || null);
      setNotification({ type: 'success', message: `Successfully saved ${validKeys.length} keys for ${currentProviderConfig.name}.` });
      const cleanInputs = activeProvider === 'gemini' ? ['', '', '', '', ''] : ['', ''];
      setRawKeyInputs(cleanInputs);
      try {
        localStorage.removeItem(getDraftKey(activeProvider));
      } catch (e) {}
      loadKeys(false, activeProvider);
    } catch (err) {
      setNotification({ type: 'error', message: 'Save failed: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!keyId) return;
    try {
      await api.removeKey(keyId);
      setNotification({ type: 'success', message: `Key #${keyId} removed from pool.` });
      loadKeys(false, activeProvider);
    } catch (err) {
      setNotification({ type: 'error', message: 'Remove failed: ' + err.message });
    }
  };

  const handleResetStatuses = async () => {
    try {
      await GeminiPoolService.resetPool(activeProvider);
      loadKeys(false, activeProvider);
      setNotification({ type: 'success', message: `All ${currentProviderConfig.name} cooldowns and error flags have been reset.` });
    } catch (err) {
      setNotification({ type: 'error', message: 'Reset failed: ' + err.message });
    }
  };

  const handleTestKey = async (keyString, id) => {
    setTestingKeyId(id);
    try {
      const res = await GeminiPoolService.testKey(keyString, activeProvider, customBaseUrl || null);
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-5 select-none font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <KeyRound size={16} />
            <span>Multi-Provider LLM Key Vault</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Round-Robin key pool rotation across Gemini, DeepSeek, OpenRouter, and Hugging Face with automatic 503 cross-provider failover.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetStatuses}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs transition-all"
            title="Reset cooldowns and errors for active provider"
          >
            <RotateCcw size={13} />
            <span>Reset Cooldowns</span>
          </button>
          <button
            onClick={() => loadKeys(false, activeProvider)}
            className="p-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-cyan-300"
            title="Refresh status"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PROVIDERS.map(prov => {
          const isSelected = activeProvider === prov.id;
          return (
            <button
              key={prov.id}
              onClick={() => setActiveProvider(prov.id)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? `${prov.color} shadow-glow-cyan-sm ring-1 ring-cyan-400/50`
                  : 'bg-cyber-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-base">{prov.icon}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyber-900 border border-slate-700 text-slate-300">
                  {prov.badge}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-100">{prov.name}</span>
              <span className="text-[10px] text-slate-500 truncate mt-0.5">{prov.endpoint}</span>
            </button>
          );
        })}
      </div>

      {/* Cross-Provider Failover Banner */}
      <div className="p-3 rounded-lg bg-cyber-950 border border-purple-500/30 flex items-start space-x-3 text-xs">
        <ArrowRightLeft size={16} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="flex-1 font-sans">
          <span className="font-bold text-purple-300 font-mono">Automatic Cross-Provider Failover Enabled: </span>
          <span className="text-slate-300">
            Nếu Google Gemini gặp sự cố quá tải (503 Service Unavailable) hoặc cạn quota tất cả key, hệ thống sẽ tự động chuyển tiếp (failover) sang key <b>DeepSeek</b> hoặc <b>OpenRouter</b> của bạn để không ngắt quãng quá trình viết tiểu thuyết.
          </span>
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
            <span className="text-slate-500 block text-[10px] uppercase font-bold">{currentProviderConfig.name} Keys</span>
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <span>{currentProviderConfig.icon}</span>
            <span>{currentProviderConfig.name} Vault Status</span>
          </h3>
          <a
            href={currentProviderConfig.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1"
          >
            <span>Get {currentProviderConfig.name} Key ↗</span>
          </a>
        </div>

        {keysList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 glass-panel rounded-lg border border-slate-800">
            Chưa có API Key nào cho {currentProviderConfig.name}. Nhập key vào biểu mẫu bên dưới để kích hoạt.
          </div>
        ) : (
          <div className="glass-panel rounded-lg overflow-hidden border border-cyan-500/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/15 bg-cyber-950/60 text-slate-400 text-[11px]">
                  <th className="p-3 font-semibold">KEY ID</th>
                  <th className="p-3 font-semibold">SIGNATURE</th>
                  <th className="p-3 font-semibold">STATUS</th>
                  <th className="p-3 font-semibold">CALLS / REQS</th>
                  <th className="p-3 font-semibold">429 HITS</th>
                  <th className="p-3 font-semibold">COOLDOWN / DETAILS</th>
                  <th className="p-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {keysList.map(keyObj => {
                  const statusStyle = GeminiPoolService.formatKeyStatus(keyObj.status);
                  return (
                    <tr key={keyObj.id} className="border-b border-slate-800/50 hover:bg-cyan-950/20 transition-colors">
                      <td className="p-3 font-mono text-cyan-300 font-bold">#{keyObj.id}</td>
                      <td className="p-3 font-mono text-slate-300">{keyObj.masked}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-mono">
                        <span className="text-emerald-400 font-bold">{keyObj.callCount}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-slate-400">{keyObj.requestCount}</span>
                      </td>
                      <td className="p-3 font-mono">
                        {keyObj.rateLimitCount > 0 ? (
                          <span className="text-amber-400 font-bold">{keyObj.rateLimitCount} hits</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {keyObj.cooldownSecondsRemaining > 0 ? (
                          <span className="text-amber-300 font-bold">
                            Cooldown: {keyObj.cooldownSecondsRemaining}s
                          </span>
                        ) : keyObj.errorMsg ? (
                          <span className="text-rose-400 truncate max-w-[200px] inline-block" title={keyObj.errorMsg}>
                            {keyObj.errorMsg}
                          </span>
                        ) : (
                          <span className="text-slate-500">Ready</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteKey(keyObj.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-cyber-950 transition-colors"
                          title="Remove key"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Setup Form */}
      <div className="glass-panel p-4 sm:p-5 rounded-lg border border-cyan-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Plus size={14} className="text-cyan-400" />
            <span>Thêm Key cho {currentProviderConfig.name}</span>
          </h3>
          <span className="text-[11px] text-slate-500">Mã hóa AES-256 & SHA-256 an toàn</span>
        </div>

        {/* Custom Base URL (optional for OpenRouter / custom proxies) */}
        {activeProvider !== 'gemini' && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Custom Endpoint Base URL (Tùy chọn / Để trống sẽ dùng mặc định: <span className="text-cyan-400">{currentProviderConfig.endpoint}</span>)
            </label>
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder={currentProviderConfig.endpoint}
              className="w-full bg-cyber-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 outline-none"
            />
          </div>
        )}

        <div className="space-y-2">
          {rawKeyInputs.map((val, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <span className="text-[11px] font-mono text-slate-500 w-6 text-right">#{idx + 1}</span>
              <input
                type="password"
                value={val}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                placeholder={currentProviderConfig.placeholder}
                className="flex-1 bg-cyber-950 border border-slate-800 focus:border-cyan-500/50 rounded px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestKey(val, `input_${idx}`)}
                disabled={!val.trim() || testingKeyId === `input_${idx}`}
                className="px-2.5 py-1.5 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-[11px] text-slate-300 hover:text-cyan-300 disabled:opacity-40 flex items-center space-x-1"
                title="Test key connection"
              >
                <Play size={11} className={testingKeyId === `input_${idx}` ? 'animate-spin' : ''} />
                <span>Test</span>
              </button>
              {rawKeyInputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveKeyInput(idx)}
                  className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-cyber-950"
                  title="Remove row"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Test Result Banners */}
        {Object.entries(testResults).map(([id, res]) => (
          <div key={id} className={`p-2.5 rounded text-xs flex items-center justify-between ${
            res.success 
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
          }`}>
            <span className="font-mono">
              [{id}]: {res.success ? `✓ Test Thành Công (${res.model || activeProvider}) - Phản hồi: "${res.response}"` : `✗ Lỗi Test: ${res.error}`}
            </span>
            <button onClick={() => setTestResults(prev => { const n = { ...prev }; delete n[id]; return n; })} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-2">
          {rawKeyInputs.length < 10 && (
            <button
              type="button"
              onClick={handleAddKeyInput}
              className="flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <Plus size={13} />
              <span>+ Thêm dòng key</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveKeys}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-glow-cyan transition-all flex items-center space-x-1.5 disabled:opacity-50 ml-auto"
          >
            <ShieldCheck size={14} />
            <span>{isSaving ? 'Đang Lưu...' : `Lưu Key ${currentProviderConfig.name}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
