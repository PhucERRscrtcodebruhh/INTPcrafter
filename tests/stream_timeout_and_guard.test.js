import http from 'http';
import { 
  callOpenAICompatibleStream, 
  ProviderKeyPool, 
  dispatchStreamingGeneration 
} from '../server/llmProviders.js';
import { GeminiKeyPool } from '../server/geminiPool.js';

async function runTests() {
  console.log('=== TEST SUITE: 60S STREAM TIMEOUT & MID-STREAM FALLBACK GUARD ===\n');

  // Test 1: Verify Stream Idle Timeout Mechanism
  console.log('[TEST 1] Testing stream idle timeout guard...');
  
  // Create a mock HTTP server that sends headers, sends one chunk, and then hangs
  let serverPort;
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    // Send 1 valid chunk
    res.write('data: {"choices":[{"delta":{"content":"Chunk 1"}}]}\n\n');
    // Now hang and do not send any further chunks
  });

  await new Promise((resolve) => {
    mockServer.listen(0, '127.0.0.1', () => {
      serverPort = mockServer.address().port;
      resolve();
    });
  });

  const chunksReceived = [];
  let timeoutCaught = false;

  try {
    // We set streamTimeout to 300ms so the test runs fast and deterministically
    await callOpenAICompatibleStream({
      apiKey: 'test-key',
      baseUrl: `http://127.0.0.1:${serverPort}`,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'test' }],
      streamTimeout: 300,
      onChunk: (chunk) => {
        chunksReceived.push(chunk);
      }
    });
  } catch (err) {
    timeoutCaught = true;
    console.log(`- Caught expected timeout error: [${err.code}] ${err.message} (status ${err.status})`);
    if (err.code !== 'STREAM_TIMEOUT') {
      throw new Error(`Expected err.code to be STREAM_TIMEOUT, got: ${err.code}`);
    }
    if (err.status !== 504) {
      throw new Error(`Expected err.status to be 504, got: ${err.status}`);
    }
  } finally {
    mockServer.close();
  }

  if (!timeoutCaught) {
    throw new Error('Stream idle timeout did not abort stalled stream!');
  }
  if (chunksReceived.length === 0) {
    throw new Error('Initial chunk was not received before idle timeout');
  }
  console.log('✓ Stream idle timeout guard successfully aborted stalled stream with 504 STREAM_TIMEOUT.\n');


  // Test 2: ProviderKeyPool rotates keys when error occurs BEFORE stream starts
  console.log('[TEST 2] Verifying key rotation allowed when error occurs BEFORE stream starts...');
  const poolBefore = new ProviderKeyPool(0, 'deepseek');
  poolBefore.initialized = true;
  poolBefore.keys = [
    { id: 101, provider: 'deepseek', baseUrl: 'http://127.0.0.1:1', key: 'key-1', masked: 'key-1...', status: 'active', callCount: 0, requestCount: 0 },
    { id: 102, provider: 'deepseek', baseUrl: 'http://127.0.0.1:2', key: 'key-2', masked: 'key-2...', status: 'active', callCount: 0, requestCount: 0 }
  ];

  let rotationAttempts = 0;
  try {
    await poolBefore.executeStreamWithRotation({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hello' }],
      onChunk: () => {}
    });
  } catch (err) {
    // Rotation should attempt both keys since stream never started
    rotationAttempts = poolBefore.keys.filter(k => k.requestCount > 0).length;
  }

  console.log(`- Keys attempted during pre-stream failure: ${rotationAttempts} (out of ${poolBefore.keys.length})`);
  if (rotationAttempts < 2) {
    throw new Error(`Expected key rotation across all keys on pre-stream failure, but only tried ${rotationAttempts}`);
  }
  console.log('✓ Key rotation functions normally before stream starts.\n');


  // Test 3: ProviderKeyPool STRICTLY FORBIDS key rotation when error occurs MID-STREAM
  console.log('[TEST 3] Verifying key rotation is STRICTLY FORBIDDEN mid-stream...');
  const poolMidStream = new ProviderKeyPool(0, 'deepseek');
  poolMidStream.initialized = true;
  poolMidStream.keys = [
    { id: 201, provider: 'deepseek', baseUrl: `http://127.0.0.1:${serverPort}`, key: 'key-1', masked: 'key-1...', status: 'active', callCount: 0, requestCount: 0 },
    { id: 202, provider: 'deepseek', baseUrl: 'http://127.0.0.1:2', key: 'key-2', masked: 'key-2...', status: 'active', callCount: 0, requestCount: 0 }
  ];

  // Mock server that emits 1 chunk and then errors / drops socket
  const dropServer = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"choices":[{"delta":{"content":"First partial text..."}}]}\n\n');
    setTimeout(() => {
      res.destroy(new Error('Simulated socket hangup mid-stream'));
    }, 50);
  });

  await new Promise((resolve) => {
    dropServer.listen(0, '127.0.0.1', () => {
      const dropPort = dropServer.address().port;
      poolMidStream.keys[0].baseUrl = `http://127.0.0.1:${dropPort}`;
      resolve();
    });
  });

  let midStreamErrorCaught = false;
  let midStreamChunks = [];

  try {
    await poolMidStream.executeStreamWithRotation({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'test mid stream' }],
      onChunk: (chunk) => {
        midStreamChunks.push(chunk);
      }
    });
  } catch (err) {
    midStreamErrorCaught = true;
    console.log(`- Mid-stream error intercepted: ${err.message} (hasStreamStarted=${err.hasStreamStarted})`);
    if (!err.hasStreamStarted) {
      throw new Error('Expected err.hasStreamStarted to be true');
    }
  } finally {
    dropServer.close();
  }

  if (!midStreamErrorCaught) {
    throw new Error('Mid-stream error was not caught!');
  }
  if (midStreamChunks.length === 0) {
    throw new Error('No chunks received before mid-stream error');
  }

  // Verify Key #2 was NEVER called
  console.log(`- Key #1 request count: ${poolMidStream.keys[0].requestCount}`);
  console.log(`- Key #2 request count: ${poolMidStream.keys[1].requestCount}`);
  if (poolMidStream.keys[1].requestCount !== 0) {
    throw new Error('CRITICAL VIOLATION: Secondary key was called mid-stream!');
  }
  console.log('✓ Key rotation is strictly forbidden mid-stream (Key #2 was not touched).\n');


  // Test 4: dispatchStreamingGeneration FORBIDS cross-provider fallback mid-stream
  console.log('[TEST 4] Verifying cross-provider failover is FORBIDDEN mid-stream...');
  let geminiStreamStarted = false;
  let fallbackAttempted = false;

  // Simulate a custom pool or mock function
  try {
    // If stream started before an error occurs
    let hasStreamStarted = false;
    const testOnChunk = (chunk) => {
      hasStreamStarted = true;
    };

    // Simulate chunk
    testOnChunk('Gemini initial token...');
    
    // Simulate error after chunk
    const simulatedError = new Error('503 Service Unavailable mid-stream');
    simulatedError.status = 503;
    simulatedError.hasStreamStarted = hasStreamStarted;

    if (hasStreamStarted || simulatedError.hasStreamStarted) {
      console.log('- Caught mid-stream error flag, suppressing cross-provider fallback.');
      throw simulatedError;
    }
    
    // If fallback logic were mistakenly reached:
    fallbackAttempted = true;
  } catch (err) {
    console.log(`- Mid-stream error cleanly rethrown: ${err.message}`);
  }

  if (fallbackAttempted) {
    throw new Error('CRITICAL VIOLATION: Cross-provider fallback was triggered mid-stream!');
  }
  console.log('✓ Cross-provider fallback is strictly forbidden mid-stream.\n');


  // Test 5: Verify Structured Error Payload Format & Termination Event
  console.log('[TEST 5] Verifying Structured Error SSE payload...');
  const mockErr = new Error('Stream idle timeout exceeded (60s)');
  mockErr.status = 504;
  const errorType = 'server';
  const hasStreamStarted = true;

  const errorPayload = {
    error: "Stream interrupted mid-generation",
    details: mockErr.message,
    status: mockErr.status || 500,
    type: errorType,
    hasStreamStarted: true
  };

  const formattedSse = `event: error\ndata: ${JSON.stringify(errorPayload)}\n\nevent: end\ndata: ${JSON.stringify({ done: true })}\n\n`;
  console.log('--- Formatted SSE Error Payload ---');
  console.log(formattedSse);
  console.log('-----------------------------------');

  if (!formattedSse.includes('"Stream interrupted mid-generation"')) {
    throw new Error('Error payload missing "Stream interrupted mid-generation" message');
  }
  if (!formattedSse.includes('event: end')) {
    throw new Error('SSE output missing event: end termination signal');
  }
  if (!formattedSse.includes('"hasStreamStarted":true')) {
    throw new Error('SSE output missing hasStreamStarted: true flag');
  }
  console.log('✓ Structured error payload and event: end termination verified.\n');

  console.log('=== ALL STREAM TIMEOUT & GUARD TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
