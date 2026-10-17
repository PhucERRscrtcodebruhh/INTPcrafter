import React from 'react';
import { Globe, Check } from 'lucide-react';
import Modal from './Modal';

const LANGUAGES = [
  { code: 'vi', label: '🇻🇳 Tiếng Việt', desc: 'Giao diện và văn phong tiếng Việt mặc định' },
  { code: 'en', label: '🇺🇸 English', desc: 'Standard English interface and prompts' },
  { code: 'zh', label: '🇨🇳 中文', desc: '简体中文界面与提示词' },
  { code: 'ko', label: '🇰🇷 한국어', desc: '한국어 인터페이스 및 프롬프트' },
];

export default function LanguageModal({ isOpen, onClose, language = 'vi', onLanguageChange }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Language & Localization (A/文)"
      maxWidth="max-w-md"
    >
      <div className="space-y-3 font-mono select-none text-xs">
        <p className="text-slate-400 font-sans text-xs">
          Chọn ngôn ngữ giao diện và hướng dẫn văn phong mặc định của Engine:
        </p>

        <div className="space-y-2">
          {LANGUAGES.map(lang => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  onLanguageChange?.(lang.code);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-glow-cyan-sm font-semibold'
                    : 'bg-cyber-950/60 border-slate-800 text-slate-300 hover:bg-cyber-900 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-100">{lang.label}</div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">{lang.desc}</div>
                </div>
                {isSelected && <Check size={16} className="text-cyan-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
