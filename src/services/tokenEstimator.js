const LEGACY_MODEL_SPECS = {
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
// ==========================================
// GOOGLE GEMINI REGISTRY (flagship / omni / nano)
// ==========================================
export const GEMINI_MODEL_SPECS = {
  'gemini-4-argon': {
    name: 'Gemini 4 Argon',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 131072,
    tag: '1M Next-Gen Flagship',
    description: 'Next-generation Argon architecture with deep causal reasoning and long-horizon narrative memory.'
  },
  'gemini-4-argon-cyber-permissive': {
    name: 'Gemini 4 Argon Cyber Permissive',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 131072,
    tag: '1M Unfiltered Cyber',
    description: 'Argon variant tuned for permissive cyberpunk world simulation and unrestricted atmospheric prose.'
  },
  'gemini-3.8-flash': {
    name: 'Gemini 3.8 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Agentic Flagship',
    description: 'Flagship agentic reasoning, multimodal mastery, and deterministic constraint checking.'
  },
  'gemini-3.8-flash-cyber': {
    name: 'Gemini 3.8 Flash Cyber',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Cyber Narrative',
    description: 'Flash variant tuned for cyber-tech HUD prose, neon noir atmosphere, and gritty world logic.'
  },
  'gemini-3.8-live': {
    name: 'Gemini 3.8 Live',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Realtime Multimodal',
    description: 'Low-latency live streaming model for real-time scene direction and multimodal state simulation.'
  },
  'gemini-3.7-flash': {
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M High Speed',
    description: 'Ultra-low latency generation with strong logic adherence.'
  },
  'gemini-3.6-flash': {
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Fast & Balanced',
    description: 'Balanced throughput and creative narrative synthesis.'
  },
  'gemini-3.5-flash': {
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Proven Flash',
    description: 'Stable high-throughput Flash generation for long chronicles and continuous story turns.'
  },
  'gemini-3.5-flash-lite': {
    name: 'Gemini 3.5 Flash-Lite (newest)',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Ultra-Fast (newest)',
    description: 'Cost-efficient newest Lite release for high-frequency world simulation and fast drafting.'
  },
  'gemini-3.1-pro-preview': {
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Deep Reasoning',
    description: 'Complex causal reasoning, strict rule compliance, and research-level nuance.'
  },
  'gemini-3.1-pro': {
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Deep Reasoning',
    description: 'Complex causal reasoning, strict rule compliance, and research-level nuance.'
  },
  'gemini-3.1-flash-lite': {
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Classic Lite',
    description: 'High-speed lightweight 3.1 Flash-Lite model for fast turns.'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Legacy Pro',
    description: 'Legacy Gemini 2.5 Pro with token-budgeted thinking support.'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Legacy Flash',
    description: 'Legacy Gemini 2.5 Flash model for standard chat generation.'
  },
  'gemini-2.5-flash-lite': {
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 32768,
    tag: '1M Legacy Lite',
    description: 'Legacy Gemini 2.5 Flash-Lite model for high-speed lightweight turns.'
  },
  'gemini-omni-1.1-flash-preview': {
    name: 'Gemini Omni 1.1 Flash (Preview)',
    provider: 'gemini',
    contextLimit: 1048576,
    recommendedThreshold: 65536,
    tag: '1M Omni Preview',
    description: 'Omni-modal preview model for cross-format scene context, audio cues, and visual continuity.'
  },
  'gemini-nano-banana-2.1': {
    name: 'Gemini Nano Banana 2.1',
    provider: 'gemini',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: '32K Image / Nano',
    description: 'Nano Banana image-oriented model for visual asset prompts, covers, and scene illustration briefs.'
  },
  'gemini-nano': {
    name: 'Gemini Nano',
    provider: 'gemini',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: '32K On-Device',
    description: 'Compact on-device model for lightweight drafting and local continuity checks.'
  },
};



// ==========================================
// GOOGLE GEMMA REGISTRY (open weights)
// ==========================================
export const GEMMA_MODEL_SPECS = {
  'gemma-4-31b-it': {
    name: 'Gemma 4 31B IT',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Dense Open Weights',
    description: '31B dense instruction-tuned model with nuanced prose and distinct character voice.'
  },
  'gemma-4-26b-a4b-it': {
    name: 'Gemma 4 26B A4B IT',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K MoE Open Weights',
    description: '26B mixture-of-experts instruction model balancing speed and narrative quality.'
  },
  'gemma-4-e4b-it': {
    name: 'Gemma 4 E4B IT',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Efficient 4B',
    description: 'Efficient 4B instruction model for fast turns and lightweight world checks.'
  },
  'gemma-4-e2b-it': {
    name: 'Gemma 4 E2B IT',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Efficient 2B',
    description: 'Ultra-light 2B instruction model for low-cost drafting and refactoring.'
  },
  'gemma-4-12b': {
    name: 'Gemma 4 12B',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Mid-Size Open',
    description: '12B open model with strong stylistic range for long-form narrative.'
  },
  'gemma-3-27b': {
    name: 'Gemma 3 27B',
    provider: 'gemini',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Open Weights',
    description: 'Gemma 3 flagship 27B open model with broad multilingual storytelling ability.'
  },
  'gemma-2-27b': {
    name: 'Gemma 2 27B',
    provider: 'gemini',
    contextLimit: 8192,
    recommendedThreshold: 6144,
    tag: '8K Open Weights',
    description: 'Gemma 2 27B legacy open model with compact 8K context.'
  },
  'gemma-2-9b': {
    name: 'Gemma 2 9B',
    provider: 'gemini',
    contextLimit: 8192,
    recommendedThreshold: 6144,
    tag: '8K Open Weights',
    description: 'Gemma 2 9B compact open model for lightweight local-style generation.'
  },
  'gemma-2-2b': {
    name: 'Gemma 2 2B',
    provider: 'gemini',
    contextLimit: 8192,
    recommendedThreshold: 6144,
    tag: '8K Tiny Open Weights',
    description: 'Gemma 2 2B tiny model for constrained environments and minimal-cost drafting.'
  },
};


// ==========================================
// GROQ PRODUCTION REGISTRY (OpenAI-compatible LPU inference)
// ==========================================
export const GROQ_PRODUCTION_MODEL_SPECS = {
  'llama-3.1-8b-instant': {
    name: 'Llama 3.1 8B',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Groq LPU',
    description: 'Meta Llama 3.1 8B instant model on Groq LPUs — extremely fast short-form turns.'
  },
  'llama-3.3-70b-versatile': {
    name: 'Llama 3.3 70B',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Groq LPU',
    description: 'Meta Llama 3.3 70B versatile model with strong prose and instruction following.'
  },
  'openai/gpt-oss-120b': {
    name: 'GPT OSS 120B',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Open Weights',
    description: 'OpenAI GPT OSS 120B on Groq for high-capacity open-weight reasoning.'
  },
  'openai/gpt-oss-20b': {
    name: 'GPT OSS 20B',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: '128K Open Weights',
    description: 'OpenAI GPT OSS 20B open-weight model for fast, efficient generation.'
  },
  'whisper-large-v3': {
    name: 'Whisper',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Audio Transcription',
    description: 'OpenAI Whisper Large V3 speech-to-text endpoint on Groq (audio input, not chat).'
  },
  'whisper-large-v3-turbo': {
    name: 'Whisper Large V3 Turbo',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Audio Transcription',
    description: 'OpenAI Whisper Large V3 Turbo speech-to-text endpoint on Groq (audio input, not chat).'
  },
};


// ==========================================
// GROQ PREVIEW REGISTRY
// ==========================================
export const GROQ_PREVIEW_MODEL_SPECS = {
  'canopylabs/orpheus-arabic-saudi': {
    name: 'Canopy Labs Orpheus Arabic Saudi',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // TTS',
    description: 'Canopy Labs Orpheus Arabic (Saudi) preview voice model on Groq.'
  },
  'canopylabs/orpheus-v1-english': {
    name: 'Canopy Labs Orpheus V1 English',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // TTS',
    description: 'Canopy Labs Orpheus V1 English preview voice model on Groq.'
  },
  'meta-llama/llama-prompt-guard-2-22m': {
    name: 'Llama Prompt Guard 2 22M',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // Safety',
    description: 'Meta Llama Prompt Guard 2 22M preview classifier for prompt-injection detection.'
  },
  'meta-llama/llama-prompt-guard-2-86m': {
    name: 'Prompt Guard 2 86M',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // Safety',
    description: 'Meta Llama Prompt Guard 2 86M preview classifier for safety filtering.'
  },
  'meta-models/muse-spark-open': {
    name: 'Muse Spark Open',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // Creative',
    description: 'Meta Muse Spark Open preview creative model on Groq.'
  },
  'minimaxai/minimax-m2.7': {
    name: 'MiniMax M2.7',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: 'Preview // 128K',
    description: 'MiniMaxAI MiniMax M2.7 preview model for long-context narrative generation.'
  },
  'openai/gpt-oss-safeguard-20b': {
    name: 'Safety GPT OSS 20B',
    provider: 'groq',
    contextLimit: 32768,
    recommendedThreshold: 16384,
    tag: 'Preview // Safety',
    description: 'OpenAI GPT OSS Safeguard 20B preview safety model on Groq.'
  },
  'qwen/qwen3.8-27b': {
    name: 'Qwen/Qwen3.8-27b',
    provider: 'groq',
    contextLimit: 131072,
    recommendedThreshold: 32768,
    tag: 'Preview // 128K',
    description: 'Alibaba Cloud Qwen 3.8 27B preview model with strong multilingual reasoning.'
  },
};


// ==========================================
// MERGED MODEL REGISTRY + ORDERED PICKER GROUPS
// ==========================================
export const MODEL_SPECS = {
  ...LEGACY_MODEL_SPECS,
  ...GEMINI_MODEL_SPECS,
  ...GEMMA_MODEL_SPECS,
  ...GROQ_PRODUCTION_MODEL_SPECS,
  ...GROQ_PREVIEW_MODEL_SPECS,
};

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

export const MODEL_GROUPS = [
  {
    id: 'gemini-flagship',
    label: 'Google Gemini // Flagship',
    accent: 'cyan',
    ids: [
      'gemini-4-argon',
      'gemini-4-argon-cyber-permissive',
      'gemini-3.8-flash',
      'gemini-3.8-flash-cyber',
      'gemini-3.8-live',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-3.1-pro',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ],
  },
  {
    id: 'gemini-omni-nano',
    label: 'Google Gemini // Omni & Nano',
    accent: 'blue',
    ids: ['gemini-omni-1.1-flash-preview', 'gemini-nano-banana-2.1', 'gemini-nano'],
  },
  {
    id: 'gemma',
    label: 'Google Gemma // Open Weights',
    accent: 'emerald',
    ids: [
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
      'gemma-4-e4b-it',
      'gemma-4-e2b-it',
      'gemma-4-12b',
      'gemma-3-27b',
      'gemma-2-27b',
      'gemma-2-9b',
      'gemma-2-2b',
    ],
  },
  {
    id: 'groq-production',
    label: 'Groq // Production',
    accent: 'amber',
    ids: [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'whisper-large-v3',
      'whisper-large-v3-turbo',
    ],
  },
  {
    id: 'groq-preview',
    label: 'Groq // Preview',
    accent: 'rose',
    ids: [
      'canopylabs/orpheus-arabic-saudi',
      'canopylabs/orpheus-v1-english',
      'meta-llama/llama-prompt-guard-2-22m',
      'meta-llama/llama-prompt-guard-2-86m',
      'meta-models/muse-spark-open',
      'minimaxai/minimax-m2.7',
      'openai/gpt-oss-safeguard-20b',
      'qwen/qwen3.8-27b',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek // Reasoning',
    accent: 'purple',
    ids: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v3.2', 'deepseek-r1', 'deepseek-r1-zero'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter // Universal Router',
    accent: 'indigo',
    ids: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct'],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face // Serverless',
    accent: 'teal',
    ids: ['huggingface/deepseek-ai/DeepSeek-R1'],
  },
];


export const PROVIDER_CATEGORIES = [
  { id: 'groq', name: 'Groq', icon: '⚡', color: 'text-orange-400 border-orange-500/30' },
  { id: 'gemini', name: 'Google Gemini', icon: '🔷', color: 'text-cyan-400 border-cyan-500/30' },
  { id: 'deepseek', name: 'DeepSeek AI', icon: '🟣', color: 'text-purple-400 border-purple-500/30' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🌐', color: 'text-blue-400 border-blue-500/30' },
  { id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: 'text-amber-400 border-amber-500/30' }
];

export function getModelSpec(modelId) {
  if (!modelId) return MODEL_SPECS[DEFAULT_MODEL_ID];
  const known = MODEL_SPECS[modelId];
  if (known) return known;

  const lower = String(modelId).toLowerCase();
  const provider = lower.startsWith('deepseek')
    ? 'deepseek'
    : lower.startsWith('openrouter')
      ? 'openrouter'
      : lower.startsWith('huggingface') || lower.startsWith('hf/')
        ? 'huggingface'
        : lower.startsWith('groq')
          ? 'groq'
          : lower.includes('llama') || lower.includes('mistral') || lower.includes('claude')
            ? 'openrouter'
            : 'gemini';

  return {
    name: modelId,
    provider,
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
