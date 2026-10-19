import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatStream } from '../src/components/ChatStream.js';
import {
  seedChatMessages,
  assembleTier3Context,
  getMessagesFromStore,
  clearSessionMessagesFromStore
} from '../src/services/contextService.ts';
import { buildPromptPayload } from '../src/services/promptBuilder.ts';

async function runChatContextVerification() {
  console.log('=== TEST SUITE: CHAT CONTEXT & DOM VIRTUALIZATION SEPARATION ===\n');

  // Setup headless DOM environment
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root" style="height: 800px; width: 800px;"></div></body></html>', {
    url: 'http://localhost'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const sessionId = 'session_verification_320';
  await clearSessionMessagesFromStore(sessionId);

  // ==========================================
  // PASS CRITERION 1: Seed store with exactly 320 mock messages
  // ==========================================
  console.log('[STEP 1] Seeding persistent store with 320 mock chat messages...');
  const seededMessages = await seedChatMessages(sessionId, 320);

  if (seededMessages.length !== 320) {
    throw new Error(`CRITERION 1 FAILED: Expected 320 seeded messages, got ${seededMessages.length}`);
  }

  const storedInDb = await getMessagesFromStore(sessionId);
  if (storedInDb.length !== 320) {
    throw new Error(`CRITERION 1 FAILED: IndexedDB record count mismatch: expected 320, got ${storedInDb.length}`);
  }
  console.log('✓ PASS: Exactly 320 mock chat messages persisted in IndexedDB.\n');

  // ==========================================
  // PASS CRITERION 2: DOM Node Assertion (<= 15 nodes)
  // ==========================================
  console.log('[STEP 2] Rendering ChatStream in Virtual DOM & inspecting mounted nodes...');
  const rootContainer = dom.window.document.getElementById('root');
  const root = createRoot(rootContainer);

  await act(async () => {
    root.render(
      React.createElement(ChatStream, {
        messages: seededMessages,
        estimateSize: 80,
        overscan: 2,
        virtualizerOptions: {
          observeElementRect: (inst, cb) => {
            cb({ width: 800, height: 800 });
            return () => {};
          },
          observeElementOffset: (inst, cb) => {
            cb(0);
            return () => {};
          }
        }
      })
    );
  });

  const mountedBubbles = dom.window.document.querySelectorAll('.chat-message-bubble');
  const domCount = mountedBubbles.length;

  console.log(`DOM Inspector: Found ${domCount} mounted .chat-message-bubble nodes.`);

  if (domCount > 15) {
    throw new Error(`CRITERION 2 FAILED: Expected <= 15 mounted bubbles, but found ${domCount}! DOM virtualization leaked extra nodes.`);
  }

  if (domCount === 0) {
    throw new Error(`CRITERION 2 FAILED: Virtualizer mounted 0 items.`);
  }

  console.log(`✓ PASS: Mounted DOM nodes strictly pruned to ${domCount} (<= 15 nodes).\n`);

  // ==========================================
  // PASS CRITERION 3: Context Integrity Assertion (320 items intact)
  // ==========================================
  console.log('[STEP 3] Executing assembleTier3Context() & verifying full history preservation...');
  const assembledContext = await assembleTier3Context(sessionId);

  if (assembledContext.length !== 320) {
    throw new Error(`CRITERION 3 FAILED: Context builder truncated history! Expected 320 items, got ${assembledContext.length}`);
  }

  // Ensure first turn from Chapter 1 is present
  const firstMsg = assembledContext[0];
  if (!firstMsg.content.includes('Chapter 1')) {
    throw new Error(`CRITERION 3 FAILED: First message lost! Content: ${firstMsg.content}`);
  }

  // Ensure latest turn from Chapter 16 / step 320 is present
  const lastMsg = assembledContext[319];
  if (!lastMsg.content.includes('step 320') && !lastMsg.content.includes('Chapter 16')) {
    throw new Error(`CRITERION 3 FAILED: Latest turn lost! Content: ${lastMsg.content}`);
  }

  // Execute buildPromptPayload to verify full LLM context payload
  const promptPayload = await buildPromptPayload({
    sessionId,
    userPrompt: 'Advance the chapter 16 story.',
    tier1Core: '[WORLD CORE RULES]\nResonant Aether Weaving Invariants.'
  });

  if (promptPayload.tier3.historyCount !== 320) {
    throw new Error(`CRITERION 3 FAILED: Prompt builder history count mismatch! Expected 320, got ${promptPayload.tier3.historyCount}`);
  }

  if (promptPayload.messages.length !== 321) {
    throw new Error(`CRITERION 3 FAILED: Total messages in payload mismatch! Expected 321 (320 history + 1 directive), got ${promptPayload.messages.length}`);
  }

  console.log(`✓ PASS: Context pipeline read full history from IndexedDB: all 320 items intact without truncation.\n`);

  // Cleanup
  act(() => {
    root.unmount();
  });
  await clearSessionMessagesFromStore(sessionId);

  // ==========================================
  // PASS CRITERION 4: Output Exact Terminal Status
  // ==========================================
  console.log(`[TEST PASSED: DOM pruned to ${domCount} items | Context intact with ${assembledContext.length} items]`);
}

runChatContextVerification().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
