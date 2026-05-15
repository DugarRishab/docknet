// Tangle data interfaces
export interface Transaction {
  id?: string;
  data: {
    transaction_id: string;
    sender: string;
    receiver: string;
    amount: number;
    unit?: string;
    timestamp: number;
    parents: string[];
    price_per_unit?: number;
    currency?: string;
  };
  metadata?: {
    cumulative_weight: number;
    weightMap?: string[];
    signature1?: string;
    signature2?: string;
    checksum?: string;
    consensusTimestamp?: number;
    consensusDuration?: number;
    verificationTimestamp?: number;
    verificationDuration?: number;
    tsaDuration?: number;
    completionDuration?: number;
    propagationDelay?: number;
    avgPropagationDelay?: number;
    hops?: Array<{ timestamp: number; uid: string }>;
  };
  _originNode?: string;
}

export interface TangleData {
  transactions: Transaction[];
  total: number;
  nodes: number;
  runId: number;
  limit: number;
  offset: number;
}

export interface Hop {
  timestamp: number;
  nodeId: string;
  relativeDelay: number;
}

export interface TransactionHops {
  transactionId: string;
  hops: Hop[];
  totalHops: number;
  propagationDelay: number;
  avgPropagationDelay: number;
  firstHop: number;
  lastHop: number;
}

export interface ComparisonResult {
  transactions: Array<{
    id: string;
    sender: string;
    receiver: string;
    timestamp: number;
    hops: Hop[];
    propagationDelay: number;
    avgPropagationDelay: number;
    cumulativeWeight: number;
  }>;
  comparison: {
    commonNodes: string[];
    pathLengths: Array<{ id: string; hops: number; propagationDelay: number }>;
    fastestTransaction: string;
    slowestTransaction: string;
    averageHops: number;
    averagePropagationDelay: number;
  };
  count: number;
}

// Peer data interfaces
export interface PeerNode {
  id: string;
  label: string;
  peerCount: number;
  connectedPeers: Array<{
    id: string;
    state: number;
    address: string;
    port: number;
  }>;
  state: string;
}

export interface PeerEdge {
  source: string;
  target: string;
  state: number;
  connectionTime?: number;
}

export interface PeerTopology {
  nodes: PeerNode[];
  edges: PeerEdge[];
  stats: {
    totalNodes: number;
    totalConnections: number;
    avgConnections: number;
    mostConnectedNodes: Array<{ id: string; peerCount: number }>;
  };
}

export interface NodeStatus {
  nodeId: string;
  hasTangle: boolean;
  hasPeers: boolean;
  hasMetrics: boolean;
  lastUpdated: string | null;
  transactionCount: number;
  peerCount: number;
  health: 'healthy' | 'partial' | 'unhealthy' | 'unknown';
}

// Run and Node interfaces
export interface Run {
  id: number;
  run_id: number;
  label?: string | null;
  started_at: string;
  ended_at: string | null;
  node_count: number;
  nodes_expected?: number;
  nodes_reported?: number;
  tx_count?: number;
  actual_tx_per_node?: number;
  tx_delay?: number;
  max_peers?: number;
  orphan_ttl?: number;
  orphan_pool_max?: number;
  rate_limit_base?: number;
  rate_limit_burst?: number;
  rate_limit_window_sec?: number;
  monitor_period?: number;
  wait?: number;
  status: 'running' | 'complete' | 'incomplete' | 'completed' | 'failed';
  /** total simulation duration in milliseconds (ended_at − started_at) */
  duration?: number | null;
  consistencyScore?: number;
}

export interface Node {
  id: number;
  run_id: number;
  node_index: number;
  original_node_id: string;
  node_ip: string | null;
  created_at: string;
}

// Simulation parameters
export interface SimulationParams {
  node_count: number;
  tx_count: number;
  tx_delay: number;
  max_peers: number;
  orphan_ttl: number;
  orphan_pool_max: number;
  rate_limit_base: number;
  rate_limit_burst: number;
  rate_limit_window_sec: number;
  monitor_period: number;
  wait: number;
}

// Filter and view state
export interface FilterState {
  nodeIds: string[];
  timeRange: [number, number] | null;
  consensusStatus: 'all' | 'confirmed' | 'pending';
  weightRange: [number, number] | null;
  searchQuery: string;
}

export interface LayerState {
  showLabels: boolean;
  showEdges: boolean;
  showWeights: boolean;
  highlightPath: boolean;
}

// Report interfaces
export interface ReportData {
  runId: number;
  metadata: {
    started_at: string;
    ended_at: string | null;
    node_count: number;
    tx_count: number;
  };
  statistics: {
    totalTransactions: number;
    totalNodes: number;
    avgPropagationDelay: number;
    avgConsensusTime: number;
    consistencyScore: number;
  };
  consistency: {
    missingTransactions: Array<{
      nodeId: string;
      missingCount: number;
      missingTxIds: string[];
    }>;
    consistencyMatrix: Record<string, Record<string, number>>;
  };
  propagation: {
    distribution: number[];
    min: number;
    max: number;
    median: number;
  };
  consensus: {
    distribution: number[];
    min: number;
    max: number;
    median: number;
  };
}

// Telemetry message
export interface TelemetryMessage {
  node_id: string;
  tx_id: string;
  tx_time_ms: number;
  timestamp: string;
}

// Run Summary interface
export interface RunSummary {
  runId: number;
  label?: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  nodes: number;
  totalTransactions: number;
  uniqueTransactions: number;
  totalPeers: number;
  nodesWithMetrics: number;
  maxDagDepth: number;
  genesisWeight: number;
  avgVerificationTime: number;
  avgCompletionTime: number;
  avgPropagationDelay: number;
  nodeStats: Array<{
    nodeId: string;
    nodeIndex: number;
    nodeIp: string;
  }>;
  recentTelemetry: TelemetryMessage[];
}

// Visualizer state
export type ViewTab = 'tangle' | 'peers' | 'hops' | 'report';

export type ViewMode = '2d' | '3d';
