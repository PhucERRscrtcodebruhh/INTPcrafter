import React from 'react';
import Modal from './Modal';
import KeyPoolManager from './KeyPoolManager';

export default function KeyPoolModal({
  isOpen,
  onClose,
  activeProvider = 'auto',
  requiredProvider = 'gemini',
  onActiveProviderChange,
  singleKeyMode = false,
  onSingleKeyModeChange,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Multi-Provider LLM Key Vault (BYOK)"
      maxWidth="max-w-4xl"
    >
      <div className="max-h-[75vh] overflow-y-auto">
        <KeyPoolManager
          primaryProvider={activeProvider}
          requiredProvider={requiredProvider}
          onActiveProviderChange={onActiveProviderChange}
          singleKeyMode={singleKeyMode}
          onSingleKeyModeChange={onSingleKeyModeChange}
        />
      </div>
    </Modal>
  );
}
