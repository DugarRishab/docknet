import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface QueueItem {
  id: number;
  position: number;
  label: string | null;
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
  status: 'pending' | 'started' | 'completed' | 'error';
  run_id: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface QueueListResponse {
  status: string;
  count: number;
  total: number;
  data: {
    items: QueueItem[];
  };
}

// Query hook for listing queue
export function useQueue(pollInterval = 5000) {
  return useQuery<QueueItem[], Error>({
    queryKey: ['queue'],
    queryFn: async () => {
      const response = await apiClient.get<QueueListResponse>('/simulations/queue');
      return response.data.data.items;
    },
    staleTime: 3000,
    refetchInterval: pollInterval,
  });
}

// Mutation hook for adding queue item
export function useAddQueueItem() {
  const queryClient = useQueryClient();

  return useMutation<QueueItem, Error, {
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
  }>({
    mutationFn: async (params) => {
      const response = await apiClient.post('/simulations/queue', params);
      return response.data.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for removing queue item
export function useRemoveQueueItem() {
  const queryClient = useQueryClient();

  return useMutation<{ id: number; deleted: boolean }, Error, number>({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/simulations/queue/${id}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for updating queue item
export function useUpdateQueueItem() {
  const queryClient = useQueryClient();

  return useMutation<QueueItem, Error, {
    id: number;
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
  }>({
    mutationFn: async ({ id, ...params }) => {
      const response = await apiClient.patch(`/simulations/queue/${id}`, params);
      return response.data.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for bulk adding queue items
export function useBulkAddQueueItems() {
  const queryClient = useQueryClient();

  return useMutation<{ count: number; items: QueueItem[] }, Error, {
    items: Array<{
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
    }>;
  }>({
    mutationFn: async ({ items }) => {
      const response = await apiClient.post('/simulations/queue/bulk', { items });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for reordering queue
export function useReorderQueue() {
  const queryClient = useQueryClient();

  return useMutation<{ reordered: number }, Error, number[]>({
    mutationFn: async (ids) => {
      const response = await apiClient.patch('/simulations/queue/reorder', { ids });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for triggering queue start-now
export function useStartQueueNow() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, void>({
    mutationFn: async () => {
      const response = await apiClient.post('/simulations/queue/start-now');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

// Mutation hook for preempting queue
export function usePreemptQueue() {
  const queryClient = useQueryClient();

  return useMutation<{ preempted: number }, Error, void>({
    mutationFn: async () => {
      const response = await apiClient.post('/simulations/queue/preempt');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
