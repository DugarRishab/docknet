import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';

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
    powDuration?: number;
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

// API hooks
export function useTangleData(runId: number = 0, limit: number = 500, offset: number = 0) {
  return useQuery({
    queryKey: ['tangle', runId, limit, offset],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/tangle/all`, {
        params: { runId, limit, offset }
      });
      return response.data.data as TangleData;
    },
    staleTime: 5000,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export function useTransaction(txId: string | null, runId: number = 0) {
  return useQuery({
    queryKey: ['transaction', txId, runId],
    queryFn: async () => {
      if (!txId) return null;
      const response = await axios.get(`${API_BASE}/tangle/${txId}`, {
        params: { runId }
      });
      return response.data.data.transaction as Transaction;
    },
    enabled: !!txId,
  });
}

export function useTransactionHops(txId: string | null, runId: number = 0) {
  return useQuery({
    queryKey: ['transaction-hops', txId, runId],
    queryFn: async () => {
      if (!txId) return null;
      const response = await axios.get(`${API_BASE}/tangle/${txId}/hops`, {
        params: { runId }
      });
      return response.data.data as TransactionHops;
    },
    enabled: !!txId,
  });
}

export function useCompareTransactions(txIds: string[], runId: number = 0) {
  return useQuery({
    queryKey: ['compare-transactions', txIds, runId],
    queryFn: async () => {
      if (txIds.length < 2) return null;
      const ids = txIds.join(',');
      const response = await axios.get(`${API_BASE}/tangle/compare/transactions`, {
        params: { ids, runId }
      });
      return response.data.data as ComparisonResult;
    },
    enabled: txIds.length >= 2,
  });
}

export function usePeerTopology(runId: number = 0) {
  return useQuery({
    queryKey: ['peer-topology', runId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/peers/topology`, {
        params: { runId }
      });
      return response.data.data as PeerTopology;
    },
    staleTime: 5000,
    refetchInterval: 15000,
  });
}

export function useNodeStatus(runId: number = 0) {
  return useQuery({
    queryKey: ['node-status', runId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/peers/nodes/status`, {
        params: { runId }
      });
      return response.data.data as { nodes: NodeStatus[]; totalNodes: number; healthyNodes: number; unhealthyNodes: number };
    },
    staleTime: 3000,
    refetchInterval: 5000,
  });
}

// Utility hook for invalidating queries
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    invalidateTangle: () => queryClient.invalidateQueries({ queryKey: ['tangle'] }),
    invalidatePeers: () => queryClient.invalidateQueries({ queryKey: ['peer-topology'] }),
    invalidateNodes: () => queryClient.invalidateQueries({ queryKey: ['node-status'] }),
  };
}
