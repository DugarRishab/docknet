import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000');

interface GenerateReportResponse {
  status: string;
  runId: number;
  reportUrl: string;
  generatedAt: string;
}

/**
 * Mutation hook to trigger Python report generation
 */
export function useGenerateReport(runId: number) {
  const queryClient = useQueryClient();

  return useMutation<GenerateReportResponse, Error, void>({
    mutationFn: async () => {
      const response = await apiClient.post(`/report/${runId}/generate`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate the markdown query so it refetches
      queryClient.invalidateQueries({ queryKey: ['generated-report', runId] });
    },
  });
}

/**
 * Query hook to fetch generated Markdown report content
 */
export function useGeneratedReportMarkdown(runId: number, enabled: boolean = true) {
  return useQuery<string, Error>({
    queryKey: ['generated-report', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/report/${runId}/generated`, {
        responseType: 'text',
        transformResponse: [(data) => data], // Prevent axios from parsing as JSON
      });
      return response.data as string;
    },
    enabled: enabled && runId >= 0,
    staleTime: 60000, // 1 minute
    retry: false,
  });
}

/**
 * Helper to get the full URL for a chart image
 */
export function getChartImageUrl(runId: number, chartFileName: string): string {
  return `${API_BASE}/reports/run_${runId}/charts/${chartFileName}`;
}

/**
 * Fetch self-contained markdown with base64-embedded charts for download
 */
export async function fetchGeneratedReportBundle(runId: number): Promise<string> {
  const response = await apiClient.get(`/report/${runId}/generated/bundle`, {
    responseType: 'text',
    transformResponse: [(data) => data],
  });
  return response.data as string;
}
