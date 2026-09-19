import { api } from './api';

export const ClientRAGService = {
  async getLorebook(category, search) {
    return await api.getLore({ category, search });
  },

  async saveLoreEntry(data) {
    if (data.id) {
      return await api.updateLore(data.id, data);
    }
    return await api.createLore(data);
  },

  async deleteLoreEntry(id) {
    return await api.deleteLore(id);
  },

  getCategoryColor(category) {
    switch (category) {
      case 'Character':
        return 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40';
      case 'MagicSystem':
        return 'border-purple-500/40 text-purple-300 bg-purple-950/40';
      case 'Location':
        return 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40';
      case 'Timeline':
        return 'border-amber-500/40 text-amber-300 bg-amber-950/40';
      case 'Faction':
        return 'border-rose-500/40 text-rose-300 bg-rose-950/40';
      default:
        return 'border-blue-500/40 text-blue-300 bg-blue-950/40';
    }
  }
};
