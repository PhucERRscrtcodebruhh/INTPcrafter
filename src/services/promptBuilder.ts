import { assembleTier3Context, type ChatMessage, type AssembleContextOptions } from './contextService.ts';

export interface PromptBuilderConfig {
  sessionId: string;
  userPrompt: string;
  tier0GlobalCore?: string;
  tier1Core?: string;
  tier2Arc?: string;
  blankRagLore?: string;
  retrievedLore?: any[];
  maxTier1Tokens?: number;
}

export interface PromptPayload {
  sessionId: string;
  systemInstruction: string;
  tier1: string;
  tier2: string;
  tier3: {
    historyCount: number;
    journal: string;
    terminalUserPrompt: string;
  };
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  totalTurns: number;
}

const DEFAULT_TIER0 = `[WORLD SIMULATOR SYSTEM INVARIANTS]
Maintain absolute causality, narrative continuity, character consistency, and physical invariants.
Never hallucinate or skip established narrative milestones.`;

/**
 * Builds the complete prompt payload for the LLM API call.
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * - Strictly calls assembleTier3Context(sessionId), which reads from persistent IndexedDB.
 * - NEVER reads from DOM nodes, virtualized view arrays, or UI component states.
 * - Entire conversation history (e.g. 320 messages) remains intact without being cut off to Chapter 1.
 */
export async function buildPromptPayload(config: PromptBuilderConfig): Promise<PromptPayload> {
  const {
    sessionId,
    userPrompt,
    tier0GlobalCore = DEFAULT_TIER0,
    tier1Core = '',
    tier2Arc = '',
    blankRagLore = '',
    retrievedLore = []
  } = config;

  if (!sessionId) {
    throw new Error('buildPromptPayload requires a valid sessionId');
  }

  // 1. Fetch full conversation turns directly from the persistent store (IndexedDB)
  const fullHistory: ChatMessage[] = await assembleTier3Context(sessionId);

  // 2. Build Tier 1 (Immutable System Core)
  const tier1Sections: string[] = [tier0GlobalCore.trim()];
  if (tier1Core && tier1Core.trim()) {
    tier1Sections.push(tier1Core.trim());
  } else {
    tier1Sections.push('[WORLD CORE RULES]\nMaintain logical causality and world invariants.');
  }
  const tier1Formatted = tier1Sections.join('\n\n');

  // 3. Build Tier 2 (Arc Anchor / Semi-Static Context)
  const tier2Formatted = tier2Arc && tier2Arc.trim()
    ? `[ARC ANCHOR & ESTABLISHED CONTEXT]\n${tier2Arc.trim()}`
    : '';

  const systemInstruction = tier2Formatted
    ? `${tier1Formatted}\n\n${tier2Formatted}`
    : tier1Formatted;

  // 4. Build Tier 3 Terminal Directive
  const promptParts: string[] = [];
  const cleanJournal = (blankRagLore || '').trim();
  if (cleanJournal) {
    promptParts.push(`[USER CHRONICLE JOURNAL // BLANK RAG LORE]\n${cleanJournal}\n[END OF USER CHRONICLE JOURNAL]`);
  }

  if (Array.isArray(retrievedLore) && retrievedLore.length > 0) {
    promptParts.push(`[Context Reference - Retrieved Entities]\n${JSON.stringify(retrievedLore, null, 2)}`);
  }

  const cleanUserPrompt = (userPrompt || '').trim();
  promptParts.push(`[Generation Directive]\n${cleanUserPrompt}`);
  const tier3TerminalPrompt = promptParts.join('\n\n');

  // 5. Stack history messages + terminal directive
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = fullHistory.map(m => ({
    role: (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user',
    content: m.content
  }));

  if (cleanUserPrompt) {
    messages.push({
      role: 'user',
      content: tier3TerminalPrompt
    });
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  return {
    sessionId,
    systemInstruction,
    tier1: tier1Formatted,
    tier2: tier2Formatted,
    tier3: {
      historyCount: fullHistory.length,
      journal: cleanJournal,
      terminalUserPrompt: tier3TerminalPrompt
    },
    messages,
    contents,
    totalTurns: messages.length
  };
}
