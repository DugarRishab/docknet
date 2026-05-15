import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { 
  Transaction, 
  PeerNode, 
  FilterState, 
  LayerState, 
  ViewTab 
} from '@/types';

interface VisualizerState {
  // Active tab
  activeTab: ViewTab;

  // Selection
  selectedTransaction: Transaction | null;
  selectedNode: PeerNode | null;
  comparisonItems: string[];

  // Node filtering for tangle view
  selectedOriginNode: string;
  availableNodes: string[];

  // Filters
  filters: FilterState;

  // View settings
  layers: LayerState;

  // Panel visibility
  rightPanelOpen: boolean;

  // Actions
  setActiveTab: (tab: ViewTab) => void;
  setSelectedTransaction: (tx: Transaction | null) => void;
  setSelectedNode: (node: PeerNode | null) => void;
  setSelectedOriginNode: (node: string) => void;
  setAvailableNodes: (nodes: string[]) => void;
  toggleComparison: (txId: string) => void;
  clearComparison: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
  toggleLayer: (layer: keyof LayerState) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
}

export const useVisualizerStore = create<VisualizerState>()(
  devtools(
    (set) => ({
      activeTab: 'tangle',
      selectedTransaction: null,
      selectedNode: null,
      comparisonItems: [],
      selectedOriginNode: '',
      availableNodes: [],
      filters: {
        nodeIds: [],
        timeRange: null,
        consensusStatus: 'all',
        weightRange: null,
        searchQuery: '',
      },
      layers: {
        showLabels: true,
        showEdges: true,
        showWeights: false,
        highlightPath: false,
      },
      rightPanelOpen: true,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedTransaction: (tx) => set({ selectedTransaction: tx }),

      setSelectedNode: (node) => set({ selectedNode: node }),

      setSelectedOriginNode: (node) => set({ selectedOriginNode: node }),

      setAvailableNodes: (nodes) => set({ availableNodes: nodes }),

      toggleComparison: (txId) => set((state) => {
        const exists = state.comparisonItems.includes(txId);
        if (exists) {
          return { comparisonItems: state.comparisonItems.filter(id => id !== txId) };
        }
        if (state.comparisonItems.length >= 4) {
          return { comparisonItems: [...state.comparisonItems.slice(1), txId] };
        }
        return { comparisonItems: [...state.comparisonItems, txId] };
      }),

      clearComparison: () => set({ comparisonItems: [] }),

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),

      toggleLayer: (layer) => set((state) => ({
        layers: { ...state.layers, [layer]: !state.layers[layer] }
      })),

      toggleRightPanel: () => set((state) => ({
        rightPanelOpen: !state.rightPanelOpen
      })),

      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    }),
    { name: 'VisualizerStore' }
  )
);

export default useVisualizerStore;
