import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Transaction, TelemetryMessage } from '@/types';

interface NodeStatus {
  online: boolean;
  lastSeen: number;
  metrics?: {
    transactionCount: number;
    peerCount: number;
  };
}

interface TelemetryState {
  // Connection state
  isConnected: boolean;
  wsError: string | null;
  
  // Data
  transactions: Transaction[];
  nodes: Map<string, NodeStatus>;
  recentTelemetry: TelemetryMessage[];
  selectedTransaction: Transaction | null;
  selectedRunId: number;
  
  // Loading states
  isLoadingTangle: boolean;
  isLoadingPeers: boolean;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setWsError: (error: string | null) => void;
  addTransaction: (tx: Transaction) => void;
  setTransactions: (txs: Transaction[]) => void;
  addTelemetry: (msg: TelemetryMessage) => void;
  updateNodeStatus: (nodeId: string, status: Partial<NodeStatus>) => void;
  setOnlineNodes: (nodeIds: string[]) => void;
  setOfflineNodes: (nodeIds: string[]) => void;
  setSelectedTransaction: (tx: Transaction | null) => void;
  setSelectedRunId: (runId: number) => void;
  clearData: () => void;
  setLoadingTangle: (loading: boolean) => void;
  setLoadingPeers: (loading: boolean) => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  devtools(
    (set) => ({
      isConnected: false,
      wsError: null,
      transactions: [],
      nodes: new Map(),
      recentTelemetry: [],
      selectedTransaction: null,
      selectedRunId: 0,
      isLoadingTangle: false,
      isLoadingPeers: false,

      setConnected: (connected) => set({ isConnected: connected }),
      
      setWsError: (error) => set({ wsError: error }),

      addTransaction: (tx) => {
        set((state) => {
          const exists = state.transactions.find(t => 
            t.data?.transaction_id === tx.data?.transaction_id || 
            t.id === tx.id
          );
          if (exists) return state;
          return { transactions: [...state.transactions, tx] };
        });
      },

      setTransactions: (txs) => set({ transactions: txs }),

      addTelemetry: (msg) => {
        set((state) => ({
          recentTelemetry: [msg, ...state.recentTelemetry].slice(0, 100)
        }));
      },

      updateNodeStatus: (nodeId, status) => {
        set((state) => {
          const nodes = new Map(state.nodes);
          const current = nodes.get(nodeId) || { online: false, lastSeen: 0 };
          nodes.set(nodeId, { ...current, ...status });
          return { nodes };
        });
      },

      setOnlineNodes: (nodeIds) => {
        set((state) => {
          const nodes = new Map(state.nodes);
          nodeIds.forEach(id => {
            const current = nodes.get(id) || { online: false, lastSeen: 0 };
            nodes.set(id, { ...current, online: true, lastSeen: Date.now() });
          });
          return { nodes };
        });
      },

      setOfflineNodes: (nodeIds) => {
        set((state) => {
          const nodes = new Map(state.nodes);
          nodeIds.forEach(id => {
            const current = nodes.get(id) || { online: false, lastSeen: 0 };
            nodes.set(id, { ...current, online: false });
          });
          return { nodes };
        });
      },

      setSelectedTransaction: (tx) => set({ selectedTransaction: tx }),
      
      setSelectedRunId: (runId) => set({ selectedRunId: runId }),

      clearData: () => set({ 
        transactions: [], 
        nodes: new Map(), 
        recentTelemetry: [],
        selectedTransaction: null 
      }),

      setLoadingTangle: (loading) => set({ isLoadingTangle: loading }),
      
      setLoadingPeers: (loading) => set({ isLoadingPeers: loading }),
    }),
    { name: 'TelemetryStore' }
  )
);

export default useTelemetryStore;
