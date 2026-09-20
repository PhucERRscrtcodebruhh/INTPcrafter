import { api } from './api';

export const GeminiPoolService = {
  async getKeysStatus(provider = null) {
    return await api.getKeys(provider);
  },

  async saveKeys(keys, provider = 'gemini', baseUrl = null) {
    return await api.updateKeys(keys, provider, baseUrl);
  },

  async testKey(key, provider = 'gemini', baseUrl = null) {
    return await api.testKey(key, provider, baseUrl);
  },

  async resetPool(provider = null) {
    return await api.resetKeys(provider);
  },

  formatKeyStatus(status) {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' };
      case 'rate_limited':
        return { label: 'Rate-Limited (429)', color: 'text-amber-400 bg-amber-950/60 border-amber-500/40' };
      case 'invalid':
        return { label: 'Invalid / Error', color: 'text-rose-400 bg-rose-950/60 border-rose-500/40' };
      default:
        return { label: 'Unknown', color: 'text-slate-400 bg-slate-900 border-slate-700' };
    }
  }
};

export const MultiProviderService = GeminiPoolService;
