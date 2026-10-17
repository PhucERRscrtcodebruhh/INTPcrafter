import React, { useState } from 'react';
import { 
  Globe, 
  Check, 
  BookOpen, 
  Sliders, 
  Plus, 
  ExternalLink,
  ShieldCheck,
  FileText
} from 'lucide-react';
import Modal from './Modal';
import WorldRulesMatrix from './WorldRulesMatrix';
import WorldInstructionEditor from './WorldInstructionEditor';

export default function WorldStateModal({
  isOpen,
  onClose,
  books = [],
  activeBookId = null,
  onLinkBook,
  onOpenLorebook
}) {
  const [subTab, setSubTab] = useState('select'); // 'select' | 'rules' | 'instruction'

  const activeBook = books.find(b => b.id === activeBookId) || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="World / Global State Matrix"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 font-mono select-none">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-b border-cyan-500/20 pb-2 text-xs">
          <button
            onClick={() => setSubTab('select')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
              subTab === 'select'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-900'
            }`}
          >
            <Globe size={13} />
            <span>Active World Container</span>
          </button>

          <button
            onClick={() => setSubTab('instruction')}
            disabled={!activeBook}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              subTab === 'instruction'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-900'
            }`}
          >
            <FileText size={13} />
            <span>World Instruction</span>
          </button>

          <button
            onClick={() => setSubTab('rules')}
            disabled={!activeBook}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              subTab === 'rules'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-900'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Rules Matrix</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenLorebook?.();
            }}
            className="ml-auto flex items-center space-x-1 px-2.5 py-1 text-xs text-cyan-400 hover:underline"
            title="Open Lorebook Dashboard"
          >
            <span>Full Lorebook</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Tab 1: Select Active World */}
        {subTab === 'select' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Chọn thế giới (World Container) liên kết với phiên chat hiện tại. Khi liên kết, động cơ RAG sẽ tự động truy xuất các thực thể, luật lệ và nhân vật thuộc thế giới này vào System Prompt.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1">
              {/* Option: Unlinked */}
              <div
                onClick={() => onLinkBook?.(null)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  !activeBookId
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Không liên kết (Unlinked)</span>
                  {!activeBookId && <Check size={14} className="text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Không tiêm lore tự động. Mô hình mô phỏng tự do.
                </p>
              </div>

              {/* Books list */}
              {books.map(b => {
                const isSelected = activeBookId === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => onLinkBook?.(b.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                        : 'bg-cyber-950/60 border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold truncate max-w-[180px]">{b.title}</span>
                      {isSelected && <Check size={14} className="text-cyan-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-sans">
                      {b.description || 'Chưa có mô tả'}
                    </p>
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{b.entry_count || 0} mục lore</span>
                      <span className="uppercase">{b.language || 'vi'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Instruction Editor for Active World */}
        {subTab === 'instruction' && activeBook && (
          <div className="space-y-3">
            <WorldInstructionEditor
              book={activeBook}
              onSaved={(updated) => {
                // Book updated callback
              }}
            />
          </div>
        )}

        {/* Tab 3: World Rules Matrix for Active World */}
        {subTab === 'rules' && activeBook && (
          <div className="space-y-3">
            <WorldRulesMatrix book={activeBook} />
          </div>
        )}
      </div>
    </Modal>
  );
}
