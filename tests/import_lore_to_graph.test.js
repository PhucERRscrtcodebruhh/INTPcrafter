import { initDatabase, pool } from '../server/db.js';

async function runTests() {
  console.log('=== TEST SUITE: IMPORT FROM LOREBOOK TO GRAPH CANVAS ===\n');

  try {
    // 1. Initialize DB
    console.log('[TEST 1] Initializing Database & Seed Data...');
    await initDatabase();

    // Create a dedicated test book
    const [bookRes] = await pool.query(
      `INSERT INTO lore_books (title, description, language) VALUES ('Test World for Import', 'World created for testing lore import to graph', 'vi')`
    );
    const testBookId = bookRes.insertId;

    // Create 4 polymorphic lore entries for this world
    const entries = [
      {
        category: 'Character',
        title: 'Lâm Tiêu (Protagonist)',
        aliases: 'Lâm Sư Huynh, Tiêu Ca',
        rules: 'RULE: Cấm tiết lộ nguồn gốc dị giới.',
        content: 'Một đệ tử ngoại môn trầm ổn, sở hữu Hóa Học Đan Điền bí ẩn.',
        metadata: JSON.stringify({
          role: 'Protagonist / Alchemist',
          realmOrLevel: 'Luyện Khí Tầng 3',
          abilities: ['Ngoại Đan Thuật', 'Đốt Cháy Hydro'],
          personalityTraits: 'Cẩn trọng, thực dụng, ghét phiền phức.'
        })
      },
      {
        category: 'MagicSystem',
        title: 'Hóa Học Đan Đạo Hệ Thống',
        aliases: 'Hóa Học Công Pháp',
        rules: 'RULE: Mọi phản ứng phải tuân thủ định luật bảo toàn khối lượng.',
        content: 'Hệ thống dùng nguyên lý phản ứng hóa học vô cơ và hữu cơ để luyện đan và chiến đấu.',
        metadata: JSON.stringify({
          type: 'Chemistry',
          resourceCost: 'Năng lượng ATP và Dược liệu thô',
          formulaOrEquation: '2H_2 + O_2 \\rightarrow 2H_2O + \\Delta H',
          unlockConditions: 'Cần hiểu bảng tuần hoàn Mendeleev'
        })
      },
      {
        category: 'Location',
        title: 'Thanh Vân Tông - Ngoại Vi Dược Viên',
        aliases: 'Dược Viên Số 9',
        rules: 'RULE: Cấm đánh nhau trong phạm vi dược viên.',
        content: 'Khu vực trồng linh thảo hạ phẩm dưới chân núi Thanh Vân Tông.',
        metadata: JSON.stringify({
          environmentType: 'Thung lũng ẩm ướt, nhiều linh khí loãng',
          controllingFaction: 'Thanh Vân Môn',
          hazardsOrResources: 'Linh Thảo Nhất Giai, Băng Tinh Thảo'
        })
      },
      {
        category: 'Event',
        title: 'Dược Điển Khảo Hạch Thất Bại',
        aliases: 'Khảo Hạch Năm Thứ 3',
        rules: 'RULE: Trượt khảo hạch bị giáng cấp làm tạp dịch.',
        content: 'Lâm Tiêu cố tình che giấu thực lực trong kỳ thi tuyển đan sư.',
        metadata: JSON.stringify({
          timeAnchor: 'Đại Lục Lịch Năm 3042',
          participants: ['Lâm Tiêu', 'Đan Các Trưởng Lão'],
          outcome: 'Lâm Tiêu an toàn ẩn mình tại Dược Viên.'
        })
      }
    ];

    const insertedEntryIds = [];
    for (const e of entries) {
      const [r] = await pool.query(
        `INSERT INTO lore_entries (book_id, world_id, category, title, aliases, rules, content, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testBookId, String(testBookId), e.category, e.title, e.aliases, e.rules, e.content, e.metadata]
      );
      insertedEntryIds.push(r.insertId);
    }
    console.log(`✓ Created test book #${testBookId} with ${insertedEntryIds.length} polymorphic lore entries.\n`);

    // 2. Simulate Node Generation Logic (Grid Auto-Layout)
    console.log('[TEST 2] Simulating Node Generation from Lore Entries...');
    const [fetchedEntries] = await pool.query(
      `SELECT id, category, title, aliases, rules, content, metadata FROM lore_entries WHERE book_id = ?`,
      [testBookId]
    );

    const COLS = 3;
    const COL_WIDTH = 380;
    const ROW_HEIGHT = 320;
    const baseX = 100;
    const baseY = 100;

    const canvasNodes = fetchedEntries.map((entry, idx) => {
      const meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata || '{}') : (entry.metadata || {});
      const x = baseX + (idx % COLS) * COL_WIDTH;
      const y = baseY + Math.floor(idx / COLS) * ROW_HEIGHT;

      let nodeType = 'system';
      let nodeData = {};

      if (entry.category === 'Character') {
        nodeType = 'character';
        nodeData = {
          loreEntryId: entry.id,
          name: entry.title,
          role: meta.role || 'Character',
          currentRealm: meta.realmOrLevel || 'Mortal',
          abilities: meta.abilities || [],
          personality: meta.personalityTraits || entry.content
        };
      } else if (entry.category === 'MagicSystem') {
        nodeType = 'system';
        nodeData = {
          loreEntryId: entry.id,
          systemName: entry.title,
          type: meta.type || 'Magic',
          formulaOrEquation: meta.formulaOrEquation || ''
        };
      } else if (entry.category === 'Location') {
        nodeType = 'location';
        nodeData = {
          loreEntryId: entry.id,
          name: entry.title,
          environment: meta.environmentType,
          controllingFaction: meta.controllingFaction
        };
      } else if (entry.category === 'Event') {
        nodeType = 'event';
        nodeData = {
          loreEntryId: entry.id,
          eventTitle: entry.title,
          timestampOrEpoch: meta.timeAnchor,
          participants: meta.participants
        };
      }

      return {
        id: `lore_${entry.id}`,
        type: nodeType,
        position: { x, y },
        data: nodeData
      };
    });

    if (canvasNodes.length !== 4) throw new Error('Expected 4 generated nodes, got: ' + canvasNodes.length);
    if (canvasNodes[0].type !== 'character' || canvasNodes[0].data.name !== 'Lâm Tiêu (Protagonist)') {
      throw new Error('Character node mapping failure: ' + JSON.stringify(canvasNodes[0]));
    }
    if (canvasNodes[1].type !== 'system' || !canvasNodes[1].data.formulaOrEquation) {
      throw new Error('MagicSystem node mapping failure: ' + JSON.stringify(canvasNodes[1]));
    }
    console.log('✓ Successfully mapped all polymorphic lore entries into React Flow canvas nodes.\n');

    // 3. Persist Graph State to MySQL
    console.log('[TEST 3] Persisting Imported Graph State to MySQL graph_states table...');
    const graphId = `graph_${testBookId}`;
    const nodesJson = JSON.stringify(canvasNodes);
    const edgesJson = JSON.stringify([]);

    await pool.query(
      `INSERT INTO graph_states (id, world_id, nodes, edges) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nodes = VALUES(nodes), edges = VALUES(edges)`,
      [graphId, String(testBookId), nodesJson, edgesJson]
    );

    const [savedGraph] = await pool.query(`SELECT * FROM graph_states WHERE world_id = ?`, [String(testBookId)]);
    if (savedGraph.length === 0) throw new Error('Failed to find saved graph in DB');
    
    const parsedNodes = typeof savedGraph[0].nodes === 'string' ? JSON.parse(savedGraph[0].nodes) : savedGraph[0].nodes;
    if (parsedNodes.length !== 4) throw new Error('Saved nodes count mismatch: ' + parsedNodes.length);
    console.log('✓ Verified graph state retrieval from MySQL with all 4 imported nodes.\n');

    // 4. Clean up test data
    console.log('[TEST 4] Cleaning up test book and graph...');
    await pool.query(`DELETE FROM lore_entries WHERE book_id = ?`, [testBookId]);
    await pool.query(`DELETE FROM graph_states WHERE world_id = ?`, [String(testBookId)]);
    await pool.query(`DELETE FROM lore_books WHERE id = ?`, [testBookId]);
    console.log('✓ Test cleanup complete.\n');

    console.log('=== ALL LOREBOOK IMPORT TO GRAPH TESTS PASSED! ===');
    process.exit(0);
  } catch (err) {
    console.error('✗ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
