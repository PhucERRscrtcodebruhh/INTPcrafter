import app from './app.js';
import { initDatabase } from './db.js';
import { keyPool } from './geminiPool.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDatabase();
    await keyPool.init();
    app.listen(PORT, () => {
      console.log(`[Server] StoryContainer Engine running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err);
  }
}

start();
