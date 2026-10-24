import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const memoryStore = new Map();
const safeStorage = {
  getItem: (name) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(name);
      }
    } catch {
      // fallback
    }
    return memoryStore.get(name) || null;
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(name, value);
        return;
      }
    } catch {
      // fallback
    }
    memoryStore.set(name, value);
  },
  removeItem: (name) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
        return;
      }
    } catch {
      // fallback
    }
    memoryStore.delete(name);
  },
};

/**
 * Default Google AI Studio Safety Settings
 */
export const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
];

/**
 * Default parameter state values matching specification
 */
export const DEFAULT_PARAMETERS = {
  // Common Sampling
  temperature: 1.0, // default: 1.0 (range 0.0 - 2.0)
  topP: 0.95,       // default: 0.95 (range 0.0 - 1.0)
  maxOutputTokens: 8192, // default: 8192 for Google AI Studio (or model max)
  maxContextTokens: 32768, // custom rolling pruner cap
  disableStreaming: false, // default: false

  // OpenAI / DeepSeek Specific
  frequencyPenalty: 0.0, // default: 0.0 (range -2.0 to 2.0)
  presencePenalty: 0.0,  // default: 0.0 (range -2.0 to 2.0)
  stopSequences: [],     // e.g., []
  reasoningEffort: 'auto', // 'auto' | 'low' | 'medium' | 'high'
  reasoningSummary: 'unset', // 'unset' | 'enabled' | 'disabled'
  reasoningMode: 'unset', // 'unset' | 'parsed' | 'raw'
  verbosity: 'none', // 'none' | 'concise' | 'detailed'
  useResponsesApi: false,

  // Google GenAI Specific (Google AI Studio Schema)
  systemInstruction: '', // Dedicated System Instructions override / prompt
  topK: 40, // default: 40 (range 1 - 100)
  thinkingEnabled: true, // default: true for reasoning models
  thinkingBudget: 2048, // 'auto' or integer (min 1024, default 2048)
  thinkingLevel: 'auto', // 'auto' | 'low' | 'medium' | 'high'
  safetySettings: [...DEFAULT_SAFETY_SETTINGS],
  groundingWithGoogleSearch: false, // default: false
  urlContext: false, // default: false
  resendFiles: true, // default: true
  imageDetail: 'auto', // 'auto' | 'low' | 'high'
};

export const BUILTIN_PRESETS = [
  {
    name: 'Default Balanced',
    description: 'Balanced sampling for general chronicle roleplay & narrative flow',
    parameters: { ...DEFAULT_PARAMETERS },
  },
  {
    name: 'Creative Novelist',
    description: 'Higher temperature and vocabulary variety for expressive worldbuilding',
    parameters: {
      ...DEFAULT_PARAMETERS,
      temperature: 1.25,
      topP: 0.98,
      frequencyPenalty: 0.2,
      presencePenalty: 0.15,
      topK: 50,
      thinkingLevel: 'medium',
      thinkingBudget: 4096,
    },
  },
  {
    name: 'Precise / Logic',
    description: 'Low entropy deterministic sampling for strict invariant verification',
    parameters: {
      ...DEFAULT_PARAMETERS,
      temperature: 0.2,
      topP: 0.8,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      topK: 20,
      thinkingLevel: 'low',
      thinkingBudget: 1024,
    },
  },
  {
    name: 'Deep Reasoner',
    description: 'Deep thought mode with maximum reasoning effort and extended budget',
    parameters: {
      ...DEFAULT_PARAMETERS,
      temperature: 0.6,
      topP: 0.95,
      reasoningEffort: 'high',
      thinkingEnabled: true,
      thinkingLevel: 'high',
      thinkingBudget: 16384,
      maxOutputTokens: 8192,
    },
  },
];

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      parameters: { ...DEFAULT_PARAMETERS },
      activePreset: 'Default Balanced',
      customPresets: [],
      isCockpitOpen: false,

      setCockpitOpen: (isOpen) => set({ isCockpitOpen: Boolean(isOpen) }),
      toggleCockpit: () => set((state) => ({ isCockpitOpen: !state.isCockpitOpen })),

      updateParameter: (key, value) => {
        set((state) => ({
          parameters: {
            ...state.parameters,
            [key]: value,
          },
          activePreset: 'Custom',
        }));
      },

      updateParameters: (partial) => {
        set((state) => ({
          parameters: {
            ...state.parameters,
            ...partial,
          },
          activePreset: 'Custom',
        }));
      },

      resetToDefaults: () => {
        set({
          parameters: { ...DEFAULT_PARAMETERS },
          activePreset: 'Default Balanced',
        });
      },

      applyPreset: (presetName) => {
        const builtin = BUILTIN_PRESETS.find((p) => p.name === presetName);
        if (builtin) {
          set({
            parameters: { ...builtin.parameters },
            activePreset: builtin.name,
          });
          return;
        }

        const custom = get().customPresets.find((p) => p.name === presetName);
        if (custom) {
          set({
            parameters: { ...DEFAULT_PARAMETERS, ...custom.parameters },
            activePreset: custom.name,
          });
        }
      },

      savePreset: (name) => {
        if (!name || !name.trim()) return;
        const cleanName = name.trim();
        const currentParams = { ...get().parameters };
        set((state) => {
          const filtered = state.customPresets.filter((p) => p.name !== cleanName);
          return {
            customPresets: [...filtered, { name: cleanName, parameters: currentParams }],
            activePreset: cleanName,
          };
        });
      },

      deletePreset: (name) => {
        set((state) => ({
          customPresets: state.customPresets.filter((p) => p.name !== name),
          activePreset: state.activePreset === name ? 'Custom' : state.activePreset,
        }));
      },
    }),
    {
      name: 'intpcrafter_model_parameters_v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        parameters: state.parameters,
        activePreset: state.activePreset,
        customPresets: state.customPresets,
      }),
    }
  )
);
