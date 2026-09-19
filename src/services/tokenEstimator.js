export const MODEL_SPECS = {
  // Gemini 3.x Flagship Series
  'gemini-3.8-flash': {
    name: 'Gemini 3.8 Flash',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Agentic State-of-Art',
    description: 'Flagship agentic reasoning, multimodal mastery, and deterministic constraint checking'
  },
  'gemini-3.7-flash': {
    name: 'Gemini 3.7 Flash',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M High Speed',
    description: 'Ultra-low latency generation with strong logic adherence'
  },
  'gemini-3.6-flash': {
    name: 'Gemini 3.6 Flash',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Fast & Balanced',
    description: 'Balanced throughput and creative narrative synthesis'
  },
  'gemini-3.5-flash-lite': {
    name: 'Gemini 3.5 Flash-Lite',
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Ultra-Fast',
    description: 'Cost-efficient, fastest performance for high-frequency world simulation'
  },
  'gemini-3.1-pro': {
    name: 'Gemini 3.1 Pro',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Deep Reasoning',
    description: 'Complex causal reasoning, strict rule compliance, and research-level nuance'
  },

  // Gemini 2.5 Series
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    contextLimit: 2097152,
    recommendedThreshold: 131072,
    tag: '2M Long Context',
    description: 'Deep multi-chapter memory retention and long-horizon plot consistency'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M High Precision',
    description: 'Refined instruction following and complex world simulation'
  },

  // Gemma 4 Open Weights Series
  'gemma-4-31b-it': {
    name: 'Gemma 4 31B IT',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Dense Model',
    description: '31B dense parameter architecture with nuanced prose and distinct voice'
  },
  'gemma-4-26b-a4b-it': {
    name: 'Gemma 4 26B A4B IT',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K MoE Architecture',
    description: '26B total / 4B active MoE model for high efficiency and stylistic depth'
  }
};

export function getModelSpec(modelId) {
  if (!modelId) return MODEL_SPECS['gemini-3.8-flash'];
  return MODEL_SPECS[modelId] || {
    name: modelId,
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Context',
    description: 'General Gemini endpoint'
  };
}

export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  let asciiCount = 0;
  let nonAsciiCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }

  return Math.max(1, Math.ceil((asciiCount / 3.8) + (nonAsciiCount / 1.7)));
}

export function formatTokenCount(num) {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toLocaleString();
}
