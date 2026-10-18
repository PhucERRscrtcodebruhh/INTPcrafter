import {
  TIER_0_GLOBAL_CORE,
  buildThreeTierEnvelope,
  buildStableRequestEnvelope
} from '../server/app.js';
import { RAGEngine } from '../server/ragEngine.js';
import { applyRollingContext, resetRollingAnchors, estimateTokens } from '../server/tokenUtils.js';

async function runTests() {
  console.log('=== TEST SUITE: 3-TIER PREFIX KV CACHE & BLANK RAG LORE JOURNAL ===\n');

  // ==========================================
  // TEST 1: Tier 1 Byte-Identical Invariance & 40k Token Cap
  // ==========================================
  console.log('[TEST 1] Verifying Tier 1 Immutable Prefix & 40k Cap...');
  
  const mockMagicSystemAndProtagonist = `[WORLD CORE RULES & MAGIC SYSTEM INVARIANTS]
1. Resonant Aether Weaving: Aether is omnipresent and requires attuned harmonic frequency.
2. Flux Burn: Overdrawing more than 3 patterns induces permanent cellular necrosis.
3. Cold Iron: Dampens all resonant frequencies.

[PROTAGONIST CORE INVARIANTS]
- Kaelen Vance: Former Spire Weaver. Emotionally guarded, calculating, stage-1 Flux Burn in left hand.
- Unbreakable Invariant: Never willingly surrenders sister's encrypted data-core.`;

  const tier1Envelope1 = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: mockMagicSystemAndProtagonist,
    userPrompt: 'Turn 1 prompt'
  });

  const tier1Envelope2 = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: mockMagicSystemAndProtagonist,
    userPrompt: 'Turn 2 completely different prompt with different arguments'
  });

  if (tier1Envelope1.tier1 !== tier1Envelope2.tier1) {
    throw new Error('FAILED: Tier 1 changed across turns! Tier 1 MUST be 100% byte-for-byte immutable.');
  }

  if (!tier1Envelope1.tier1.includes(TIER_0_GLOBAL_CORE)) {
    throw new Error('FAILED: Tier 1 must include TIER_0_GLOBAL_CORE system instruction');
  }

  if (!tier1Envelope1.tier1.includes('Resonant Aether Weaving') || !tier1Envelope1.tier1.includes('Kaelen Vance')) {
    throw new Error('FAILED: Tier 1 must contain magic system and protagonist core invariants');
  }

  // Verify 40k token cap safety clamp
  const hugeTier1Text = 'Aether law invariant: '.repeat(15000); // Exceeds 40k tokens
  const clampedEnvelope = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: hugeTier1Text,
    maxTier1Tokens: 40000,
    userPrompt: 'Test clamp'
  });

  if (clampedEnvelope.tokenEstimates.tier1Tokens > 40500) {
    throw new Error(`FAILED: Tier 1 exceeded 40k token budget cap! (Got ${clampedEnvelope.tokenEstimates.tier1Tokens})`);
  }
  if (!clampedEnvelope.tier1.includes('Truncated at 40k Token Cap')) {
    throw new Error('FAILED: Clamped Tier 1 missing truncation notice');
  }
  console.log('✓ Tier 1 is byte-identical across turns and strictly respects 40k token cap.\n');


  // ==========================================
  // TEST 2: Tier 2 Arc Anchor / Semi-Static Context ("Thay đổi 1 ít")
  // ==========================================
  console.log('[TEST 2] Verifying Tier 2 Arc Anchor & Location Isolation...');

  const mockArcLocation = `Location: Sector 07 - The Drowned Conduits. Subterranean flooded labyrinth beneath Nova Aethel. Submerged electrical conduits detonate on contact.
Established Cast:
- Lyra Shen: Scrapper tech-specialist, owes Kaelen 400 aether ciphers.`;

  const arcEnvelope = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: mockMagicSystemAndProtagonist,
    tier2Arc: mockArcLocation,
    userPrompt: 'Investigate the humming conduit.'
  });

  if (!arcEnvelope.tier2.includes('[ARC ANCHOR & ESTABLISHED CONTEXT]')) {
    throw new Error('FAILED: Tier 2 missing [ARC ANCHOR & ESTABLISHED CONTEXT] block');
  }
  if (!arcEnvelope.tier2.includes('Sector 07 - The Drowned Conduits')) {
    throw new Error('FAILED: Tier 2 missing Arc Location context');
  }
  if (!arcEnvelope.tier2.includes('Lyra Shen')) {
    throw new Error('FAILED: Tier 2 missing established cast backstory');
  }

  // Verify systemInstruction combines Tier 1 + Tier 2 prefix
  if (!arcEnvelope.systemInstruction.startsWith(arcEnvelope.tier1)) {
    throw new Error('FAILED: Combined systemInstruction must begin with immutable Tier 1');
  }
  if (!arcEnvelope.systemInstruction.includes(arcEnvelope.tier2)) {
    throw new Error('FAILED: Combined systemInstruction must append Tier 2 arc context');
  }

  // Modifying Tier 2 should NOT modify Tier 1
  const newArcLocation = `Location: The High Spires - Synod Citadel.`;
  const newArcEnvelope = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: mockMagicSystemAndProtagonist,
    tier2Arc: newArcLocation,
    userPrompt: 'Infiltrate the council chamber.'
  });

  if (newArcEnvelope.tier1 !== arcEnvelope.tier1) {
    throw new Error('FAILED: Modifying Tier 2 mutated Tier 1!');
  }
  console.log('✓ Tier 2 Arc Anchor is correctly appended without mutating Tier 1 prefix.\n');


  // ==========================================
  // TEST 3: Tier 3 Sequential "Brick Stacker", Blank RAG Lore & Transient RAG
  // ==========================================
  console.log('[TEST 3] Verifying Tier 3 Sequential Turns, Blank RAG Lore & Transient RAG Injection...');

  const userMarkdownDiary = `# Chronicle Diary
- 2026-10-18: Defeated the Synod Hound-Drone at Conduit Junction 4.
- Lyra gave Kaelen an overclocked biometric stabilizer glove.
- Discovered encrypted cipher mentioning the 'Aether Zero' protocol.`;

  const transientEntities = [
    {
      category: 'Character',
      title: 'Vane Enforcer 09',
      aliases: ['The Iron Hound'],
      content: 'A cybernetically enhanced hound unit attuned to resonant flux.',
      rules: 'Armed with ultrasonic disruptors.'
    }
  ];

  const historyTurns = [
    { id: 1, role: 'user', content: 'We need to bypass the patrol.' },
    { id: 2, role: 'assistant', content: 'Kaelen slips behind the rusted conduit, holding his breath.' }
  ];

  const currentPrompt = 'Activate the obsidian rapier and strike the drone power-cell.';

  const tier3Envelope = buildThreeTierEnvelope({
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1Core: mockMagicSystemAndProtagonist,
    tier2Arc: mockArcLocation,
    blankRagLore: userMarkdownDiary,
    retrievedLore: transientEntities,
    historyMessages: historyTurns,
    userPrompt: currentPrompt
  });

  // Verify Brick Stacker history count and structure
  if (tier3Envelope.messages.length !== 3) {
    throw new Error(`FAILED: Expected 3 messages in brick stacker (2 history + 1 terminal), got ${tier3Envelope.messages.length}`);
  }
  if (tier3Envelope.messages[0].content !== 'We need to bypass the patrol.') {
    throw new Error('FAILED: First turn message content mismatch');
  }
  if (tier3Envelope.messages[1].content !== 'Kaelen slips behind the rusted conduit, holding his breath.') {
    throw new Error('FAILED: Second turn message content mismatch');
  }

  // Verify Terminal message contains Blank RAG Lore (User Journal)
  const terminalContent = tier3Envelope.messages[2].content;
  if (!terminalContent.includes('[USER CHRONICLE JOURNAL // BLANK RAG LORE]')) {
    throw new Error('FAILED: Terminal turn missing [USER CHRONICLE JOURNAL // BLANK RAG LORE] header');
  }
  if (!terminalContent.includes("Discovered encrypted cipher mentioning the 'Aether Zero' protocol")) {
    throw new Error('FAILED: Terminal turn missing user Markdown diary entry');
  }

  // Verify Terminal message contains Transient RAG
  if (!terminalContent.includes('[Context Reference - Retrieved Entities]')) {
    throw new Error('FAILED: Terminal turn missing [Context Reference - Retrieved Entities]');
  }
  if (!terminalContent.includes('Vane Enforcer 09')) {
    throw new Error('FAILED: Terminal turn missing transient entity');
  }

  // Verify Terminal message contains Generation Directive
  if (!terminalContent.includes(`[Generation Directive]\n${currentPrompt}`)) {
    throw new Error('FAILED: Terminal turn missing generation directive');
  }

  // Verify Gemini contents structure matches messages
  if (tier3Envelope.contents.length !== 3) {
    throw new Error(`FAILED: Gemini contents length mismatch (${tier3Envelope.contents.length} !== 3)`);
  }
  if (tier3Envelope.contents[2].parts[0].text !== terminalContent) {
    throw new Error('FAILED: Gemini terminal content does not match OpenAI terminal message');
  }
  console.log('✓ Tier 3 correctly stacks history turns and injects User Chronicle Journal & Transient RAG.\n');


  // ==========================================
  // TEST 4: Prefix Cache Stability under Anchored Rolling Window
  // ==========================================
  console.log('[TEST 4] Verifying Anchored Rolling Window Preserves Prefix KV Cache...');

  resetRollingAnchors();
  const testSessionKey = 'test:3-tier-kv-cache-stability';
  const historyChain = [];
  const sessionBudget = 1500;

  let pinnedAnchorId = null;
  let reanchorsCount = 0;

  for (let turn = 1; turn <= 18; turn++) {
    historyChain.push({ id: turn * 2 - 1, role: 'user', content: `Turn ${turn} user narrative action ` + 'x'.repeat(80) });
    historyChain.push({ id: turn * 2, role: 'model', content: `Turn ${turn} story response narrative ` + 'y'.repeat(80) });

    const rollingResult = applyRollingContext(
      historyChain,
      arcEnvelope.systemInstruction,
      tier3Envelope.tier3.terminalUserPrompt,
      sessionBudget,
      { sessionKey: testSessionKey }
    );

    if (pinnedAnchorId === null) {
      pinnedAnchorId = rollingResult.anchorId;
    } else if (rollingResult.anchorId !== pinnedAnchorId) {
      reanchorsCount++;
      pinnedAnchorId = rollingResult.anchorId;
      // When rolled, must start with a user turn
      if (rollingResult.prunedMessages[0]?.role !== 'user') {
        throw new Error('FAILED: Anchored rolling window must always start on a user turn');
      }
    }
  }

  // Over 18 long turns with budget 1500, it should batch roll only 1 to 5 times, NOT every turn
  if (reanchorsCount === 0) {
    throw new Error('FAILED: Expected rolling window to roll at least once');
  }
  if (reanchorsCount > 6) {
    throw new Error(`FAILED: Rolling window moved ${reanchorsCount} times. It must batch roll to preserve prefix KV cache!`);
  }
  console.log(`✓ Anchored rolling window kept KV cache prefix stable (${reanchorsCount} batched shifts over 18 long turns).\n`);


  // ==========================================
  // TEST 5: Backward Compatibility of buildStableRequestEnvelope
  // ==========================================
  console.log('[TEST 5] Verifying backward compatibility with buildStableRequestEnvelope...');

  const legacyEnvelope = buildStableRequestEnvelope({
    historyMessages: [{ role: 'user', content: 'Turn 1' }],
    tier0GlobalCore: TIER_0_GLOBAL_CORE,
    tier1WorldCore: '[WORLD CORE RULES]\nKeep causality.',
    tier2UserPrompt: 'Continue chapter 1.'
  });

  if (!legacyEnvelope.systemInstruction.includes(TIER_0_GLOBAL_CORE)) {
    throw new Error('FAILED: legacy buildStableRequestEnvelope missing system instruction');
  }
  if (legacyEnvelope.messages.length !== 2) {
    throw new Error('FAILED: legacy buildStableRequestEnvelope messages count mismatch');
  }
  console.log('✓ buildStableRequestEnvelope maintains 100% backward compatibility.\n');

  console.log('=== ALL 3-TIER PREFIX KV CACHE & BLANK RAG LORE TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test suite encountered an error:', err);
  process.exit(1);
});
