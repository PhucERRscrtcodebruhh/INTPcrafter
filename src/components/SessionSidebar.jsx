import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function SessionSidebar({
  sessions = [],
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  isCollapsed,
  onToggleCollapse
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = async (e, id) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (newTitle.trim()) {
      await onCreateSession(newTitle.trim());
      setNewTitle('');
      setIsCreating(false);
    }
  };

  if (isCollapsed) {
    return (
      <aside className="w-12 h-full border-r border-cyan-500/20 bg-cyber-900/80 flex flex-col items-center py-4 space-y-4 select-none">
        <button
          onClick={onToggleCollapse}
          title="Expand Chronicles Sidebar"
          className="p-2 rounded hover:bg-cyber-800 text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => onCreateSession('New Chronicle')}
          title="Quick New Session"
          className="p-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 shadow-glow-cyan-sm transition-all"
        >
          <Plus size={18} />
        </button>
        <div className="flex-1 overflow-y-auto space-y-2 w-full flex flex-col items-center">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              title={s.title}
              className={`w-8 h-8 rounded flex items-center justify-center text-xs transition-colors ${
                s.id === activeSessionId
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:bg-cyber-800 hover:text-slate-200'
              }`}
            >
              <MessageSquare size={14} />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 sm:w-72 h-full border-r border-cyan-500/20 bg-cyber-900/90 flex flex-col select-none z-20">
      {/* Top Header */}
      <div className="p-3 border-b border-cyan-500/15 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles size={15} className="text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Chronicles
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyber-950 text-slate-400 border border-slate-800">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsCreating(!isCreating)}
            title="Create New Chronicle Session"
            className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-cyber-800"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Quick create inline form */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-cyan-500/15 bg-cyber-950/60 flex space-x-1">
          <input
            type="text"
            placeholder="Chronicle Title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            className="flex-1 bg-cyber-900 text-xs px-2 py-1.5 rounded border border-cyan-500/30 text-slate-200 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-2.5 py-1 bg-cyan-500 text-black text-xs font-semibold rounded hover:bg-cyan-400"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </form>
      )}

      {/* Search Bar */}
      <div className="p-2 border-b border-cyan-500/10">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-cyber-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No chronicles found.
          </div>
        ) : (
          filteredSessions.map(session => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer border transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-glow-cyan-sm font-medium'
                    : 'border-transparent text-slate-400 hover:bg-cyber-850 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0 pr-1">
                  <MessageSquare size={13} className={isActive ? 'text-cyan-400 shrink-0' : 'text-slate-600 shrink-0'} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(e, session.id);
                        if (e.key === 'Escape') handleCancelRename(e);
                      }}
                      autoFocus
                      className="w-full bg-cyber-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-slate-100"
                    />
                  ) : (
                    <span className="truncate">{session.title}</span>
                  )}
                </div>

                {/* Right action icons */}
                {isEditing ? (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={(e) => handleSaveRename(e, session.id)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={handleCancelRename}
                      className="p-1 text-slate-400 hover:text-slate-200"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 shrink-0">
                    {session.message_count > 0 && (
                      <span className="text-[10px] text-slate-500 px-1 group-hover:hidden">
                        {session.message_count}
                      </span>
                    )}
                    <div className="hidden group-hover:flex items-center space-x-1">
                      <button
                        onClick={(e) => handleStartRename(e, session)}
                        title="Rename Session"
                        className="p-1 text-slate-400 hover:text-cyan-300"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        title="Delete Session"
                        className="p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Button */}
      <div className="p-2 border-t border-cyan-500/15">
        <button
          onClick={() => onCreateSession('New Chronicle')}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/50 text-xs font-semibold transition-all shadow-glow-cyan-sm"
        >
          <Plus size={14} />
          <span>New Chronicle Session</span>
        </button>
      </div>
    </aside>
  );
}
