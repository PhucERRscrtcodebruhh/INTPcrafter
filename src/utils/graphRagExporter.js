import { estimateTokens } from '../services/tokenEstimator.js';

/**
 * Get human-readable display title for any polymorphic node
 */
export function getNodeTitle(node) {
  if (!node || !node.data) return 'Untitled Node';
  const data = node.data;
  return data.name || data.systemName || data.eventTitle || data.title || `Node #${node.id}`;
}

/**
 * Graph-Based RAG Context Exporter
 * Performs multi-hop BFS traversal starting from selectedNodeId up to maxDepth,
 * collecting entities, relationships, and invariants into deterministic Markdown/JSON.
 *
 * @param {Array} nodes - Array of React Flow nodes
 * @param {Array} edges - Array of React Flow edges
 * @param {string} selectedNodeId - Root node ID to start graph walk
 * @param {number} maxDepth - Max hop degrees (default: 2)
 * @returns {Object} GraphRagContext
 */
export function buildNodeContextGraph(nodes = [], edges = [], selectedNodeId, maxDepth = 2) {
  if (!selectedNodeId || nodes.length === 0) {
    return {
      rootNode: null,
      traversedHops: [],
      nodesByDepth: {},
      totalNodesIncluded: 0,
      totalEdgesIncluded: 0,
      structuredMarkdown: '*(No node selected for Graph RAG extraction)*',
      jsonGraph: { rootNodeId: '', depth: 0, entities: {}, relationships: [], aggregatedConstraints: [] },
      estimatedTokens: 0
    };
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const rootNode = nodeMap.get(selectedNodeId);

  if (!rootNode) {
    return {
      rootNode: null,
      traversedHops: [],
      nodesByDepth: {},
      totalNodesIncluded: 0,
      totalEdgesIncluded: 0,
      structuredMarkdown: `*(Selected node "${selectedNodeId}" not found in graph)*`,
      jsonGraph: { rootNodeId: selectedNodeId, depth: 0, entities: {}, relationships: [], aggregatedConstraints: [] },
      estimatedTokens: 0
    };
  }

  // Multi-hop Breadth-First Search (BFS)
  const visitedNodeIds = new Set([selectedNodeId]);
  const visitedEdgeIds = new Set();
  const hops = [
    {
      nodeId: selectedNodeId,
      node: rootNode,
      depth: 0,
      direction: 'root'
    }
  ];

  const nodesByDepth = {
    0: [rootNode]
  };

  let currentLevelQueue = [selectedNodeId];

  for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
    const nextLevelQueue = [];
    nodesByDepth[currentDepth] = [];

    for (const currentId of currentLevelQueue) {
      // Find all connecting edges (both outgoing and incoming)
      for (const edge of edges) {
        const isOutgoing = edge.source === currentId;
        const isIncoming = edge.target === currentId;

        if (!isOutgoing && !isIncoming) continue;

        const neighborId = isOutgoing ? edge.target : edge.source;
        const neighborNode = nodeMap.get(neighborId);

        if (!neighborNode) continue;

        visitedEdgeIds.add(edge.id);

        if (!visitedNodeIds.has(neighborId)) {
          visitedNodeIds.add(neighborId);
          nextLevelQueue.push(neighborId);
          nodesByDepth[currentDepth].push(neighborNode);

          hops.push({
            nodeId: neighborId,
            node: neighborNode,
            depth: currentDepth,
            viaEdge: edge,
            direction: isOutgoing ? 'outgoing' : 'incoming'
          });
        }
      }
    }

    currentLevelQueue = nextLevelQueue;
    if (currentLevelQueue.length === 0) break;
  }

  // Collect traversed edges list
  const traversedEdges = edges.filter(e => visitedEdgeIds.has(e.id));

  // Extract all system rules and character constraints across the traversed subgraph
  const aggregatedConstraints = [];
  visitedNodeIds.forEach(id => {
    const node = nodeMap.get(id);
    if (!node) return;

    if (node.type === 'system' && node.data?.rulesAndConstraints) {
      const rules = Array.isArray(node.data.rulesAndConstraints)
        ? node.data.rulesAndConstraints
        : [String(node.data.rulesAndConstraints)];
      rules.filter(Boolean).forEach(r => {
        aggregatedConstraints.push(`[${node.data.systemName || 'System Rule'}]: ${r}`);
      });
    }

    if (node.type === 'character' && node.data?.personality) {
      aggregatedConstraints.push(`[${node.data.name} Personality Invariant]: ${node.data.personality}`);
    }

    if (node.type === 'location' && node.data?.hazards) {
      aggregatedConstraints.push(`[${node.data.name} Environmental Hazard]: ${node.data.hazards}`);
    }
  });

  // Build Structured Markdown Output
  const mdSections = [];
  mdSections.push(`# [GRAPH RAG CANON CONTEXT: "${getNodeTitle(rootNode).toUpperCase()}"]`);
  mdSections.push(`*Generated via INTP Deterministic Graph Traversal (Max Depth: ${maxDepth} hops | Nodes in subgraph: ${visitedNodeIds.size} | Interlinks: ${traversedEdges.length})*\n`);

  // Root Section
  mdSections.push(`## 1. PRIMARY FOCUS NODE [ROOT / DEPTH 0]`);
  mdSections.push(formatNodeDetailsMarkdown(rootNode));

  // Direct Connections (Depth 1)
  if (nodesByDepth[1] && nodesByDepth[1].length > 0) {
    mdSections.push(`\n## 2. DIRECT CONNECTIONS & IMMEDIATE CAUSALITY [DEPTH 1]`);
    nodesByDepth[1].forEach(node => {
      // Find edge connecting root and this node
      const connectingEdge = traversedEdges.find(
        e => (e.source === rootNode.id && e.target === node.id) ||
             (e.target === rootNode.id && e.source === node.id)
      );

      const relLabel = connectingEdge?.data?.label || connectingEdge?.label || connectingEdge?.data?.relationshipType || 'CONNECTED_TO';
      const isOut = connectingEdge?.source === rootNode.id;
      const arrow = isOut ? `──[${relLabel}]──>` : `<──[${relLabel}]──`;

      mdSections.push(`\n### Entity: ${getNodeTitle(node)} (${node.type.toUpperCase()})`);
      mdSections.push(`*Relationship with Focus Entity:* \`${arrow}\``);
      if (connectingEdge?.data?.description) {
        mdSections.push(`*Relation Context:* ${connectingEdge.data.description}`);
      }
      mdSections.push(formatNodeDetailsMarkdown(node, true));
    });
  }

  // Extended Connections (Depth >= 2)
  for (let d = 2; d <= maxDepth; d++) {
    if (nodesByDepth[d] && nodesByDepth[d].length > 0) {
      mdSections.push(`\n## ${d + 1}. EXTENDED WORLD CONTEXT & MULTI-HOP GRAPH [DEPTH ${d}]`);
      nodesByDepth[d].forEach(node => {
        mdSections.push(`\n- **${getNodeTitle(node)}** (${node.type}): ${formatNodeShortSummary(node)}`);
      });
    }
  }

  // Invariants & System Constraints
  if (aggregatedConstraints.length > 0) {
    mdSections.push(`\n## MANDATORY WORLD INVARIANTS & CONSTRAINTS`);
    mdSections.push(`*(LLM Simulation Directive: You MUST strictly abide by these physical/magical/personality invariants. Zero contradictions permitted.)*`);
    aggregatedConstraints.forEach((c, idx) => {
      mdSections.push(`${idx + 1}. ${c}`);
    });
  }

  const structuredMarkdown = mdSections.join('\n');

  // Build JSON Graph Output
  const entitiesJson = {};
  visitedNodeIds.forEach(id => {
    const node = nodeMap.get(id);
    if (node) {
      entitiesJson[id] = {
        id: node.id,
        type: node.type,
        title: getNodeTitle(node),
        data: node.data
      };
    }
  });

  const relationshipsJson = traversedEdges.map(e => ({
    id: e.id,
    source: e.source,
    sourceName: getNodeTitle(nodeMap.get(e.source)),
    target: e.target,
    targetName: getNodeTitle(nodeMap.get(e.target)),
    relationship: e.data?.relationshipType || e.data?.label || e.label || 'CONNECTED_TO',
    description: e.data?.description || ''
  }));

  const jsonGraph = {
    rootNodeId: selectedNodeId,
    rootNodeTitle: getNodeTitle(rootNode),
    depth: maxDepth,
    totalNodes: visitedNodeIds.size,
    totalEdges: traversedEdges.length,
    entities: entitiesJson,
    relationships: relationshipsJson,
    aggregatedConstraints
  };

  const estimatedTokens = estimateTokens(structuredMarkdown);

  return {
    rootNode,
    traversedHops: hops,
    nodesByDepth,
    totalNodesIncluded: visitedNodeIds.size,
    totalEdgesIncluded: traversedEdges.length,
    structuredMarkdown,
    jsonGraph,
    estimatedTokens
  };
}

