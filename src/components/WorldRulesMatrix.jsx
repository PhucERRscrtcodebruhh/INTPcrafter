import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Scale, 
  Filter, 
  RefreshCw, 
  Tag, 
  FileText, 
  Edit3, 
  Check, 
  Save,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { ClientRAGService } from '../services/ragEngine';
import { api } from '../services/api';

const CATEGORIES = ['All', 'Character', 'MagicSystem', 'Location', 'Timeline', 'Faction', 'General'];

export default function WorldRulesMatrix({ book, onEntriesUpdated }) {
  const [rulesEntries, setRulesEntries] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingRulesText, setEditingRulesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadRules = async () => {
    if (!book?.id) return;
    setIsLoading(true);
    try {
      const data = await ClientRAGService.getLorebook(book.id, selectedCategory, '');
      // Filter entries with rules or show all to allow attaching rules
      setRulesEntries(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [book?.id, selectedCategory]);

  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditingRulesText(entry.rules || '');
  };

  const handleSaveRules = async (entry) => {
    setIsSaving(true);
    try {
      await api.updateLore(entry.id, {
        ...entry,
        rules: editingRulesText
      });
      setEditingId(null);
      setNotification({ type: 'success', message: `Saved rules for "${entry.title}"` });
      setTimeout(() => setNotification(null), 2500);
      loadRules();
      onEntriesUpdated?.();
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to save rules: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const entriesWithRules = rulesEntries.filter(e => e.rules && e.rules.trim().length > 0);
  const entriesWithoutRules = rulesEntries.filter(e => !e.rules || e.rules.trim().length === 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 space-y-4 select-none font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Scale size={16} />
            <span>Deterministic Rules & Constraints Matrix — {book?.title}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Immutable physical laws, magic costs, causality bounds, and faction taboos strictly enforced during simulation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadRules}
            className="p-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Refresh rules"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-2.5 rounded text-xs flex items-center justify-between animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-glow-cyan-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rules Content Display */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {/* Active Invariant Constraints */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="flex items-center space-x-1.5 text-cyan-300">
              <ShieldAlert size={14} />
              <span>Active Physical & Logical Constraints ({entriesWithRules.length})</span>
            </span>
          </div>

          {entriesWithRules.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-lg border border-slate-800 text-slate-500 text-xs">
              No deterministic rules defined yet in this category for {book?.title}. Define rules below to bind AI causality.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entriesWithRules.map(entry => (
                <div 
                  key={entry.id}
                  className="glass-panel p-3.5 rounded-lg border border-cyan-500/25 bg-cyber-900/60 hover:border-cyan-400/50 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${ClientRAGService.getCategoryColor(entry.category)}`}>
                        {entry.category}
                      </span>
                      <h4 className="text-xs font-bold text-slate-100">{entry.title}</h4>
                    </div>

                    {editingId !== entry.id && (
                      <button
                        onClick={() => handleStartEdit(entry)}
                        className="text-slate-500 hover:text-cyan-300 transition-colors p-1"
                        title="Edit Constraints"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                  </div>

                  {editingId === entry.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={editingRulesText}
                        onChange={(e) => setEditingRulesText(e.target.value)}
                        placeholder="Define rules, costs, failure states, or LaTeX formulas..."
                        rows={4}
                        className="w-full bg-cyber-950 border border-cyan-500/40 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-300"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveRules(entry)}
                          disabled={isSaving}
                          className="flex items-center space-x-1 px-3 py-1 rounded bg-cyan-400 text-black text-[11px] font-bold hover:bg-cyan-300 shadow-glow-cyan-sm"
                        >
                          <Save size={12} />
                          <span>{isSaving ? 'Saving...' : 'Save Rule'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-cyber-950/80 border border-slate-800/80 text-[11px] text-cyan-200 font-mono leading-relaxed whitespace-pre-wrap">
                      {entry.rules}
                    </div>
                  )}

                  {entry.content && (
                    <p className="text-[10px] text-slate-500 line-clamp-2 italic">
                      Context: {entry.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entities lacking rules */}
        {entriesWithoutRules.length > 0 && (
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <AlertTriangle size={13} className="text-amber-400" />
              <span>Entities Without Boundary Constraints ({entriesWithoutRules.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              These entities do not yet impose hard logical limits. Click to bind rules.
            </p>

            <div className="flex flex-wrap gap-2">
              {entriesWithoutRules.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleStartEdit(entry)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-cyber-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${ClientRAGService.getCategoryColor(entry.category).split(' ')[1]}`} />
                  <span>{entry.title}</span>
                  <span className="text-[10px] text-cyan-400">+ Add Rule</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
