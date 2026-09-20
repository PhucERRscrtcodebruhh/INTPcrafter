export type NodeCategory = 'character' | 'system' | 'location' | 'event';

export type SystemType = 'Magic' | 'Science' | 'Hybrid' | 'Martial' | 'Divine' | 'Psionic';

export type RelationshipType = 
  | 'OWNS'
  | 'UPGRADES_TO'
  | 'LOCATED_AT'
  | 'MUTUAL_ENEMY'
  | 'REQUIRES_ELEMENT'
  | 'ALLIED_WITH'
  | 'MEMBER_OF'
  | 'CREATES'
  | 'CAUSES'
  | 'PARTICIPATES_IN'
  | 'CONTRADICTS'
  | 'SUB_SYSTEM_OF'
  | 'CUSTOM';

export interface CharacterStatusProgression {
  id: string;
  version: string;
  realmOrLevel: string;
  description: string;
  unlockedAbilities?: string[];
  timestampOrChapter?: string;
}

export interface CharacterNodeData {
  name: string;
  aliases?: string;
  role: string;
  currentRealm: string;
  abilities: string[];
  personality: string;
  statusProgression: CharacterStatusProgression[];
  notes?: string;
  [key: string]: unknown;
}

export interface SystemNodeData {
  systemName: string;
  type: SystemType;
  rulesAndConstraints: string[];
  resourceCost: string;
  unlocks: string[];
  formulaOrEquation?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface LocationNodeData {
  name: string;
  environment: string;
  controllingFaction: string;
  resources: string[];
  hazards?: string;
  coordinatesOrRegion?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface TimelineEventNodeData {
  eventTitle: string;
  timestampOrEpoch: string;
  participants: string[];
  outcome: string;
  consequences?: string;
  canonStatus?: 'Definitive' | 'Draft' | 'Speculative';
  notes?: string;
  [key: string]: unknown;
}

export type WorldNodeData = 
  | CharacterNodeData 
  | SystemNodeData 
  | LocationNodeData 
  | TimelineEventNodeData;

export interface WorldGraphNode {
  id: string;
  type: NodeCategory;
  position: { x: number; y: number };
  data: WorldNodeData;
  selected?: boolean;
}

export interface WorldGraphEdgeData {
  label: string;
  relationshipType: RelationshipType;
  description?: string;
  bidirectional?: boolean;
  intensity?: number;
}

export interface WorldGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: WorldGraphEdgeData;
  label?: string;
  animated?: boolean;
}

export interface GraphTraversalHop {
  nodeId: string;
  node: WorldGraphNode;
  depth: number;
  viaEdge?: WorldGraphEdge;
  direction: 'outgoing' | 'incoming' | 'root';
}

export interface GraphRagContext {
  rootNode: WorldGraphNode | null;
  traversedHops: GraphTraversalHop[];
  nodesByDepth: Record<number, WorldGraphNode[]>;
  totalNodesIncluded: number;
  totalEdgesIncluded: number;
  structuredMarkdown: string;
  jsonGraph: {
    rootNodeId: string;
    depth: number;
    entities: Record<string, unknown>;
    relationships: Array<{
      source: string;
      sourceName: string;
      target: string;
      targetName: string;
      relationship: string;
      description?: string;
    }>;
    aggregatedConstraints: string[];
  };
  estimatedTokens: number;
}
