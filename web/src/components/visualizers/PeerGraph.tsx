import { useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Share2 } from 'lucide-react';
import type { PeerTopology, PeerNode } from '@/types';

interface PeerGraphProps {
  topology: PeerTopology | undefined;
  runId: number;
}

export function PeerGraph({ topology }: PeerGraphProps) {
  const { setSelectedNode } = useVisualizerStore();
  const graphRef = useRef<any>(null);
  const colors = useThemeColors();

  const graphData = useMemo(() => {
    if (!topology) return { nodes: [], links: [] };

    const nodes = topology.nodes.map((node) => ({
      ...node,
      id: node.id,
      val: node.peerCount + 1,
      color:
        node.state === 'connected'
          ? colors['--primary']
          : colors['--destructive'],
      label: node.label || node.id.slice(0, 8),
    }));

    const links = topology.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      color: colors['--muted-foreground'],
    }));

    return { nodes, links };
  }, [topology, colors]);

  const handleNodeClick = useCallback(
    (node: any) => {
      if (node && node.id) {
        const peerNode = topology?.nodes.find((n) => n.id === node.id);
        if (peerNode) {
          setSelectedNode(peerNode as PeerNode);
        }
      }
    },
    [topology, setSelectedNode]
  );

  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Share2 />
            </EmptyMedia>
            <EmptyTitle>No peer data</EmptyTitle>
            <EmptyDescription>
              No peer topology data available to visualize.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeAutoColorBy="state"
        nodeLabel={(node: any) =>
          `ID: ${node.id.slice(0, 16)}…\nPeers: ${node.peerCount}\nState: ${node.state}`
        }
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        linkWidth={1}
        warmupTicks={100}
        cooldownTicks={50}
      />
    </div>
  );
}

export default PeerGraph;
