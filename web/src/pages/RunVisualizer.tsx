import { useParams } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { TangleGraph } from '@/components/visualizers/TangleGraph';
import { PeerGraph } from '@/components/visualizers/PeerGraph';
import { HopTimeline } from '@/components/visualizers/HopTimeline';
import { Skeleton } from '@/components/ui/skeleton';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { useTangleData, usePeerTopology } from '@/hooks/useTangleData';
import { useWebSocket } from '@/hooks/useWebSocket';

function FullSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

// NOTE: This page is currently unrouted in App.tsx. It mirrors RunDetail
// minus the Report tab; behavior intentionally preserved.
export function RunVisualizer() {
  const { runId } = useParams<{ runId: string }>();
  const runIdNum = parseInt(runId || '0', 10);

  const {
    activeTab,
    selectedOriginNode,
    setAvailableNodes,
    setSelectedOriginNode,
  } = useVisualizerStore();
  const { setSelectedRunId } = useTelemetryStore();

  useWebSocket();

  const { data: tangleData, isLoading: tangleLoading } =
    useTangleData(runIdNum);
  const { data: peerTopology, isLoading: peerLoading } =
    usePeerTopology(runIdNum);

  useEffect(() => {
    if (tangleData?.transactions) {
      const origins = [
        ...new Set(
          tangleData.transactions
            .map((t) => t._originNode)
            .filter((o): o is string => !!o)
        ),
      ];
      setAvailableNodes(origins);

      if (origins.length > 0 && !selectedOriginNode) {
        setSelectedOriginNode(origins[0]);
      }
    }
  }, [tangleData, setAvailableNodes, selectedOriginNode, setSelectedOriginNode]);

  useEffect(() => {
    setSelectedRunId(runIdNum);
  }, [runIdNum, setSelectedRunId]);

  const filteredTransactions = useMemo(() => {
    if (!tangleData?.transactions || !selectedOriginNode) return [];
    return tangleData.transactions.filter(
      (tx) => tx._originNode === selectedOriginNode
    );
  }, [tangleData, selectedOriginNode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'tangle':
        if (tangleLoading) return <FullSkeleton />;
        return (
          <TangleGraph transactions={filteredTransactions} runId={runIdNum} />
        );
      case 'peers':
        if (peerLoading) return <FullSkeleton />;
        return <PeerGraph topology={peerTopology} runId={runIdNum} />;
      case 'hops':
        if (tangleLoading) return <FullSkeleton />;
        return (
          <HopTimeline
            transactions={tangleData?.transactions || []}
            runId={runIdNum}
          />
        );
      default:
        return null;
    }
  };

  return (
    <EditorLayout
      runId={runIdNum}
      transactionCount={tangleData?.total}
      nodeCount={tangleData?.nodes}
    >
      <div className="h-full w-full overflow-hidden">{renderContent()}</div>
    </EditorLayout>
  );
}

export default RunVisualizer;
