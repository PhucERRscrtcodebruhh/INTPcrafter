import { pool, initDatabase } from '../server/db.js';
import { GeminiKeyPool, getPoolForUser, addUserKey, getUserKeyStatus } from '../server/geminiPool.js';

async function runKeyRotationTests() {
  console.log('=== TEST SUITE: API KEY ROTATION & TELEMETRY ===\n');

  // Step 1: Initialize Database & Verify Migration
  console.log('[TEST 1] Initializing Database and checking schema migration...');
  await initDatabase();

  const [vaultCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_keys_vault'`
  );
  const vaultColNames = vaultCols.map(c => c.COLUMN_NAME);
  if (!vaultColNames.includes('request_count') || !vaultColNames.includes('rate_limit_count')) {
    throw new Error('api_keys_vault is missing request_count or rate_limit_count column');
  }

  const [userKeyCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_api_keys'`
  );
  const userKeyColNames = userKeyCols.map(c => c.COLUMN_NAME);
  if (!userKeyColNames.includes('request_count') || !userKeyColNames.includes('rate_limit_count')) {
    throw new Error('user_api_keys is missing request_count or rate_limit_count column');
  }
  console.log('✓ Database columns request_count & rate_limit_count verified in both vault tables.\n');

  // Step 2: Test Non-429 Rotation Delay (Mandatory 2000ms Cooldown on 503 / General Error)
  console.log('[TEST 2] Testing 2-second rotation delay on non-429 error (503 Service Unavailable)...');
  const pool503 = new GeminiKeyPool(0);
  pool503.keys = [
    {
      id: 1,
      key: 'key-test-1',
      hash: 'hash-1',
      masked: 'key1...test',
      status: 'active',
      callCount: 0,
      requestCount: 0,
      rateLimitCount: 0,
      lastUsed: null,
      rateLimitedUntil: null,
      errorMsg: ''
    },
    {
      id: 2,
      key: 'key-test-2',
      hash: 'hash-2',
      masked: 'key2...test',
      status: 'active',
      callCount: 0,
      requestCount: 0,
      rateLimitCount: 0,
      lastUsed: null,
      rateLimitedUntil: null,
      errorMsg: ''
    }
  ];
  pool503.initialized = true;

  // Mock callGeminiApi: First call fails with 503, second succeeds
  let callCount503 = 0;
  pool503.callGeminiApi = async ({ apiKey }) => {
    callCount503++;
    if (apiKey === 'key-test-1') {
      const err = new Error('503 Service Unavailable: High load on Google backend');
      err.status = 503;
      throw err;
    }
    return { text: 'Successful fallback generation', model: 'gemini-3.8-flash' };
  };

  const startTime503 = Date.now();
  const res503 = await pool503.executeWithFallback({
    model: 'gemini-3.8-flash',
    contents: 'Hello'
  });
  const duration503 = Date.now() - startTime503;

  console.log(`  Rotation duration for 503 fallback: ${duration503}ms`);
  if (duration503 < 1900) {
    throw new Error(`Expected rotation delay >= 2000ms, but completed in ${duration503}ms`);
  }
  if (res503.keyUsed.id !== 2) {
    throw new Error(`Expected Key #2 to be used, but got Key #${res503.keyUsed.id}`);
  }
  // Verify request and call counts
  if (pool503.keys[0].requestCount !== 1) throw new Error('Key 1 requestCount should be 1');
  if (pool503.keys[0].callCount !== 0) throw new Error('Key 1 callCount should be 0');
  if (pool503.keys[1].requestCount !== 1) throw new Error('Key 2 requestCount should be 1');
  if (pool503.keys[1].callCount !== 1) throw new Error('Key 2 callCount should be 1');

  const log503HasDelay = res503.rotationLogs.some(log => log.includes('2000ms cooldown'));
  if (!log503HasDelay) {
    throw new Error('Rotation logs missing 2000ms cooldown confirmation');
  }
  console.log('✓ 2-second cooldown delay on non-429 rotation verified successfully.\n');

  // Step 3: Test Immediate Failover on 429 Too Many Requests (0ms delay)
  console.log('[TEST 3] Testing immediate failover on 429 Quota Exceeded (0ms delay)...');
  const pool429 = new GeminiKeyPool(0);
  pool429.keys = [
    {
      id: 1,
      key: 'key-quota-1',
      hash: 'hash-q1',
      masked: 'keyQ1...test',
      status: 'active',
      callCount: 0,
      requestCount: 0,
      rateLimitCount: 0,
      lastUsed: null,
      rateLimitedUntil: null,
      errorMsg: ''
    },
    {
      id: 2,
      key: 'key-quota-2',
      hash: 'hash-q2',
      masked: 'keyQ2...test',
      status: 'active',
      callCount: 0,
      requestCount: 0,
      rateLimitCount: 0,
      lastUsed: null,
      rateLimitedUntil: null,
      errorMsg: ''
    }
  ];
  pool429.initialized = true;

  pool429.callGeminiApi = async ({ apiKey }) => {
    if (apiKey === 'key-quota-1') {
      const err = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for model');
      err.status = 429;
      throw err;
    }
    return { text: 'Success after 429', model: 'gemini-3.8-flash' };
  };

  const startTime429 = Date.now();
  const res429 = await pool429.executeWithFallback({
    model: 'gemini-3.8-flash',
    contents: 'Hello'
  });
  const duration429 = Date.now() - startTime429;

  console.log(`  Rotation duration for 429 failover: ${duration429}ms`);
  if (duration429 >= 1000) {
    throw new Error(`Expected immediate failover (< 1000ms), but took ${duration429}ms`);
  }
  if (pool429.keys[0].rateLimitCount !== 1) {
    throw new Error(`Expected Key 1 rateLimitCount to be 1, got ${pool429.keys[0].rateLimitCount}`);
  }
  if (pool429.keys[0].status !== 'rate_limited') {
    throw new Error(`Expected Key 1 status to be 'rate_limited', got ${pool429.keys[0].status}`);
  }

  const log429Immediate = res429.rotationLogs.some(log => log.includes('Immediate 429 failover') || log.includes('0ms cooldown'));
  if (!log429Immediate) {
    throw new Error('Rotation logs missing 0ms immediate failover confirmation');
  }
  console.log('✓ Immediate failover on 429 (0ms delay) verified successfully.\n');

  // Step 4: Verify Telemetry Status Output
  console.log('[TEST 4] Verifying telemetry status structure (requestCount, callCount, rateLimitCount)...');
  const status = pool429.getStatus();
  if (typeof status[0].requestCount !== 'number' || typeof status[0].rateLimitCount !== 'number') {
    throw new Error('getStatus output is missing requestCount or rateLimitCount metrics');
  }
  console.log('✓ Telemetry metrics in getStatus() verified:', {
    key1: { requests: status[0].requestCount, calls: status[0].callCount, rateLimits: status[0].rateLimitCount },
    key2: { requests: status[1].requestCount, calls: status[1].callCount, rateLimits: status[1].rateLimitCount }
  });

  console.log('\n=== ALL API KEY ROTATION & TELEMETRY TESTS PASSED ===');
  process.exit(0);
}

runKeyRotationTests().catch(err => {
  console.error('\n✗ TEST FAILED:', err);
  process.exit(1);
});
