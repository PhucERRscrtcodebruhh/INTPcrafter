import { initDatabase, pool } from '../server/db.js';

async function runMigration() {
  console.log('=== STARTING MYSQL POLYMORPHIC LORE & GRAPH MIGRATION ===');
  try {
    await initDatabase();
    
    // Validate schema
    const [loreCols] = await pool.query(`DESCRIBE lore_entries`);
    const colMap = loreCols.map(c => `${c.Field} (${c.Type})`);
    console.log('[VERIFY] lore_entries columns:', colMap);

    const [graphCols] = await pool.query(`DESCRIBE graph_states`);
    console.log('[VERIFY] graph_states columns:', graphCols.map(c => `${c.Field} (${c.Type})`));

    const [connCols] = await pool.query(`DESCRIBE node_connections`);
    console.log('[VERIFY] node_connections columns:', connCols.map(c => `${c.Field} (${c.Type})`));

    console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION ERROR]:', err);
    process.exit(1);
  }
}

runMigration();
