import { useVisualizerStore } from '@/store/useVisualizerStore';
import { TransactionInspector } from '@/components/inspectors/TransactionInspector';
import { NodeInspector } from '@/components/inspectors/NodeInspector';
import { RunSummaryInspector } from '@/components/inspectors/RunSummaryInspector';

export function RightPanel() {
  const { selectedTransaction, selectedNode, activeTab } = useVisualizerStore();

  // Determine what to show based on selection
  if (selectedTransaction) {
    return <TransactionInspector transaction={selectedTransaction} />;
  }

  if (selectedNode && activeTab === 'peers') {
    return <NodeInspector node={selectedNode} />;
  }

  return <RunSummaryInspector />;
}

export default RightPanel;
