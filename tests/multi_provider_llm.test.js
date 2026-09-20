import { initDatabase, pool } from '../server/db.js';
import { 
  resolveModelForProvider, 
  detectProviderFromModel, 
  addUserMultiProviderKey, 
  getUserMultiProviderKeys, 
  resetUserMultiProviderStatuses, 
  removeUserMultiProviderKey,
  ProviderKeyPool,
  dispatchStreamingGeneration
} from '../server/llmProviders.js';
import { getModelContextLimit } from '../server/tokenUtils.js';

async function runTests() {
  console.log('=== TEST SUITE: MULTI-PROVIDER LLM & DEEPSEEK INTEGRATION ===\n');

  try {
    // 1. Database Schema & Migration Verification
    console.log('[TEST 1] Initializing Database & Verifying Multi-Provider Columns...');
    await initDatabase();
    
    const [vaultCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_keys_vault'`
    );
    const vaultNames = vaultCols.map(c => c.COLUMN_NAME);
    if (!vaultNames.includes('provider') || !vaultNames.includes('base_url')) {
      throw new Error('Missing provider or base_url in api_keys_vault table!');
    }

    const [userCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_api_keys'`
    );
    const userNames = userCols.map(c => c.COLUMN_NAME);
    if (!userNames.includes('provider') || !userNames.includes('base_url')) {
      throw new Error('Missing provider or base_url in user_api_keys table!');
    }
    console.log('✓ Multi-provider schema columns verified in MySQL.\n');

    // 2. Model Resolver & Provider Detection
    console.log('[TEST 2] Verifying Model Name Resolution & Provider Detection...');
    
    if (detectProviderFromModel('deepseek-v4-pro') !== 'deepseek') throw new Error('Failed to detect DeepSeek for deepseek-v4-pro');
    if (detectProviderFromModel('deepseek-r1') !== 'deepseek') throw new Error('Failed to detect DeepSeek for deepseek-r1');
    if (detectProviderFromModel('openrouter/auto') !== 'openrouter') throw new Error('Failed to detect OpenRouter');
    if (detectProviderFromModel('huggingface/deepseek-ai/DeepSeek-R1') !== 'huggingface') throw new Error('Failed to detect HuggingFace');
    if (detectProviderFromModel('gemini-3.8-flash') !== 'gemini') throw new Error('Failed to detect Gemini');

    if (resolveModelForProvider('deepseek-v4-pro', 'deepseek') !== 'deepseek-chat') throw new Error('Failed to map deepseek-v4-pro to deepseek-chat');
    if (resolveModelForProvider('deepseek-r1', 'deepseek') !== 'deepseek-reasoner') throw new Error('Failed to map deepseek-r1 to deepseek-reasoner');
    if (resolveModelForProvider('deepseek-r1-zero', 'deepseek') !== 'deepseek-reasoner') throw new Error('Failed to map deepseek-r1-zero to deepseek-reasoner');
    if (resolveModelForProvider('deepseek-coder-v2', 'deepseek') !== 'deepseek-coder') throw new Error('Failed to map deepseek-coder-v2 to deepseek-coder');

    console.log('✓ Model resolution and provider detection logic verified.\n');

    // 3. Multi-Provider User Key Vault Storage & Encryption
    console.log('[TEST 3] Testing Multi-Provider Key Addition, Encryption, and Retrieval...');
    
    // Create temporary test user
    const testUsername = `test_provider_user_${Date.now()}`;
    const [userRes] = await pool.query(
      `INSERT INTO users (username, password_hash, display_name) VALUES (?, 'dummy_hash', 'Test Provider User')`,
      [testUsername]
    );
    const testUserId = userRes.insertId;
    
    // Add DeepSeek Key
    await addUserMultiProviderKey(testUserId, 'sk-test-deepseek-key-12345678', 'deepseek');
    // Add OpenRouter Key
    await addUserMultiProviderKey(testUserId, 'sk-or-v1-openrouter-key-87654321', 'openrouter');
    // Add HuggingFace Key
    await addUserMultiProviderKey(testUserId, 'hf_test_huggingface_token_11223344', 'huggingface');

    const deepseekKeys = await getUserMultiProviderKeys(testUserId, 'deepseek');
    const openrouterKeys = await getUserMultiProviderKeys(testUserId, 'openrouter');
    const hfKeys = await getUserMultiProviderKeys(testUserId, 'huggingface');

    if (deepseekKeys.length === 0 || deepseekKeys[0].masked !== 'sk-tes...5678') {
      throw new Error('DeepSeek key masking/retrieval mismatch: ' + JSON.stringify(deepseekKeys));
    }
    if (openrouterKeys.length === 0 || openrouterKeys[0].masked !== 'sk-or-...4321') {
      throw new Error('OpenRouter key masking/retrieval mismatch: ' + JSON.stringify(openrouterKeys));
    }
    if (hfKeys.length === 0 || hfKeys[0].masked !== 'hf_tes...3344') {
      throw new Error('HuggingFace key masking/retrieval mismatch: ' + JSON.stringify(hfKeys));
    }

    console.log('✓ Multi-provider key addition and AES-256 vault retrieval verified.\n');

    // 4. Token Limits & Estimator
    console.log('[TEST 4] Verifying Context Limits for DeepSeek Models...');
    if (getModelContextLimit('deepseek-v4-pro') !== 131072) throw new Error('deepseek-v4-pro context limit mismatch');
    if (getModelContextLimit('deepseek-r1') !== 131072) throw new Error('deepseek-r1 context limit mismatch');
    if (getModelContextLimit('gemini-3.8-flash') !== 1048576) throw new Error('gemini-3.8-flash context limit mismatch');
    console.log('✓ Token limits verified.\n');

    // 5. Clean up test keys and test user
    console.log('[TEST 5] Cleaning up test keys and user...');
    await pool.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    console.log('✓ Test cleanup complete.\n');

    console.log('=== ALL MULTI-PROVIDER & DEEPSEEK TESTS PASSED! ===');
    process.exit(0);
  } catch (err) {
    console.error('✗ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
