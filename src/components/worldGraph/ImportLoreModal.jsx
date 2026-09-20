import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Search, 
  CheckSquare, 
  Square, 
  Grid, 
  Layers, 
  User, 
  Zap, 
  MapPin, 
  Clock, 
  FileText, 
  Check, 
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';
import Modal from '../Modal';
import { api } from '../../services/api';

const CATEGORY_COLORS = {
  Character: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40',
  MagicSystem: 'border-purple-500/40 text-purple-300 bg-purple-950/40',
  Location: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40',
  Event: 'border-amber-500/40 text-amber-300 bg-amber-950/40',
  General: 'border-slate-600 text-slate-300 bg-slate-900/60'
};

const CATEGORY_ICONS = {
  Character: User,
  MagicSystem: Zap,
  Location: MapPin,
  Event: Clock,
  General: FileText
};

export default function ImportLoreModal({
  isOpen,
  onClose,
  activeBookId,
  existingNodes = [],
  onImportNodes
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [autoLayoutGrid, setAutoLayoutGrid] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch lore entries for active world
  const fetchEntries = async () => {
    if (!activeBookId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      let data = [];
      try {
        data = await api.getBookEntries(activeBookId);
      } catch {
        data = await api.getLore({ worldId: activeBookId });
      }
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg('Failed to load lore entries: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
      setSelectedEntryIds(new Set());
      setSearchTerm('');
      setSelectedCategory('All');
    }
  }, [isOpen, activeBookId]);

  // Set of titles/IDs already on Canvas
  const existingOnCanvasSet = useMemo(() => {
    const set = new Set();
    existingNodes.forEach(node => {
      if (node.data?.loreEntryId) set.add(String(node.data.loreEntryId));
      if (node.id?.startsWith('lore_')) set.add(node.id.replace('lore_', ''));
      const name = (node.data?.name || node.data?.systemName || node.data?.eventTitle || '').trim().toLowerCase();
      if (name) set.add(name);
    });
    return set;
  }, [existingNodes]);

  const isEntryOnCanvas = (entry) => {
    if (existingOnCanvasSet.has(String(entry.id))) return true;
    if (entry.title && existingOnCanvasSet.has(entry.title.trim().toLowerCase())) return true;
    return false;
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const titleMatch = e.title?.toLowerCase().includes(term);
        const aliasesMatch = (typeof e.aliases === 'string' ? e.aliases : JSON.stringify(e.aliases || '')).toLowerCase().includes(term);
        const contentMatch = (e.content || e.canonicalLore || '').toLowerCase().includes(term);
        if (!titleMatch && !aliasesMatch && !contentMatch) return false;
      }
      return true;
    });
  }, [entries, selectedCategory, searchTerm]);

  // Available (not on canvas) entries in current filter
  const availableFilteredEntries = useMemo(() => {
    return filteredEntries.filter(e => !isEntryOnCanvas(e));
  }, [filteredEntries, existingOnCanvasSet]);

  const handleToggleSelect = (id) => {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEntryIds(next);
  };

  const handleSelectAllAvailable = () => {
    const next = new Set(selectedEntryIds);
    const allAvailableSelected = availableFilteredEntries.every(e => next.has(e.id));

    if (allAvailableSelected) {
      availableFilteredEntries.forEach(e => next.delete(e.id));
    } else {
      availableFilteredEntries.forEach(e => next.add(e.id));
    }
    setSelectedEntryIds(next);
  };

  const handleConfirmImport = () => {
    const toImport = entries.filter(e => selectedEntryIds.has(e.id));
    if (toImport.length === 0) return;
    onImportNodes(toImport, autoLayoutGrid);
    onClose();
  };

  const isAllAvailableSelected = availableFilteredEntries.length > 0 && availableFilteredEntries.every(e => selectedEntryIds.has(e.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Lorebook Entries to Canvas"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-xs font-mono select-none">
        {/* Header summary & refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/15">
          <div className="text-slate-300 font-sans">
            Chọn các thực thể tri thức (Lore Entries) từ World hiện tại để chuyển thành Node trên Canvas thị giác.
          </div>
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="px-2 py-1 rounded bg-cyber-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 flex items-center space-x-1 transition-all"
            title="Refresh database lore list"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, aliases, or details..."
              className="w-full bg-cyber-950 border border-slate-800 focus:border-cyan-500/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Character', 'MagicSystem', 'Location', 'Event', 'General'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 rounded text-[11px] whitespace-nowrap border transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-glow-cyan-sm'
                    : 'bg-cyber-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'MagicSystem' ? 'System' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Action / Select-All & Grid Layout Settings Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-cyber-950 border border-slate-800 text-[11px]">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAllAvailable}
              disabled={availableFilteredEntries.length === 0}
              className="flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300 font-bold disabled:opacity-40 transition-colors"
            >
              {isAllAvailableSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>
                {isAllAvailableSelected ? 'Deselect All' : `Select All Available (${availableFilteredEntries.length})`}
              </span>
            </button>

            <span className="text-slate-600">|</span>

            <span className="text-slate-400">
              Selected: <b className="text-cyan-300 font-mono">{selectedEntryIds.size}</b>
            </span>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-slate-100">
            <input
              type="checkbox"
              checked={autoLayoutGrid}
              onChange={(e) => setAutoLayoutGrid(e.target.checked)}
              className="accent-cyan-400 rounded"
            />
            <Grid size={13} className="text-cyan-400" />
            <span>Auto-layout imported nodes in grid</span>
          </label>
        </div>

        {/* Entries List */}
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
              <RefreshCw size={20} className="animate-spin text-cyan-400" />
              <span>Loading world lorebook entries...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-lg">
              No matching lore entries found in this world.
            </div>
          ) : (
            filteredEntries.map(entry => {
              const onCanvas = isEntryOnCanvas(entry);
              const isSelected = selectedEntryIds.has(entry.id);
              const CatIcon = CATEGORY_ICONS[entry.category] || FileText;
              const catBadgeStyle = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.General;

              return (
                <div
                  key={entry.id}
                  onClick={() => !onCanvas && handleToggleSelect(entry.id)}
                  className={`p-3 rounded-lg border transition-all flex items-start space-x-3 ${
                    onCanvas
                      ? 'bg-cyber-950/40 border-slate-850 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-cyan-950/30 border-cyan-400 shadow-glow-cyan-sm cursor-pointer ring-1 ring-cyan-500/40'
                      : 'bg-cyber-900/70 border-slate-800 hover:border-cyan-500/30 hover:bg-cyber-900 cursor-pointer'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    {onCanvas ? (
                      <div className="w-4 h-4 rounded border border-slate-700 bg-slate-800/60 flex items-center justify-center text-slate-500" title="Already on Canvas">
                        <Check size={11} />
                      </div>
                    ) : (
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-cyan-400 border-cyan-400 text-black font-bold' : 'border-slate-600 bg-cyber-950'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                    )}
                  </div>

                  {/* Icon & Category Pill */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-100 truncate">
                        {entry.title}
                      </span>

                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex items-center space-x-1 ${catBadgeStyle}`}>
                        <CatIcon size={10} />
                        <span>{entry.category}</span>
                      </span>

                      {onCanvas && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">
                          Already on Canvas
                        </span>
                      )}

                      {entry.metadata?.realmOrLevel && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                          {entry.metadata.realmOrLevel}
                        </span>
                      )}

                      {entry.metadata?.type && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-950 border border-purple-500/30 text-purple-300">
                          {entry.metadata.type}
                        </span>
                      )}
                    </div>

                    {/* Aliases */}
                    {entry.aliases && (
                      <div className="text-[10px] text-slate-400 mb-1 truncate font-mono">
                        <span className="text-slate-500">Aliases: </span>
                        {typeof entry.aliases === 'string' ? entry.aliases : JSON.stringify(entry.aliases)}
                      </div>
                    )}

                    {/* Content snippet */}
                    <div className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                      {entry.content || entry.canonicalLore || entry.rules || 'No detailed lore content recorded.'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-cyan-500/15">
          <div className="text-slate-400 text-xs font-sans">
            {selectedEntryIds.size > 0 ? (
              <span>Sẵn sàng chuyển đổi <b className="text-cyan-300 font-mono">{selectedEntryIds.size}</b> thực thể thành Node.</span>
            ) : (
              <span>Chọn ít nhất 1 thực thể tri thức để bắt đầu import.</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-cyber-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={selectedEntryIds.size === 0}
              className="px-4 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black font-bold text-xs flex items-center space-x-1.5 shadow-glow-cyan transition-all"
            >
              <Download size={13} />
              <span>Import {selectedEntryIds.size > 0 ? `(${selectedEntryIds.size})` : ''} to Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