/**
 * Format full node details into clean markdown
 */
function formatNodeDetailsMarkdown(node, isCompact = false) {
  if (!node || !node.data) return '';
  const data = node.data;
  const lines = [];

  switch (node.type) {
    case 'character':
      lines.push(`- **Name:** ${data.name || 'Unknown'}${data.aliases ? ` (Aliases: ${data.aliases})` : ''}`);
      lines.push(`- **Role:** ${data.role || 'Unspecified'}`);
      lines.push(`- **Current Realm / Level:** \`${data.currentRealm || 'Base Level'}\``);
      if (data.abilities && data.abilities.length > 0) {
        lines.push(`- **Canon Abilities:** ${Array.isArray(data.abilities) ? data.abilities.join(', ') : data.abilities}`);
      }
      if (data.personality) {
        lines.push(`- **Psychology & Motivations:** ${data.personality}`);
      }
      if (!isCompact && data.statusProgression && data.statusProgression.length > 0) {
        lines.push(`- **Status Progression History:**`);
        data.statusProgression.forEach((prog, pIdx) => {
          lines.push(`  * **[v${prog.version || pIdx + 1} - ${prog.realmOrLevel || 'Stage'}]:** ${prog.description || 'No log'}`);
        });
      }
      if (data.notes) lines.push(`- **Extra Canon Notes:** ${data.notes}`);
      break;

    case 'system':
      lines.push(`- **System Name:** ${data.systemName || 'Unnamed System'}`);
      lines.push(`- **Classification:** \`${data.type || 'Magic'}\``);
      if (data.resourceCost) {
        lines.push(`- **Resource / Toll:** ${data.resourceCost}`);
      }
      if (data.formulaOrEquation) {
        lines.push(`- **Mathematical / Physical Equation:** $${data.formulaOrEquation}$`);
      }
      if (data.rulesAndConstraints && data.rulesAndConstraints.length > 0) {
        lines.push(`- **Rules & Invariant Limits:**`);
        const rules = Array.isArray(data.rulesAndConstraints) ? data.rulesAndConstraints : [data.rulesAndConstraints];
        rules.forEach(r => lines.push(`  * ${r}`));
      }
      if (data.unlocks && data.unlocks.length > 0) {
        lines.push(`- **Granted Capabilities / Unlocks:** ${Array.isArray(data.unlocks) ? data.unlocks.join(', ') : data.unlocks}`);
      }
      break;

    case 'location':
      lines.push(`- **Location Name:** ${data.name || 'Unnamed Sector'}`);
      lines.push(`- **Environment:** ${data.environment || 'Standard'}`);
      lines.push(`- **Controlling Faction / Authority:** \`${data.controllingFaction || 'Neutral / Unclaimed'}\``);
      if (data.resources && data.resources.length > 0) {
        lines.push(`- **Key Resources / Elements:** ${Array.isArray(data.resources) ? data.resources.join(', ') : data.resources}`);
      }
      if (data.hazards) {
        lines.push(`- **Environmental Hazards:** ${data.hazards}`);
      }
      break;

    case 'event':
      lines.push(`- **Event Title:** ${data.eventTitle || 'Unnamed Event'}`);
      lines.push(`- **Epoch / Timestamp:** \`${data.timestampOrEpoch || 'Current Timeline'}\``);
      if (data.participants && data.participants.length > 0) {
        lines.push(`- **Key Participants:** ${Array.isArray(data.participants) ? data.participants.join(', ') : data.participants}`);
      }
      lines.push(`- **Outcome:** ${data.outcome || 'Pending'}`);
      if (data.consequences) {
        lines.push(`- **Causal Consequences:** ${data.consequences}`);
      }
      break;

    default:
      lines.push(`- **Entity Details:** ${JSON.stringify(data)}`);
      break;
  }

  return lines.join('\n');
}

/**
 * Short one-line summary of node
 */
function formatNodeShortSummary(node) {
  const d = node.data || {};
  switch (node.type) {
    case 'character':
      return `[Realm: ${d.currentRealm || 'N/A'}] Role: ${d.role || 'Character'} | Personality: ${d.personality ? d.personality.slice(0, 60) + '...' : 'N/A'}`;
    case 'system':
      return `[${d.type || 'System'}] Cost: ${d.resourceCost || 'None'} | Unlocks: ${d.unlocks ? (Array.isArray(d.unlocks) ? d.unlocks.join(', ') : d.unlocks) : 'N/A'}`;
    case 'location':
      return `Environment: ${d.environment || 'N/A'} | Faction: ${d.controllingFaction || 'None'}`;
    case 'event':
      return `[Epoch: ${d.timestampOrEpoch || 'N/A'}] Outcome: ${d.outcome ? d.outcome.slice(0, 60) + '...' : 'N/A'}`;
    default:
      return JSON.stringify(d);
  }
}
