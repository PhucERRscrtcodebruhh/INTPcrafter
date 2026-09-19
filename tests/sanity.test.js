import { RAGEngine } from '../server/ragEngine.js';
import { 
  getModelContextLimit, 
  estimateTokens, 
  calculateContextTokens, 
  applyRollingContext 
} from '../server/tokenUtils.js';
import { keyPool } from '../server/geminiPool.js';
import { pool } from '../server/db.js';

async function runTests() {
  console.log('=== TEST SUITE: STORYCONTAINER ENGINE ===\n');

  // Test 1: Token Estimator & Rolling Context Window
  console.log('[TEST 1] Testing Token Estimator & Rolling Context...');
  const testText = "Kaelen Vance activates his aether rapier in Sector 07.";
  const tokens = estimateTokens(testText);
  console.log(`- Text: "${testText}"`);
  console.log(`- Estimated tokens: ${tokens} (Expect ~12-16)`);
  if (tokens < 10 || tokens > 25) throw new Error('Token estimation abnormal');

  const modelLimit = getModelContextLimit('gemini-3.8-flash');
  console.log(`- gemini-3.8-flash context limit: ${modelLimit} tokens`);
  if (modelLimit !== 1048576) throw new Error('Model limit lookup failed');

  // Test rolling window pruning
  const dummyHistory = [
    { role: 'user', content: 'Turn 1: Entering the conduit.' },
    { role: 'model', content: 'Turn 1 AI: The air smells of coolant and flux.' },
    { role: 'user', content: 'Turn 2: Drawing the rapier.' },
    { role: 'model', content: 'Turn 2 AI: The blade hums with resonant frequency.' },
    { role: 'user', content: 'Turn 3: Approaching the vault gate.' },
  ];
  const rollRes = applyRollingContext(dummyHistory, 'Master System Instruction', '', 50);
  console.log(`- Rolling Context with tight threshold (50 tokens):`);
  console.log(`  originalCount=${rollRes.originalCount}, keptCount=${rollRes.keptCount}, isRolled=${rollRes.isRolled}`);
  if (!rollRes.isRolled || rollRes.keptCount >= rollRes.originalCount) {
    throw new Error('Rolling context did not prune properly under tight threshold');
  }
  console.log('✓ Token & Rolling Context Window passed.\n');

  // Test 2: RAG Engine MySQL Entity & Keyword Retrieval
  console.log('[TEST 2] Testing MySQL RAG Engine...');
  const ragResult = await RAGEngine.retrieveLore({
    currentPrompt: "Kaelen prepares to channel Aether despite the risk of Flux Burn.",
    recentMessages: []
  });
  console.log(`- Retrieved ${ragResult.retrievedLore.length} lore entries.`);
  ragResult.retrievedLore.forEach(l => {
    console.log(`  * [${l.category}] ${l.title} (Match: ${l.matchReason})`);
  });
  if (ragResult.retrievedLore.length === 0) {
    throw new Error('RAG engine failed to match seeded lore');
  }
  console.log('✓ RAG Engine entity matching passed.\n');

  // Test 3: Key Pool Telemetry & Status
  console.log('[TEST 3] Testing Key Pool initialization & telemetry...');
  await keyPool.init();
  const poolStatus = keyPool.getStatus();
  console.log(`- Key Pool status: ${poolStatus.length} keys loaded.`);
  console.log('✓ Key Pool telemetry passed.\n');

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
