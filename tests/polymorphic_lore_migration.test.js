import assert from 'assert';
import { pool, initDatabase } from '../server/db.js';
import app from '../server/app.js';
import http from 'http';

const PORT = 5599;

async function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(PORT, () => resolve(server));
  });
}

async function request(path, options = {}) {
  const url = `http://localhost:${PORT}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== TEST SUITE: POLYMORPHIC LORE & GRAPH PERSISTENCE ===');
  await initDatabase();
  const server = await startServer();

  try {
    // 1. Create Character Lore with CharacterMetadata
    console.log('\n[TEST 1] Creating Character Lore with Polymorphic Metadata...');
    const charPayload = {
      category: 'Character',
      title: 'Aethel-Unit Zero',
      aliases: ['Zero', 'Archivist Prime'],
      content: 'Synthesized cybernetic vanguard guarding the aetheric archive.',
      canonicalLore: 'Synthesized cybernetic vanguard guarding the aetheric archive.',
      rules: 'RULE: Must maintain quantum cooling. Vulnerable to electromagnetic pulse.',
      metadata: {
        realmOrLevel: 'Phase-3 Ascendant',
        faction: 'Iron Synod Archivists',
        personalityTraits: ['Pragmatic', 'Stoic', 'Hyper-logical'],
        equipmentOrItems: ['Obsidian Core', 'Harmonic Resonator'],
        statusProgression: [
          { version: '1.0', realmOrLevel: 'Cadet', description: 'Base construct' },
          { version: '2.0', realmOrLevel: 'Phase-3 Ascendant', description: 'Overclocked neural conduit' }
        ]
      }
    };

    const createCharRes = await request('/api/lore', {
      method: 'POST',
      body: JSON.stringify(charPayload)
    });
    assert.strictEqual(createCharRes.status, 201, 'Character should be created with 201');
    const createdChar = createCharRes.data;
    assert.strictEqual(createdChar.title, 'Aethel-Unit Zero');
    assert.strictEqual(createdChar.metadata.realmOrLevel, 'Phase-3 Ascendant');
    assert.strictEqual(createdChar.metadata.statusProgression.length, 2);
    console.log('✓ Character created and returned with parsed metadata JSON');

    // 2. Create MagicSystem Lore with MagicSystemMetadata
    console.log('\n[TEST 2] Creating MagicSystem Lore with LaTeX Formula Metadata...');
    const sysPayload = {
      category: 'MagicSystem',
      title: 'Gravitational Flux Weaving',
      aliases: ['Flux Weaving', 'Grav-Weave'],
      rules: 'RULE: Conserves angular momentum. Overdrawing drains stamina exponentially.',
      content: 'Manipulation of gravitational potential wells via harmonic crystal tuning.',
      metadata: {
        type: 'Hybrid',
        rulesAndConstraints: ['Rule 1: Requires attuned crystal', 'Rule 2: Line of sight needed'],
        resourceCost: 'Stamina toll (cellular decay)',
        unlockConditions: 'Completion of Void Crucible',
        formulaOrEquation: '\\oint_{\\partial \\Sigma} \\vec{B} \\cdot d\\vec{\\ell} = \\mu_0 I_{\\text{enc}}'
      }
    };

    const createSysRes = await request('/api/lore', {
      method: 'POST',
      body: JSON.stringify(sysPayload)
    });
    assert.strictEqual(createSysRes.status, 201);
    const createdSys = createSysRes.data;
    assert.strictEqual(createdSys.metadata.type, 'Hybrid');
    assert.strictEqual(createdSys.metadata.formulaOrEquation, '\\oint_{\\partial \\Sigma} \\vec{B} \\cdot d\\vec{\\ell} = \\mu_0 I_{\\text{enc}}');
    console.log('✓ MagicSystem created with LaTeX formula in metadata');

    // 3. Query Lorebook and verify parsed metadata
    console.log('\n[TEST 3] Querying GET /api/lore and verifying metadata deserialization...');
    const listRes = await request('/api/lore?category=Character');
    assert.strictEqual(listRes.status, 200);
    const foundChar = listRes.data.find(e => e.id === createdChar.id || e.title === 'Aethel-Unit Zero');
    if (!foundChar) {
      console.error('Available entries in listRes:', listRes.data.map(d => ({ id: d.id, title: d.title, category: d.category })));
    }
    assert.ok(foundChar, 'Created character should be retrieved in lore list');
    assert.strictEqual(typeof foundChar.metadata, 'object', 'metadata must be deserialized object');
    assert.strictEqual(foundChar.metadata.faction, 'Iron Synod Archivists');
    console.log('✓ Deserialized polymorphic metadata in GET /api/lore verified');

    // 4. Update Lore with modified metadata
    console.log('\n[TEST 4] Updating PUT /api/lore/:id with modified metadata...');
    const updateRes = await request(`/api/lore/${createdChar.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Aethel-Unit Zero (Ascended)',
        metadata: {
          ...createdChar.metadata,
          realmOrLevel: 'Transcendent God-Weaver'
        }
      })
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.title, 'Aethel-Unit Zero (Ascended)');
    assert.strictEqual(updateRes.data.metadata.realmOrLevel, 'Transcendent God-Weaver');
    console.log('✓ Polymorphic metadata updated successfully in MySQL');

    // 5. Test Graph State Persistence (/api/graph/:worldId)
    console.log('\n[TEST 5] Testing Graph State Save & Retrieval (MySQL JSON)...');
    const testWorldId = 'test_world_999';
    const testNodes = [
      { id: 'node-1', type: 'character', position: { x: 100, y: 200 }, data: { name: 'Aethel' } },
      { id: 'node-2', type: 'system', position: { x: 400, y: 200 }, data: { systemName: 'Grav-Weave' } }
    ];
    const testEdges = [
      { id: 'e1-2', source: 'node-1', target: 'node-2', type: 'relationship', label: 'REQUIRES_ELEMENT', data: { relationshipType: 'REQUIRES_ELEMENT' } }
    ];

    const saveGraphRes = await request(`/api/graph/${testWorldId}`, {
      method: 'POST',
      body: JSON.stringify({ nodes: testNodes, edges: testEdges })
    });
    assert.strictEqual(saveGraphRes.status, 200);
    assert.strictEqual(saveGraphRes.data.success, true);
    assert.strictEqual(saveGraphRes.data.nodesCount, 2);
    assert.strictEqual(saveGraphRes.data.edgesCount, 1);

    const getGraphRes = await request(`/api/graph/${testWorldId}`);
    assert.strictEqual(getGraphRes.status, 200);
    assert.strictEqual(getGraphRes.data.worldId, testWorldId);
    assert.strictEqual(getGraphRes.data.nodes.length, 2);
    assert.strictEqual(getGraphRes.data.edges.length, 1);
    assert.strictEqual(getGraphRes.data.edges[0].label, 'REQUIRES_ELEMENT');

    // Verify node_connections table populated
    const [connections] = await pool.query(`SELECT * FROM node_connections WHERE world_id = ?`, [testWorldId]);
    assert.strictEqual(connections.length, 1);
    assert.strictEqual(connections[0].source_node_id, 'node-1');
    assert.strictEqual(connections[0].target_node_id, 'node-2');
    console.log('✓ Graph State saved, retrieved, and node_connections table verified in MySQL');

    // Cleanup test data
    await request(`/api/lore/${createdChar.id}`, { method: 'DELETE' });
    await request(`/api/lore/${createdSys.id}`, { method: 'DELETE' });
    await pool.query(`DELETE FROM graph_states WHERE world_id = ?`, [testWorldId]);
    await pool.query(`DELETE FROM node_connections WHERE world_id = ?`, [testWorldId]);

    console.log('\n=== ALL POLYMORPHIC LORE & GRAPH TESTS PASSED! ===');
  } finally {
    await new Promise(r => server.close(r));
    await pool.end();
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
