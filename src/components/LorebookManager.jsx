import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ShieldAlert, 
  Layers, 
  RefreshCw, 
  FileText,
  Tag
} from 'lucide-react';
import { ClientRAGService } from '../services/ragEngine';
import Modal from './Modal';

const CATEGORIES = ['All', 'Character', 'MagicSystem', 'Location', 'Timeline', 'Faction', 'General'];

export default function LorebookManager({ bookId, bookTitle, onEntriesUpdated }) {
  const [loreList, setLoreList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'Character',
    aliases: '',
    rules: '',
    content: ''
  });
  const [formError, setFormError] = useState('');

  const loadLore = async () => {
    setIsLoading(true);
    try {
      const data = await ClientRAGService.getLorebook(bookId, selectedCategory, searchQuery);
      setLoreList(data);
    } catch (err) {
      console.error('Failed to load lore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLore();
  }, [bookId, selectedCategory, searchQuery]);

  const handleOpenCreate = () => {
    setEditingEntry(null);
    setFormData({
      title: '',
      category: selectedCategory === 'All' ? 'Character' : selectedCategory,
      aliases: '',
      rules: '',
      content: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      category: entry.category,
      aliases: entry.aliases || '',
      rules: entry.rules || '',
      content: entry.content || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete canonical lore entry "${title}"?`)) {
      try {
        await ClientRAGService.deleteLoreEntry(id);
        loadLore();
        onEntriesUpdated?.();
      } catch (err) {
        alert('Failed to delete lore: ' + err.message);
      }
    }
  };

  const handleQuickCreateBlank = async () => {
    try {
      await ClientRAGService.saveLoreEntry({
        book_id: bookId,
        title: 'Untitled Lore ' + Date.now().toString().slice(-4),
        category: 'General',
        aliases: '',
        rules: '',
        content: ''
      });
      loadLore();
      onEntriesUpdated?.();
    } catch (err) {
      alert('Failed to create blank lore: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }

    try {
      await ClientRAGService.saveLoreEntry({
        ...formData,
        book_id: bookId,
        id: editingEntry?.id
      });
      setIsModalOpen(false);
      loadLore();
      onEntriesUpdated?.();
    } catch (err) {
      setFormError(err.message || 'Failed to save lore');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 space-y-4 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-cyan-500/15">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Layers size={16} />
            <span>Lorebook Knowledge Base {bookTitle ? `— ${bookTitle}` : ''}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Define entities, factions, laws of physics, and logical constraints retrieved by the RAG engine for this world.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadLore}
            className="p-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Refresh database"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleQuickCreateBlank}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyber-900 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-950 transition-all"
            title="Create empty lore entry instantly"
          >
            <Plus size={14} />
            <span>+ Quick Blank Entry</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 shadow-glow-cyan-sm transition-all"
          >
            <Plus size={14} />
            <span>New Canon Entry</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-semibold shadow-glow-cyan-sm'
                  : 'bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search lore, aliases, rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-cyber-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Lore Entries Grid / List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loreList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 glass-panel rounded-lg">
            No lore entries found in this category. Click "New Canon Entry" to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loreList.map(entry => {
              const catColor = ClientRAGService.getCategoryColor(entry.category);

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-lg glass-panel-subtle border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                          {entry.title}
                        </h3>
                        {entry.aliases && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono mt-0.5">
                            <Tag size={10} className="text-slate-500" />
                            <span>{entry.aliases}</span>
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] border uppercase font-semibold ${catColor}`}>
                        {entry.category}
                      </span>
                    </div>

                    {/* Rules */}
                    {entry.rules && (
                      <div className="p-2 rounded bg-amber-950/25 border border-amber-500/20 text-amber-200 text-[11px] font-mono leading-relaxed">
                        <span className="text-[10px] text-amber-400 font-bold block mb-0.5">
                          RULES & CONSTRAINTS:
                        </span>
                        <div className="line-clamp-3">
                          {entry.rules}
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    {entry.content && (
                      <div className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">
                        {entry.content}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: #{entry.id}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenEdit(entry)}
                        className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Edit entry"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.title)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntry ? `Edit Lore: ${editingEntry.title}` : 'Create New Canon Lore Entry'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Entity / Lore Title *</label>
              <input
                type="text"
                placeholder="e.g. Kaelen Vance, Flux Burn, Sector 07"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-cyber-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-cyber-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat} className="bg-cyber-900">{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Aliases */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block">
              Aliases & Synonyms (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Kael, The Spire Weaver, Unit 404"
              value={formData.aliases}
              onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
              className="w-full bg-cyber-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Invariant Rules */}
          <div className="space-y-1">
            <label className="text-amber-400 font-semibold flex items-center space-x-1">
              <ShieldAlert size={13} />
              <span>Rules & Deterministic Constraints</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. RULE 1: Cannot generate aether without conductor. RULE 2: Cold iron blocks all resonance."
              value={formData.rules}
              onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
              className="w-full bg-cyber-950 border border-amber-500/30 rounded px-3 py-2 text-amber-100 focus:outline-none focus:border-amber-400 font-mono text-xs"
            />
          </div>

          {/* Canonical Content */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block">Canonical Lore & Narrative Details</label>
            <textarea
              rows={5}
              placeholder="Detailed lore description, historical context, psychological traits, and causal mechanics..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full bg-cyber-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs leading-relaxed"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded bg-cyber-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-cyan-400 text-black font-semibold hover:bg-cyan-300 shadow-glow-cyan-sm"
            >
              {editingEntry ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
