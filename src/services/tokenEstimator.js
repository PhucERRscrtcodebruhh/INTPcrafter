export const MODEL_SPECS = {
  // Gemini Flagship Series
  'gemini-3.8-flash': {
    name: 'Gemini 3.8 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Agentic State-of-Art',
    description: 'Flagship agentic reasoning, multimodal mastery, and deterministic constraint checking'
  },
  'gemini-3.7-flash': {
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M High Speed',
    description: 'Ultra-low latency generation with strong logic adherence'
  },
  'gemini-3.6-flash': {
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Fast & Balanced',
    description: 'Balanced throughput and creative narrative synthesis'
  },
  'gemini-3.5-flash-lite': {
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Ultra-Fast',
    description: 'Cost-efficient, fastest performance for high-frequency world simulation'
  },
  'gemini-3.1-pro': {
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Deep Reasoning',
    description: 'Complex causal reasoning, strict rule compliance, and research-level nuance'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextLimit: 2097152,
    recommendedThreshold: 131072,
    tag: '2M Long Context',
    description: 'Deep multi-chapter memory retention and long-horizon plot consistency'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M High Precision',
    description: 'Refined instruction following and complex world simulation'
  },
  'gemma-4-31b-it': {
    name: 'Gemma 4 31B IT',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Dense Model',
    description: '31B dense parameter architecture with nuanced prose and distinct voice'
  },

  // DeepSeek Flagship Series
  'deepseek-v4-pro': {
    name: 'DeepSeek-V4-Pro',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Flagship Creative',
    description: 'DeepSeek Flagship V4 architecture — Supreme novel prose synthesis, multi-character consistency and nuanced dialogue.'
  },
  'deepseek-v4-flash': {
    name: 'DeepSeek-V4-Flash',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Ultra-Fast Stream',
    description: 'High-throughput flash variant optimized for instantaneous story streaming and combat flow.'
  },
  'deepseek-v3.2': {
    name: 'DeepSeek-V3.2',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Balanced Narrative',
    description: 'Refined narrative pacing, world lore adherence, and deterministic causal logic.'
  },
  'deepseek-r1-zero': {
    name: 'DeepSeek-R1-Zero',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Pure RL Thinking',
    description: 'Pure reinforcement learning reasoning without SFT — Deep unconstrained chain-of-thought exploration.'
  },
  'deepseek-r1': {
    name: 'DeepSeek-R1',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Reasoning Master',
    description: 'State-of-the-art reasoning model with visible thinking tokens (<think>...</think>) for complex mysteries and magic equations.'
  },
  'deepseek-r1-0528': {
    name: 'DeepSeek-R1-0528',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Checkpoint Build',
    description: 'Deterministic plot progression and strict constraint checking checkpoint.'
  },
  'deepseek-coder-v2': {
    name: 'DeepSeek-Coder-V2',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Code & Matrix',
    description: 'Chuyên tạo code, hoàn thiện mã nguồn, sửa lỗi, giải thích thuật toán và code infilling.'
  },
  'deepseek-math-v2': {
    name: 'DeepSeekMath-V2',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Formal Math',
    description: 'Chuyên giải toán và xây dựng các bài chứng minh bằng ngôn ngữ tự nhiên.'
  },
  'deepseek-prover-v2': {
    name: 'DeepSeek-Prover-V2',
    provider: 'deepseek',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Lean 4 Prover',
    description: 'Chuyên tạo chứng minh hình thức bằng Lean 4.'
  },

  // OpenRouter & Open Models
  'openrouter/auto': {
    name: 'OpenRouter Auto Router',
    provider: 'openrouter',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Dynamic Routing',
    description: 'Auto-routes prompts to the best available open-weights provider (Llama, DeepSeek, Mistral, Qwen).'
  },
  'meta-llama/llama-3.3-70b-instruct': {
    name: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Open Weights',
    description: 'Meta Flagship 70B open model with high stylistic versatility.'
  },
  'huggingface/deepseek-ai/DeepSeek-R1': {
    name: 'DeepSeek-R1 (Hugging Face)',
    provider: 'huggingface',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Serverless HF',
    description: 'Hugging Face Inference API endpoint for DeepSeek-R1 open model.'
  }
};

export const PROVIDER_CATEGORIES = [
  { id: 'gemini', name: 'Google Gemini', icon: '🔷', color: 'text-cyan-400 border-cyan-500/30' },
  { id: 'deepseek', name: 'DeepSeek AI', icon: '🟣', color: 'text-purple-400 border-purple-500/30' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🌐', color: 'text-blue-400 border-blue-500/30' },
  { id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: 'text-amber-400 border-amber-500/30' }
];

export function getModelSpec(modelId) {
  if (!modelId) return MODEL_SPECS['gemini-3.8-flash'];
  return MODEL_SPECS[modelId] || {
    name: modelId,
    provider: modelId.startsWith('deepseek') ? 'deepseek' : (modelId.startsWith('openrouter') ? 'openrouter' : (modelId.startsWith('huggingface') ? 'huggingface' : 'gemini')),
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Context',
    description: 'Custom model endpoint'
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
