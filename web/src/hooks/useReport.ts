import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ReportData } from '@/types';

export function useReport(runId: number) {
  return useQuery({
    queryKey: ['report', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/report/${runId}`);
      return response.data.data as ReportData;
    },
    enabled: runId >= 0,
  });
}

export function useConsistency(runId: number) {
  return useQuery({
    queryKey: ['consistency', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/report/${runId}/consistency`);
      return response.data.data;
    },
    enabled: runId >= 0,
  });
}
