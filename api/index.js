import app from '../server/app.js';
import { initDatabase } from '../server/db.js';
import { keyPool } from '../server/geminiPool.js';

let initialized = false;
let initPromise = null;
let lastFailureAt = 0;
const INIT_RETRY_COOLDOWN_MS = 30_000;

async function ensureInitialized() {
  if (initialized) return;

  // Do not hammer a dead database on every request: back off for 30s after a failure.
  if (Date.now() - lastFailureAt < INIT_RETRY_COOLDOWN_MS) return;

  if (!initPromise) {
    initPromise = (async () => {
      await initDatabase();
      await keyPool.init();
      initialized = true;
      console.log('[Vercel] Database + key pool initialized.');
    })().finally(() => {
      initPromise = null;
    });
  }

  try {
    await initPromise;
  } catch (err) {
    lastFailureAt = Date.now();
    console.error('[Vercel Serverless Init Error]:', err.message);
  }
}

export default async function handler(req, res) {
  await ensureInitialized();
  return app(req, res);
}
