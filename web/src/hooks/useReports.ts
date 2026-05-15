import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000');

export interface MultiRunReport {
  reportId: string;
  generatedAt: string;
  runCount: number;
  runIds: number[];
  chartsCount: number;
  ready: boolean;
}

export interface ReportFilters {
  nodeRange?: [number, number];
  txRange?: [number, number];
  txDelay?: number;
  maxPeers?: number;
  wait?: number;
  orphanTtl?: number;
  orphanPoolMax?: number;
  rateLimitBase?: number;
  rateLimitBurst?: number;
  rateLimitWindow?: number;
  monitorPeriod?: number;
  status?: 'running' | 'complete' | 'completed' | 'incomplete' | 'failed';
  dateFrom?: string;
  dateTo?: string;
}

export interface FilteredRun {
  id: number;
  run_id: number;
  started_at: string;
  ended_at: string | null;
  status: string;
  nodes_expected: number;
  nodes_reported: number;
  param_node_count: number;
  param_tx_count: number;
  param_tx_delay: number;
  param_max_peers: number;
  param_wait: number;
  param_orphan_ttl: number;
  param_orphan_pool_max: number;
  param_rate_limit_base: number;
  param_rate_limit_burst: number;
  param_rate_limit_window_sec: number;
  param_monitor_period: number;
}

// Query all multi-run reports
export function useMultiRunReports() {
  return useQuery<MultiRunReport[], Error>({
    queryKey: ['multi-run-reports'],
    queryFn: async () => {
      const response = await apiClient.get('/report/multi');
      return response.data.data.reports;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// Query runs by filters
export function useFilteredRuns(filters: ReportFilters, enabled: boolean = true) {
  return useQuery<FilteredRun[], Error>({
    queryKey: ['filtered-runs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.nodeRange) params.append('nodeRange', `${filters.nodeRange[0]},${filters.nodeRange[1]}`);
      if (filters.txRange) params.append('txRange', `${filters.txRange[0]},${filters.txRange[1]}`);
      if (filters.txDelay != null) params.append('txDelay', String(filters.txDelay));
      if (filters.maxPeers != null) params.append('maxPeers', String(filters.maxPeers));
      if (filters.wait != null) params.append('wait', String(filters.wait));
      if (filters.orphanTtl != null) params.append('orphanTtl', String(filters.orphanTtl));
      if (filters.orphanPoolMax != null) params.append('orphanPoolMax', String(filters.orphanPoolMax));
      if (filters.rateLimitBase != null) params.append('rateLimitBase', String(filters.rateLimitBase));
      if (filters.rateLimitBurst != null) params.append('rateLimitBurst', String(filters.rateLimitBurst));
      if (filters.rateLimitWindow != null) params.append('rateLimitWindow', String(filters.rateLimitWindow));
      if (filters.monitorPeriod != null) params.append('monitorPeriod', String(filters.monitorPeriod));
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await apiClient.get(`/report/runs/filter?${params.toString()}`);
      return response.data.data.runs;
    },
    enabled,
  });
}

// Generate multi-run report mutation
export function useGenerateMultiRunReport() {
  const queryClient = useQueryClient();

  return useMutation<
    { status: string; reportId: string; message: string; estimatedTime: string; reportUrl: string; checkStatus: string },
    Error,
    { runIds?: number[]; filters?: ReportFilters }
  >({
    mutationFn: async ({ runIds, filters }) => {
      const response = await apiClient.post('/report/multi/generate', { runIds, filters });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate reports list
      queryClient.invalidateQueries({ queryKey: ['multi-run-reports'] });
    },
  });
}

// Check report status
export function useReportStatus(reportId: string, enabled: boolean = true) {
  return useQuery<{ ready: boolean; status: string; reportId: string }, Error>({
    queryKey: ['report-status', reportId],
    queryFn: async () => {
      const response = await apiClient.get(`/report/multi/${reportId}/status`);
      return response.data;
    },
    enabled: enabled && !!reportId,
    refetchInterval: (query) => {
      const data = query.state?.data;
      return data?.ready ? false : 5000;
    }, // Poll every 5s until ready
  });
}

// Fetch report content
export function useReportContent(reportId: string, enabled: boolean = true) {
  return useQuery<string, Error>({
    queryKey: ['report-content', reportId],
    queryFn: async () => {
      const response = await apiClient.get(`/report/multi/${reportId}`, {
        responseType: 'text',
        transformResponse: [(data) => data],
      });
      return response.data as string;
    },
    enabled: enabled && !!reportId,
    staleTime: 60000,
  });
}

// Delete report mutation
export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (reportId) => {
      await apiClient.delete(`/report/multi/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-run-reports'] });
    },
  });
}

// Helper to get chart URL
export function getMultiRunChartUrl(reportId: string, chartName: string): string {
  return `${API_BASE}/reports/${reportId}/charts/${chartName}`;
}
