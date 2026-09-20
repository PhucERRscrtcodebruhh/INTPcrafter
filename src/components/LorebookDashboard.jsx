import React, { useState, useEffect } from 'react';
import { 
  Database, 
  KeyRound, 
  Cpu, 
  Layers, 
  ArrowLeft,
  Plus,
  BookOpen,
  Globe,
  Trash2,
  Edit3,
  Calendar,
  FileText,
  Scale,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  Network
} from 'lucide-react';
import LorebookManager from './LorebookManager';
import WorldRulesMatrix from './WorldRulesMatrix';
import WorldInstructionEditor from './WorldInstructionEditor';
import WorldGraphCanvas from './worldGraph/WorldGraphCanvas';
import KeyPoolManager from './KeyPoolManager';
import InstructionEditor from './InstructionEditor';
import Modal from './Modal';
import { api } from '../services/api';

const LANGUAGE_LABELS = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇺🇸 English',
  zh: '🇨🇳 中文',
  ko: '🇰🇷 한국어'
};

export default function LorebookDashboard({ onBackToStudio, books: externalBooks, onBooksChanged, activeBookId: externalActiveBookId, onSelectBook: externalOnSelectBook }) {
  // Top-level tab: 'worlds' | 'keys' | 'global_instruction'
  const [topTab, setTopTab] = useState('worlds');

  // Multi-World container state
  const [books, setBooks] = useState([]);
  const [activeBookId, setActiveBookId] = useState(externalActiveBookId || null);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);

  // Level 2 Dedicated Tab: 'lore' | 'rules' | 'instruction' | 'graph'
  const [worldWorkspaceTab, setWorldWorkspaceTab] = useState('lore');
  const [isGraphFocusMode, setIsGraphFocusMode] = useState(true);

  // Book Modal (Create / Edit)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    description: '',
    language: 'vi',
    system_instruction: ''
  });
  const [bookFormError, setBookFormError] = useState('');
  const [isSavingBook, setIsSavingBook] = useState(false);

  const loadBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const data = await api.getBooks();
      setBooks(data);
      onBooksChanged?.(data);

      // If activeBookId was deleted, reset it
      if (activeBookId && !data.some(b => b.id === activeBookId)) {
        setActiveBookId(null);
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const activeBook = books.find(b => b.id === activeBookId) || null;

  const handleSelectBook = (bookId) => {
    setActiveBookId(bookId);
    externalOnSelectBook?.(bookId);
  };

  const handleOpenCreateBook = () => {
    setEditingBook(null);
    setBookFormData({
      title: '',
      description: '',
      language: 'vi',
      system_instruction: ''
    });
    setBookFormError('');
    setIsBookModalOpen(true);
  };

  const handleOpenEditBook = (bookToEdit, e) => {
    e?.stopPropagation();
    setEditingBook(bookToEdit);
    setBookFormData({
      title: bookToEdit.title,
      description: bookToEdit.description || '',
      language: bookToEdit.language || 'vi',
      system_instruction: bookToEdit.system_instruction || ''
    });
    setBookFormError('');
    setIsBookModalOpen(true);
  };

  const handleDeleteBook = async (bookToDelete, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete World "${bookToDelete.title}" and all its canonical lore entries permanently?`)) {
      return;
    }
    try {
      await api.deleteBook(bookToDelete.id);
      if (activeBookId === bookToDelete.id) {
        setActiveBookId(null);
      }
      loadBooks();
    } catch (err) {
      alert('Failed to delete book: ' + err.message);
    }
  };

  const handleSaveBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookFormData.title.trim()) {
      setBookFormError('World / Book title is required');
      return;
    }

    setIsSavingBook(true);
    try {
      if (editingBook) {
        await api.updateBook(editingBook.id, bookFormData);
      } else {
        const created = await api.createBook(bookFormData);
        // Automatically enter newly created world
        setActiveBookId(created.id);
      }
      setIsBookModalOpen(false);
      loadBooks();
    } catch (err) {
      setBookFormError(err.message || 'Failed to save book');
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleBookUpdated = (updatedBook) => {
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    onBooksChanged?.(books);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-950 overflow-hidden font-mono select-none">
      {/* Top Navbar Switcher */}
      <div className="border-b border-cyan-500/20 bg-cyber-900/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToStudio}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyber-950 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Chat Studio</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-800" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            System Config & Multiverse Lore Matrix
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-cyber-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setTopTab('worlds')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              topTab === 'worlds'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={13} />
            <span>Worlds & Lore Matrix</span>
          </button>

          <button
            onClick={() => setTopTab('keys')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              topTab === 'keys'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={13} />
            <span>API Key Pool</span>
          </button>

          <button
            onClick={() => setTopTab('global_instruction')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
              topTab === 'global_instruction'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={13} />
            <span>Global Instruction</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {topTab === 'keys' && <KeyPoolManager />}
        {topTab === 'global_instruction' && <InstructionEditor />}

        {topTab === 'worlds' && (
          <>
            {/* LEVEL 1: WORLD SHOWCASE (When no world is active) */}
            {!activeBook ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Showcase Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
                  <div>
                    <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                      <Globe size={18} className="text-cyan-400" />
                      <span>Multiverse Container: Select or Create a World</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Each Book/World is a fully isolated knowledge container holding dedicated characters, magic systems, physics, and world rules.
                    </p>
                  </div>

                  <button
                    onClick={handleOpenCreateBook}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 shadow-glow-cyan transition-all"
                  >
                    <Plus size={15} />
                    <span>+ Create New Book / World</span>
                  </button>
                </div>

                {/* Grid of Worlds */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Create New Card (Prominent dashed card) */}
                  <div
                    onClick={handleOpenCreateBook}
                    className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 bg-cyber-950/40 hover:bg-cyan-950/20 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[190px]"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:shadow-glow-cyan transition-all mb-3">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 uppercase tracking-wider">
                      Create New World Container
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Set custom physics, lore, and narrative directives
                    </span>
                  </div>

                  {/* Existing World Cards */}
                  {books.map(b => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBook(b.id)}
                      className="glass-panel border border-cyan-500/20 hover:border-cyan-400/60 bg-cyber-900/60 hover:bg-cyber-900/90 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-glow-cyan group min-h-[190px]"
                    >
                      <div>
                        {/* Card Top Metadata */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold">
                              {LANGUAGE_LABELS[b.language] || b.language}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-cyber-950 border border-slate-800 text-slate-400 font-mono">
                              {b.entry_count || 0} Canon Entries
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleOpenEditBook(b, e)}
                              className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                              title="Edit World Meta"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteBook(b, e)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Delete World"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* World Title */}
                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors mb-2">
                          {b.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {b.description || 'No description provided. Click to define cosmological invariants and entities.'}
                        </p>
                      </div>

                      {/* Card Bottom CTA */}
                      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <span className="text-[10px]">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'Active'}
                        </span>
                        <span className="flex items-center space-x-1 text-cyan-400 font-semibold text-[11px] group-hover:translate-x-0.5 transition-transform">
                          <span>Enter World Workspace</span>
                          <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* LEVEL 2: ACTIVE WORLD WORKSPACE */
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* World Workspace Header */}
                <div className="border-b border-cyan-500/20 bg-cyber-900/60 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setActiveBookId(null)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyber-950 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-all shadow-glow-cyan-sm"
                    >
                      <ArrowLeft size={13} />
                      <span>← Back to Worlds / Switch</span>
                    </button>

                    <div className="h-4 w-[1px] bg-slate-800" />

                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm font-bold text-slate-100">
                          {activeBook.title}
                        </h2>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-semibold">
                          {LANGUAGE_LABELS[activeBook.language] || activeBook.language}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyber-950 border border-slate-800 text-slate-400 font-mono">
                          {activeBook.entry_count || 0} Entries
                        </span>
                      </div>
                      {activeBook.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {activeBook.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* World Action Buttons & Tabs */}
                  <div className="flex items-center space-x-2">
                    {/* Workspace Tabs */}
                    <div className="flex items-center bg-cyber-950 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setWorldWorkspaceTab('lore')}
                        className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
                          worldWorkspaceTab === 'lore'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layers size={13} />
                        <span>Lorebook Matrix</span>
                      </button>

                      <button
                        onClick={() => setWorldWorkspaceTab('rules')}
                        className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
                          worldWorkspaceTab === 'rules'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Scale size={13} />
                        <span>Rules & Constraints</span>
                      </button>

                      <button
                        onClick={() => setWorldWorkspaceTab('graph')}
                        className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
                          worldWorkspaceTab === 'graph'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Network size={13} />
                        <span>Visual World Graph</span>
                      </button>

                      <button
                        onClick={() => setWorldWorkspaceTab('instruction')}
                        className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all ${
                          worldWorkspaceTab === 'instruction'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Cpu size={13} />
                        <span>System Instruction</span>
                      </button>
                    </div>

                    {/* Edit Meta Modal Button */}
                    <button
                      onClick={(e) => handleOpenEditBook(activeBook, e)}
                      className="p-1.5 rounded bg-cyber-950 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                      title="Edit World Meta"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>

                {/* Level 2 Active Tab Panels */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {worldWorkspaceTab === 'lore' && (
                    <LorebookManager
                      bookId={activeBook.id}
                      bookTitle={activeBook.title}
                      onEntriesUpdated={loadBooks}
                    />
                  )}
                  {worldWorkspaceTab === 'rules' && (
                    <WorldRulesMatrix
                      book={activeBook}
                      onEntriesUpdated={loadBooks}
                    />
                  )}
                  {worldWorkspaceTab === 'graph' && (
                    <WorldGraphCanvas
                      activeBookId={activeBook.id}
                      activeBookTitle={activeBook.title}
                      isFocusMode={isGraphFocusMode}
                      onToggleFocus={() => setIsGraphFocusMode(!isGraphFocusMode)}
                      onExitFocus={() => setIsGraphFocusMode(false)}
                    />
                  )}
                  {worldWorkspaceTab === 'instruction' && (
                    <WorldInstructionEditor
                      book={activeBook}
                      onBookUpdated={handleBookUpdated}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Create or Edit World Container */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={editingBook ? `Edit World: ${editingBook.title}` : '+ Create New World Container'}
      >
        <form onSubmit={handleSaveBookSubmit} className="space-y-4 text-xs font-mono">
          {bookFormError && (
            <div className="p-2.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
              {bookFormError}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              World Title / Book Name *
            </label>
            <input
              type="text"
              value={bookFormData.title}
              onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
              placeholder="e.g. Cyberpunk 2099, Tu Tiên Giới, Nova Aethel..."
              className="w-full px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              World Synopsis & Background
            </label>
            <textarea
              value={bookFormData.description}
              onChange={(e) => setBookFormData({ ...bookFormData, description: e.target.value })}
              placeholder="Brief description of the setting, historical epoch, atmosphere, and cosmological foundation..."
              rows={3}
              className="w-full px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>

          {/* Target Language */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              Target Language
            </label>
            <select
              value={bookFormData.language}
              onChange={(e) => setBookFormData({ ...bookFormData, language: e.target.value })}
              className="w-full px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇺🇸 English</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ko">🇰🇷 한국어</option>
            </select>
          </div>

          {/* Initial World System Instruction */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block uppercase tracking-wider text-[11px]">
              Initial World System Instruction (Optional)
            </label>
            <textarea
              value={bookFormData.system_instruction}
              onChange={(e) => setBookFormData({ ...bookFormData, system_instruction: e.target.value })}
              placeholder="Specific directives for narrative perspective, prohibited tropes, and formatting guidelines..."
              rows={4}
              className="w-full px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsBookModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingBook}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 shadow-glow-cyan transition-all"
            >
              {isSavingBook ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{editingBook ? 'Save Changes' : 'Create World'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
