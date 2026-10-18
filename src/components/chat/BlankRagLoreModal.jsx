import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  BookMarked, 
  Check, 
  Eye, 
  Edit3, 
  Sparkles, 
  Clock, 
  ShieldAlert, 
  Plus, 
  Layers,
  FileText,
  RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { api } from '../../services/api';
import { estimateTokens, formatTokenCount } from '../../services/tokenEstimator';

const DEFAULT_JOURNAL_TEMPLATE = `# 📜 CHRONICLE TIMELINE & PLOT DIARY (BLANK RAG LORE)
*Nhật ký cốt truyện do bạn tự ghi chép. Nội dung này sẽ được bơm trực tiếp vào Tier 3 của AI Context để AI luôn nắm rõ các sự kiện, bí mật và diễn biến quan trọng.*

## ⚔️ Cốt Truyện & Tình Huống Hiện Tại
- **Thời gian / Địa điểm**: 
- **Mục tiêu cấp bách**: 
- **Tình trạng của nhóm**: 

## 🗺️ Các Sự Kiện Lớn Đã Diễn Ra (Timeline Milestones)
1. **Sự kiện 1**: 
2. **Sự kiện 2**: 

## 👥 Biến Chuyển Quan Hệ & Trạng Thái Nhân Vật
- **Nhân vật A**: 
- **Nhân vật B**: 

## 🔒 Bí Mật / Lời Hứa Chưa Tiết Lộ
- 
`;

