import app from '../server/app.js';
import { initDatabase } from '../server/db.js';
import { keyPool } from '../server/geminiPool.js';

let initialized = false;

export default async function handler(req, res) {
  if (!initialized) {
    try {
      await initDatabase();
      await keyPool.init();
      initialized = true;
    } catch (err) {
      console.error('[Vercel Serverless Init Error]:', err.message);
    }
  }
  return app(req, res);
}
