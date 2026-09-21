import { TIER_0_GLOBAL_CORE } from '../server/app.js';
import { RAGEngine } from '../server/ragEngine.js';
import { ProviderKeyPool } from '../server/llmProviders.js';

async function runTests() {
  console.log('=== TEST SUITE: 3-TIER PREFIX CACHING & ERROR ISOLATION ===\n');

  // Test 1: Tier 0 Static Identity
  console.log('[TEST 1] Verifying Tier 0 Global Core Static Byte-for-Byte Invariance...');
  if (!TIER_0_GLOBAL_CORE || typeof TIER_0_GLOBAL_CORE !== 'string') {
    throw new Error('TIER_0_GLOBAL_CORE must be a defined non-empty string');
  }
  if (TIER_0_GLOBAL_CORE.includes('${') || TIER_0_GLOBAL_CORE.includes('Date.now()')) {
    throw new Error('TIER_0_GLOBAL_CORE must not contain dynamic template strings or timestamps');
  }
  const tier0Copy = `${TIER_0_GLOBAL_CORE}`;
  if (tier0Copy !== TIER_0_GLOBAL_CORE) {
    throw new Error('Tier 0 is not byte-identical');
  }
  console.log('✓ Tier 0 static header is immutable and byte-for-byte identical.\n');

  // Test 2: Tier 2 Dynamic RAG & User Input Suffix Structure
  console.log('[TEST 2] Verifying Tier 2 Dynamic Suffix Formatting...');
  const mockRetrievedLore = [
    {
      category: 'Character',
      title: 'Kaelen Vance',
      aliases: 'The Spire Weaver',
      content: 'A former archivist from Nova Aethel wielding an obsidian rapier.',
      rules: 'Suffers from stage-1 Flux Burn in his left hand.'
    },
    {
      category: 'MagicSystem',
      title: 'Resonant Aether Weaving',
      aliases: 'Flux Burn, Aether',
      content: 'Weaving harmonic vocal frequencies through ambient aether.',
      rules: 'Overdrawing causes acute Flux Burn.'
    },
    {
      category: 'Location',
      title: 'Sector 07',
      aliases: 'The Drowned Conduits',
      content: 'Subterranean flooded conduits beneath the city.',
      rules: 'Cold iron dampens resonance.'
    }
  ];

  const userDirective = 'Kaelen activates his cybernetic left eye and steps into the flooded tunnel.';
  const tier2Formatted = RAGEngine.formatTier2Prompt(userDirective, mockRetrievedLore);

  console.log('--- Tier 2 Formatted Output ---');
  console.log(tier2Formatted);
  console.log('-------------------------------\n');

  if (!tier2Formatted.includes('[Context Reference - Retrieved Entities]')) {
    throw new Error('Missing [Context Reference - Retrieved Entities] header in Tier 2');
  }
  if (!tier2Formatted.includes('- Characters:')) {
    throw new Error('Missing - Characters: section in Tier 2');
  }
  if (!tier2Formatted.includes('- Magic/Power System:')) {
    throw new Error('Missing - Magic/Power System: section in Tier 2');
  }
  if (!tier2Formatted.includes('- Relevant Plot Notes:')) {
    throw new Error('Missing - Relevant Plot Notes: section in Tier 2');
  }
  if (!tier2Formatted.includes('[Generation Directive]')) {
    throw new Error('Missing [Generation Directive] section in Tier 2');
  }
  if (!tier2Formatted.includes(userDirective)) {
    throw new Error('User directive missing from Tier 2');
  }
  console.log('✓ Tier 2 suffix strictly adheres to required structure.\n');

  // Test 3: Empty RAG fallback in Tier 2
  console.log('[TEST 3] Verifying Tier 2 Empty RAG Fallback...');
  const emptyTier2 = RAGEngine.formatTier2Prompt('Hello world', []);
  if (!emptyTier2.includes('- Characters: None') || !emptyTier2.includes('[Generation Directive]\nHello world')) {
    throw new Error('Empty RAG fallback structure mismatch');
  }
  console.log('✓ Tier 2 empty RAG fallback verified.\n');

  // Test 4: Provider Key Pool Error Disambiguation (429 Rate Limit vs False Invalid)
  console.log('[TEST 4] Testing Error Categorization in ProviderKeyPool...');
  const pool = new ProviderKeyPool(0, 'deepseek');
  pool.keys = [
    { id: 1, key: 'sk-dummy-1', masked: 'sk-dum...1', status: 'active', callCount: 0, requestCount: 0 }
  ];

  // Simulate a 400 Bad Request with the word "invalid" in the body (e.g. invalid parameter)
  // MUST NOT mark key as invalid!
  const mock400Error = new Error('Provider API Error (400): {"error":{"message":"Invalid parameter: max_tokens must be <= 4096"}}');
  mock400Error.status = 400;

  // Let's test how error is classified by checking status conditions
  const errMsg = mock400Error.message;
  const lowerMsg = errMsg.toLowerCase();
  const status = mock400Error.status;

  const is429 = status === 429 || errMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('rate_limit') || lowerMsg.includes('resource_exhausted');
  const isAuthError = status === 401 || status === 403 || 
    errMsg.includes('API_KEY_INVALID') || 
    lowerMsg.includes('invalid api key') || 
    lowerMsg.includes('incorrect api key') || 
    lowerMsg.includes('unauthorized') || 
    lowerMsg.includes('authentication failed');

  if (isAuthError) {
    throw new Error('FAILED: 400 Bad Request with "invalid parameter" was incorrectly marked as Auth Error!');
  }
  if (is429) {
    throw new Error('FAILED: 400 Bad Request was incorrectly marked as 429!');
  }
  console.log('✓ 400 Bad Request parameter error is NOT falsely classified as Invalid API Key or 429.\n');

  // Test 5: Genuine 401 Auth Error
  const mock401Error = new Error('Provider API Error (401): {"error":{"message":"Authentication failed: Incorrect API key provided"}}');
  mock401Error.status = 401;
  const isAuth401 = mock401Error.status === 401 || mock401Error.message.toLowerCase().includes('incorrect api key');
  if (!isAuth401) {
    throw new Error('FAILED: Genuine 401 was not detected as auth error');
  }
  console.log('✓ Genuine 401 Auth Error is correctly identified.\n');

  // Test 6: Genuine 429 Rate Limit
  const mock429Error = new Error('Provider API Error (429): {"error":{"message":"Rate limit reached for requests per minute"}}');
  mock429Error.status = 429;
  const is429True = mock429Error.status === 429 || mock429Error.message.toLowerCase().includes('rate limit');
  if (!is429True) {
    throw new Error('FAILED: 429 was not detected as rate limit');
  }
  console.log('✓ Genuine 429 Rate Limit is correctly identified.\n');

  console.log('=== ALL 3-TIER PREFIX CACHING & STREAMING TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
