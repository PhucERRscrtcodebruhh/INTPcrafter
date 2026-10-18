export interface ModelCapabilitySchema {
  provider: 'google' | 'openai-compatible';
  supportsTopK: boolean;
  supportsPenalties: boolean; // frequency_penalty & presence_penalty
  supportsStopSequences: boolean;
  reasoningType: 'none' | 'google-budget' | 'google-level' | 'openai-effort';
  supportsGroundingSearch: boolean;
  supportsUrlContext: boolean;
  supportsImageDetail: boolean;
  defaultMaxTokens: number;
  maxOutputTokensCap: number;
}

export declare function resolveModelCapabilities(provider: string, modelId: string): ModelCapabilitySchema;
