import { api } from './api';

export const GeminiPoolService = {
  async getKeysStatus() {
    return await api.getKeys();
  },

  async saveKeys(keys) {
    return await api.updateKeys(keys);
  },

  async testKey(key) {
    return await api.testKey(key);
  },

  async resetPool() {
    return await api.resetKeys();
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
