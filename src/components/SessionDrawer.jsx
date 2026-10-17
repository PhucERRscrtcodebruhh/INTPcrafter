import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Check, 
  Search, 
  Sparkles,
  Layers
} from 'lucide-react';

export default function SessionDrawer({
  isOpen,
  onClose,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  return (
    <div 
      className="fixed inset-0 z-50 flex bg-cyber-950/80 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="w-80 sm:w-96 h-full bg-cyber-900/95 border-r border-cyan-500/30 flex flex-col shadow-2xl backdrop-blur-md animate-slideInLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-cyan-500/20 bg-cyber-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <MessageSquare size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-1.5">
                <span>Chat Chronicles</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-mono">
                  {sessions.length}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Phiên hội thoại & câu chuyện đang lưu
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsCreating(!isCreating)}
              title="Tạo phiên mới"
              className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              title="Đóng (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-cyber-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick create inline form */}
        {isCreating && (
          <form onSubmit={handleCreateSubmit} className="p-3 border-b border-cyan-500/20 bg-cyber-950/80 flex space-x-1.5">
            <input
              type="text"
              placeholder="Tên phiên chat mới..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              className="flex-1 bg-cyber-900 text-xs px-2.5 py-1.5 rounded border border-cyan-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-400 text-black text-xs font-bold rounded hover:bg-cyan-300 transition-colors"
            >
              Tạo
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="p-1.5 text-slate-400 hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </form>
        )}

        {/* Search Bar */}
        <div className="p-3 border-b border-cyan-500/10 bg-cyber-950/40">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm kiếm phiên chat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-500/20">
          {filteredSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Không tìm thấy phiên chat nào.
            </div>
          ) : (
            filteredSessions.map(session => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer border transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                      : 'border-slate-800/60 bg-cyber-950/40 text-slate-400 hover:bg-cyber-850 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                    <MessageSquare size={14} className={isActive ? 'text-cyan-400 shrink-0' : 'text-slate-500 shrink-0'} />
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
                        className="w-full bg-cyber-950 border border-cyan-500/50 rounded px-2 py-0.5 text-xs text-slate-100 font-mono outline-none"
                      />
                    ) : (
                      <div className="truncate font-mono">
                        <div className="truncate">{session.title}</div>
                        {session.message_count > 0 && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            {session.message_count} tin nhắn
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isEditing ? (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => handleSaveRename(e, session.id)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Lưu"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-1 text-slate-400 hover:text-slate-200"
                        title="Hủy"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => handleStartRename(e, session)}
                        title="Đổi tên"
                        className="p-1 text-slate-500 hover:text-cyan-300 opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        title="Xóa phiên"
                        className="p-1 text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: New Session Button */}
        <div className="p-3 border-t border-cyan-500/20 bg-cyber-950/80">
          <button
            onClick={() => {
              onCreateSession('New Chronicle');
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-400 text-xs font-semibold transition-all shadow-glow-cyan-sm"
          >
            <Plus size={15} />
            <span>+ Tạo Phiên Chat Mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}
