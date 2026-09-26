import { pool } from '../server/db.js';
(async () => {
  try {
    const [rows] = await pool.query('SELECT 1 as connected');
    console.log('DB connected:', rows);
    process.exit(0);
  } catch (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
})();
