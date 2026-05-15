import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Run } from '@/types';

export interface DashboardSummary {
  totalRuns: number;
  completedRuns: number;
  totalNodes: number;
  totalTransactions: number;
}

export interface HeatmapCell {
  txPerNode: number;
  nodeCount: number;
  exists: boolean;
}

export interface DashboardHeatmap {
  buckets: HeatmapCell[];
  txPerNodeRanges: number[];
  nodeCountRanges: number[];
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      // Compute from runs data since we don't have a dedicated API yet
      const response = await apiClient.get('/tangle/runs');
      const runs: Run[] = response.data.data.runs || [];

      return {
        totalRuns: runs.length,
        completedRuns: runs.filter((r) => r.status === 'completed').length,
        totalNodes: runs.reduce((sum, r) => sum + (r.node_count || 0), 0),
        totalTransactions: runs.reduce((sum, r) => sum + (r.tx_count || 0), 0),
      } as DashboardSummary;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function useDashboardHeatmap() {
  return useQuery({
    queryKey: ['dashboard', 'heatmap'],
    queryFn: async () => {
      const response = await apiClient.get('/tangle/runs');
      const runs: Run[] = response.data.data.runs || [];

      // Generate ranges
      const txPerNodeRanges = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
      const nodeCountRanges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // Calculate buckets
      const buckets: HeatmapCell[] = [];

      for (const nodeCount of nodeCountRanges) {
        for (const txPerNode of txPerNodeRanges) {
          // Check if any run falls into this bucket
          const exists = runs.some((run) => {
            if (run.node_count !== nodeCount) return false;
            if (!run.tx_count || run.node_count === 0) return false;
            const runTxPerNode = run.tx_count / run.node_count;
            const bucketTxPerNode = Math.floor(runTxPerNode / 5) * 5;
            return bucketTxPerNode === txPerNode;
          });

          buckets.push({ txPerNode, nodeCount, exists });
        }
      }

      return {
        buckets,
        txPerNodeRanges,
        nodeCountRanges,
      } as DashboardHeatmap;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}
