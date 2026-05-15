import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  Transaction,
  TangleData,
  TransactionHops,
  ComparisonResult,
  PeerTopology,
  NodeStatus,
  Run,
  Node,
  RunSummary,
} from '@/types';

// API hooks
export function useTangleData(runId: number = 0, limit: number = 500, offset: number = 0) {
  return useQuery({
    queryKey: ['tangle', runId, limit, offset],
    queryFn: async () => {
      const response = await apiClient.get('/tangle/all', {
        params: { runId, limit, offset }
      });
      return response.data.data as TangleData;
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

export function useTransaction(txId: string | null, runId: number = 0) {
  return useQuery({
    queryKey: ['transaction', txId, runId],
    queryFn: async () => {
      if (!txId) return null;
      const response = await apiClient.get(`/tangle/${txId}`, {
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
      const response = await apiClient.get(`/tangle/${txId}/hops`, {
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
      const response = await apiClient.get('/tangle/compare/transactions', {
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
      const response = await apiClient.get('/peers/topology', {
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
      const response = await apiClient.get('/peers/nodes/status', {
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
    invalidateRuns: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  };
}

// New hooks for runs and nodes
export function useAvailableRuns() {
  return useQuery({
    queryKey: ['runs'],
    queryFn: async () => {
      const response = await apiClient.get('/tangle/runs');
      return response.data.data.runs as Run[];
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function useNodes(runId: number = 0) {
  return useQuery({
    queryKey: ['nodes', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/tangle/runs/${runId}/nodes`);
      return response.data.data.nodes as Node[];
    },
    staleTime: 5000,
    refetchInterval: 10000,
    enabled: runId >= 0,
  });
}

export function useRunSummary(runId: number) {
  return useQuery<RunSummary>({
    queryKey: ['run-summary', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/tangle/runs/${runId}/summary`);
      return response.data.data;
    },
    enabled: runId >= 0,
  });
}

// Simulation API
export async function startSimulation(params: {
  label?: string;
  node_count: number;
  tx_count: number;
  tx_delay: number;
  max_peers: number;
  wait: number;
  orphan_ttl: number;
  orphan_pool_max: number;
  rate_limit_base: number;
  rate_limit_burst: number;
  rate_limit_window_sec: number;
  monitor_period: number;
}) {
  const response = await apiClient.post('/simulations/start', params);
  return response.data;
}

export async function deleteRun(runId: number) {
  const response = await apiClient.delete(`/tangle/runs/${runId}`);
  return response.data;
}
