// Pure helpers for provider-aware BYOK validation. Kept framework-free so the
// "at least one active key" rule can be unit tested without a browser.

export const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  huggingface: 'Hugging Face',
};

export const PROVIDER_IDS = ['gemini', 'deepseek', 'openrouter', 'groq', 'huggingface'];

export function normalizeProvider(provider) {
  const value = String(provider || '').toLowerCase().trim();
  return PROVIDER_IDS.includes(value) ? value : 'gemini';
}

/**
 * Explicit primary provider wins; "auto" (or empty) follows the selected model.
 */
export function resolveRequiredProvider(activeProvider, modelProvider = 'gemini') {
  const primary = String(activeProvider || 'auto').toLowerCase().trim();
  if (primary && primary !== 'auto') return normalizeProvider(primary);
  return normalizeProvider(modelProvider);
}

export function getProviderKeys(keyStats, provider) {
  const target = normalizeProvider(provider);
  return (Array.isArray(keyStats) ? keyStats : []).filter(
    key => normalizeProvider(key.provider) === target
  );
}

/**
 * A pool is usable with a SINGLE active key. Missing `status` is treated as active
 * because the API normalises legacy rows to active on read.
 */
export function hasActiveKey(keyStats, provider) {
  return getProviderKeys(keyStats, provider).some(
    key => (key.status || 'active') === 'active'
  );
}

export function getActiveKeyCount(keyStats, provider) {
  return getProviderKeys(keyStats, provider).filter(
    key => (key.status || 'active') === 'active'
  ).length;
}

export function providerLabel(provider) {
  const id = normalizeProvider(provider);
  return PROVIDER_LABELS[id] || id;
}
