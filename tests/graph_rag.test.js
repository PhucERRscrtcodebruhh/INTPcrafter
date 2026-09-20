import { buildNodeContextGraph } from '../src/utils/graphRagExporter.js';

async function testGraphRagExporter() {
  console.log('=== TEST SUITE: NODE-BASED GRAPH RAG CONTEXT EXPORTER ===\n');

  const testNodes = [
    {
      id: 'char-1',
      type: 'character',
      position: { x: 0, y: 0 },
      data: {
        name: 'Kaelen Vance',
        aliases: 'The Spire Weaver',
        role: 'Protagonist',
        currentRealm: 'Stage-1 Flux Weaver',
        abilities: ['Obsidian Rapier Weaving', 'Biometric Flux Calibration'],
        personality: 'Pragmatic, calculating. Never surrenders sister data-core.',
        statusProgression: [
          { id: 'p1', version: '1', realmOrLevel: 'Cadet', description: 'Cadet stage' },
          { id: 'p2', version: '2', realmOrLevel: 'Stage-1 Flux Weaver', description: 'Suffered Flux Burn' }
        ]
      }
    },
    {
      id: 'sys-1',
      type: 'system',
      position: { x: 200, y: 0 },
      data: {
        systemName: 'Resonant Aether Weaving',
        type: 'Magic',
        resourceCost: 'Flux Burn cellular necrosis',
        formulaOrEquation: '\\Delta \\Phi = \\int \\omega(t) dt',
        rulesAndConstraints: [
          'RULE 1: Aether requires ambient conductor.',
          'RULE 2: Overdrawing >3 patterns causes acute blindness.',
          'RULE 3: Cold iron dampens resonant frequencies.'
        ],
        unlocks: ['Blade Synthesis', 'Harmonic Sight']
      }
    },
    {
      id: 'loc-1',
      type: 'location',
      position: { x: 0, y: 200 },
      data: {
        name: 'Sector 07: The Drowned Conduits',
        environment: 'Subterranean flooded labyrinth',
        controllingFaction: 'The Iron Synod',
        resources: ['Runoff Aether', 'Cooling Fluid'],
        hazards: 'Open electronics trigger aetheric detonations.'
      }
    },
    {
      id: 'evt-1',
      type: 'event',
      position: { x: 200, y: 200 },
      data: {
        eventTitle: 'The Conduit Collapse',
        timestampOrEpoch: 'Epoch 2099',
        participants: ['Kaelen Vance', 'Iron Synod Enforcers'],
        outcome: 'Synod sealed Sector 07 lower tiers.',
        consequences: 'Kaelen locked in debt.'
      }
    }
  ];

  const testEdges = [
    {
      id: 'e1',
      source: 'char-1',
      target: 'sys-1',
      type: 'relationship',
      data: {
        relationshipType: 'REQUIRES_ELEMENT',
        label: 'REQUIRES_ELEMENT',
        description: 'Taps ambient aether to shape rapier.'
      }
    },
    {
      id: 'e2',
      source: 'char-1',
      target: 'loc-1',
      type: 'relationship',
      data: {
        relationshipType: 'LOCATED_AT',
        label: 'LOCATED_AT',
        description: 'Operating in hiding.'
      }
    },
    {
      id: 'e3',
      source: 'evt-1',
      target: 'char-1',
      type: 'relationship',
      data: {
        relationshipType: 'CAUSES',
        label: 'CAUSES',
        description: 'Inflicted Flux Burn on Kaelen.'
      }
    }
  ];

  // Test 1: 1-Hop Traversal from Character (char-1)
  console.log('[TEST 1] Testing 1-Hop Traversal from Focus Node "char-1"...');
  const rag1 = buildNodeContextGraph(testNodes, testEdges, 'char-1', 1);

  if (rag1.rootNode?.id !== 'char-1') throw new Error('Root node should be char-1');
  if (rag1.totalNodesIncluded !== 4) { // char-1, sys-1 (outgoing), loc-1 (outgoing), evt-1 (incoming)
    throw new Error(`Expected 4 nodes at depth 1, got ${rag1.totalNodesIncluded}`);
  }
  if (!rag1.structuredMarkdown.includes('PRIMARY FOCUS NODE')) {
    throw new Error('Markdown output missing Primary Focus Node header');
  }
  if (!rag1.structuredMarkdown.includes('REQUIRES_ELEMENT')) {
    throw new Error('Markdown output missing REQUIRES_ELEMENT relationship');
  }
  console.log('✓ 1-Hop Graph RAG Context successfully extracted with full attributes and direct relationships.\n');

  // Test 2: 2-Hop Traversal from Event (evt-1)
  console.log('[TEST 2] Testing 2-Hop Multi-Hop Traversal from Event Node "evt-1"...');
  const rag2 = buildNodeContextGraph(testNodes, testEdges, 'evt-1', 2);

  // Depth 0: evt-1
  // Depth 1: char-1 (via e3)
  // Depth 2: sys-1 (via e1 from char-1), loc-1 (via e2 from char-1)
  if (rag2.nodesByDepth[0]?.length !== 1 || rag2.nodesByDepth[0][0].id !== 'evt-1') {
    throw new Error('Depth 0 should have evt-1');
  }
  if (rag2.nodesByDepth[1]?.length !== 1 || rag2.nodesByDepth[1][0].id !== 'char-1') {
    throw new Error('Depth 1 should have char-1');
  }
  if (rag2.nodesByDepth[2]?.length !== 2) {
    throw new Error(`Depth 2 should have 2 nodes (sys-1, loc-1), got ${rag2.nodesByDepth[2]?.length}`);
  }

  // Verify aggregated rules and invariants
  const hasSystemRule = rag2.jsonGraph.aggregatedConstraints.some(c => c.includes('RULE 1'));
  if (!hasSystemRule) {
    throw new Error('Aggregated constraints missing System RULE 1');
  }
  console.log('✓ 2-Hop Multi-Hop Traversal successfully propagated through Event -> Character -> System/Location with aggregated invariants.\n');

  // Test 3: Token Estimation and JSON graph structure
  console.log('[TEST 3] Verifying JSON Graph Schema & Token Estimator...');
  if (typeof rag2.estimatedTokens !== 'number' || rag2.estimatedTokens <= 0) {
    throw new Error('Invalid estimatedTokens');
  }
  if (!rag2.jsonGraph.relationships.some(r => r.relationship === 'REQUIRES_ELEMENT')) {
    throw new Error('JSON graph relationships missing REQUIRES_ELEMENT');
  }
  console.log(`✓ JSON graph structure verified with estimated ${rag2.estimatedTokens} context tokens.\n`);

  console.log('=== ALL NODE-BASED GRAPH RAG EXPORTER TESTS PASSED ===');
  process.exit(0);
}

testGraphRagExporter().catch(err => {
  console.error('✗ TEST FAILED:', err);
  process.exit(1);
});