export default function BlankRagLoreModal({
  isOpen,
  onClose,
  sessionId,
  bookId,
  sessionTitle = 'Active Chronicle',
  onJournalUpdated
}) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'unsaved' | 'saving'
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'editor' | 'preview'
  const autoSaveTimerRef = useRef(null);

  // Load journal when modal opens or sessionId changes
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    let isMounted = true;
    setIsLoading(true);

    api.getSessionJournal(sessionId)
      .then((data) => {
        if (!isMounted) return;
        const initialText = data?.blankRagLore || '';
        setContent(initialText);
        setSaveStatus('saved');
      })
      .catch((err) => {
        console.warn('[BlankRagLore] Failed to load session journal:', err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isOpen, sessionId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleContentChange = (newVal) => {
    setContent(newVal);
    setSaveStatus('unsaved');

    // Debounced autosave after 1200ms
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(newVal, true);
    }, 1200);
  };

  const handleSave = async (textToSave = content, isAuto = false) => {
    if (!sessionId || isSaving) return;
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await api.updateSessionJournal(sessionId, textToSave);
      setSaveStatus('saved');
      if (onJournalUpdated) {
        onJournalUpdated(textToSave);
      }
    } catch (err) {
      console.error('[BlankRagLore] Save error:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInsertSnippet = (snippet) => {
    const updated = content ? `${content.trim()}\n\n${snippet}` : snippet;
    handleContentChange(updated);
  };

  if (!isOpen) return null;

  const estimatedTokens = estimateTokens(content);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm select-none font-mono animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl h-[92vh] bg-[#020617] text-slate-200 border border-cyan-500/30 rounded-xl flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-3.5 border-b border-cyan-500/20 bg-[#020617]/95 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.25)]">
              <BookMarked size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                  Chronicle Journal (Blank RAG Lore)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-[#00f0ff]/40 text-[#00f0ff] font-bold">
                  Tier 3 User Memory
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Nhật ký sự kiện cốt truyện cho: <span className="text-cyan-300 font-mono font-semibold">{sessionTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status indicator */}
            <div className="text-[11px] flex items-center space-x-1.5">
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <Check size={13} />
                  <span>Đã lưu</span>
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-amber-400">Chưa lưu...</span>
              )}
              {saveStatus === 'saving' && (
                <span className="text-cyan-300 animate-pulse">Đang lưu...</span>
              )}
            </div>

            {/* Token Counter */}
            <div className="hidden sm:block text-[11px] px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">
              Tokens: <span className="text-[#00f0ff] font-bold">{formatTokenCount(estimatedTokens)}</span>
            </div>

            {/* Manual Save Button */}
            <button
              type="button"
              onClick={() => handleSave(content, false)}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs bg-cyan-950 border border-[#00f0ff]/40 text-[#00f0ff] hover:bg-cyan-900/60 font-bold flex items-center space-x-1.5 transition-all shadow-glow-cyan-sm active:scale-95 disabled:opacity-50"
            >
              <Save size={13} />
              <span>Lưu</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & View Modes */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Quick Snippets */}
          <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0">Chèn nhanh:</span>
            <button
              type="button"
              onClick={() => handleInsertSnippet('### ⚔️ [Biến cố mới]\n- **Thời điểm**: \n- **Diễn biến**: \n- **Hậu quả**: ')}
              className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300"
            >
              + Mốc sự kiện
            </button>
            <button
              type="button"
              onClick={() => handleInsertSnippet('### 👥 [Chuyển biến nhân vật]\n- **Nhân vật**: \n- **Tâm lý/Tình trạng**: \n- **Ân oán/Mối quan hệ**: ')}
              className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300"
            >
              + Quan hệ nhân vật
            </button>
            <button
              type="button"
              onClick={() => handleInsertSnippet('### 🔒 [Bí mật / Rule ẩn]\n- **Chi tiết**: ')}
              className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300"
            >
              + Bí mật
            </button>
            {!content.trim() && (
              <button
                type="button"
                onClick={() => handleContentChange(DEFAULT_JOURNAL_TEMPLATE)}
                className="px-2 py-0.5 rounded text-[10px] bg-[#00f0ff]/10 border border-[#00f0ff]/40 text-[#00f0ff] hover:bg-[#00f0ff]/20 font-bold"
              >
                + Áp dụng mẫu chuẩn
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                activeTab === 'editor'
                  ? 'bg-cyan-950 text-[#00f0ff] font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 size={12} className="inline mr-1" />
              Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`hidden sm:inline-block px-2.5 py-1 rounded text-xs transition-all ${
                activeTab === 'split'
                  ? 'bg-cyan-950 text-[#00f0ff] font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Song song
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                activeTab === 'preview'
                  ? 'bg-cyan-950 text-[#00f0ff] font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={12} className="inline mr-1" />
              Xem trước
            </button>
          </div>
        </div>

        {/* Editor & Preview Split Body */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Editor Pane */}
          {(activeTab === 'editor' || activeTab === 'split') && (
            <div className={`h-full flex flex-col ${activeTab === 'split' ? 'w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r border-slate-800' : 'w-full'}`}>
              <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/80 text-[10px] text-slate-500 flex justify-between items-center">
                <span>Markdown Editor (Hỗ trợ định dạng KaTeX $...$, danh sách, tiêu đề)</span>
                <span>{content.length} ký tự</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Nhập ghi chép sự kiện, diễn biến cốt truyện, bí mật nhân vật bằng Markdown..."
                className="flex-1 w-full bg-[#020617] text-slate-100 p-4 text-xs font-mono resize-none focus:outline-none placeholder-slate-600 leading-relaxed overflow-y-auto selection:bg-cyan-500/30"
              />
            </div>
          )}

          {/* Preview Pane */}
          {(activeTab === 'preview' || activeTab === 'split') && (
            <div className={`h-full flex flex-col ${activeTab === 'split' ? 'w-full sm:w-1/2' : 'w-full'}`}>
              <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/80 text-[10px] text-slate-500">
                Live Markdown Preview
              </div>
              <div className="flex-1 overflow-y-auto p-4 text-xs prose prose-invert prose-cyan max-w-none prose-p:leading-relaxed prose-headings:text-cyan-300 prose-strong:text-[#00f0ff] prose-code:text-cyan-200 bg-[#020617]/40">
                {content.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                    <FileText size={32} className="mb-2 opacity-50" />
                    <p>Nhật ký đang trống.</p>
                    <p className="text-[11px]">Bấm "+ Áp dụng mẫu chuẩn" ở trên hoặc bắt đầu gõ để ghi lại sự kiện cốt truyện.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3 border-t border-cyan-500/20 bg-[#020617] flex items-center justify-between shrink-0 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px]">
              Tự động bơm vào <strong className="text-cyan-300">Tier 3</strong> ở mỗi turn sinh truyện mà không làm lệch Cache Tier 1 + 2.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-white transition-all text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
