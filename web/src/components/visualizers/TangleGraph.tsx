import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
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
import { Network } from 'lucide-react';
import type { Transaction } from '@/types';

interface TangleGraphProps {
  transactions: Transaction[];
  runId: number;
}

interface GraphNode {
  id: string;
  val: number;
  color: string;
  borderColor: string;
  isGenesis: boolean;
  cumulativeWeight: number;
  originNode: string;
  transaction: Transaction;
  depth: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

function calculateDepths(transactions: Transaction[]): Map<string, number> {
  const depths = new Map<string, number>();

  transactions.forEach((tx) => {
    if (
      !tx.data.parents ||
      tx.data.parents.length === 0 ||
      tx.data.transaction_id === 'genesis'
    ) {
      depths.set(tx.data.transaction_id, 0);
    }
  });

  let changed = true;
  while (changed) {
    changed = false;
    transactions.forEach((tx) => {
      const txId = tx.data.transaction_id;
      if (depths.has(txId)) return;

      const parentDepths = (tx.data.parents || [])
        .map((p) => depths.get(p))
        .filter((d): d is number => d !== undefined);

      if (parentDepths.length > 0) {
        const maxParentDepth = Math.max(...parentDepths);
        depths.set(txId, maxParentDepth + 1);
        changed = true;
      }
    });
  }

  return depths;
}

export function TangleGraph({ transactions }: TangleGraphProps) {
  const { layers, setSelectedTransaction } = useVisualizerStore();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const colors = useThemeColors();

  const nodeSize = 40;

  // Pick weight color from chart-N tokens.
  const getWeightColor = useCallback(
    (weight: number, maxWeight: number): string => {
      if (weight === 0 || weight === undefined) return colors['--primary'];
      const ratio = maxWeight > 1 ? (weight - 1) / (maxWeight - 1) : 0;
      if (ratio > 0.6) return colors['--chart-1'];
      if (ratio > 0.3) return colors['--chart-3'];
      return colors['--chart-5'];
    },
    [colors]
  );

  const graphData = useMemo(() => {
    if (transactions.length === 0) {
      return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    }

    const depths = calculateDepths(transactions);
    const maxWeight = Math.max(
      ...transactions.map((t) => t.metadata?.cumulative_weight || 1)
    );

    const nodes: GraphNode[] = [];
    const nodeIdSet = new Set<string>();

    transactions.forEach((tx) => {
      const txId = tx.data.transaction_id;
      const weight = tx.metadata?.cumulative_weight || 1;
      const isGenesis =
        !tx.data.parents ||
        tx.data.parents.length === 0 ||
        txId === 'genesis';
      const depth = depths.get(txId) || 0;

      nodeIdSet.add(txId);

      const baseColor = isGenesis
        ? colors['--primary']
        : getWeightColor(weight, maxWeight);

      nodes.push({
        id: txId,
        val: nodeSize / 2,
        color: baseColor,
        borderColor: isGenesis ? colors['--background'] : baseColor,
        isGenesis,
        cumulativeWeight: weight,
        originNode: tx._originNode || 'unknown',
        transaction: tx,
        depth,
      });
    });

    const links: GraphLink[] = [];
    const linkSet = new Set<string>();

    transactions.forEach((tx) => {
      const txId = tx.data.transaction_id;
      if (tx.data.parents && tx.data.parents.length > 0) {
        tx.data.parents.forEach((parentId) => {
          if (parentId === txId) return;
          if (nodeIdSet.has(parentId)) {
            const linkKey = `${parentId}->${txId}`;
            if (!linkSet.has(linkKey)) {
              links.push({ source: parentId, target: txId });
              linkSet.add(linkKey);
            }
          }
        });
      }
    });

    return { nodes, links };
  }, [transactions, colors, getWeightColor]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    
    // Set initial dimensions after a tick to allow layout to settle
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    }, 0);
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const charge = fg.d3Force('charge');
    if (charge) charge.strength(-1500).distanceMax(800);
    const collide = fg.d3Force('collide');
    if (collide) collide.radius(nodeSize / 2 + 2).strength(1);
    fg.d3ReheatSimulation?.();
  }, [graphData]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node && node.id) {
        setSelectedTransaction(node.transaction);
      }
    },
    [setSelectedTransaction]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D) => {
      const size = nodeSize;
      const halfSize = size / 2;
      const x = (node.x || 0) - halfSize;
      const y = (node.y || 0) - halfSize;

      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();

      ctx.fillStyle = node.color;
      ctx.fill();

      ctx.strokeStyle = node.isGenesis
        ? colors['--background']
        : colors['--border'];
      ctx.lineWidth = node.isGenesis ? 3 : 2;
      ctx.stroke();

      const weightText = String(node.cumulativeWeight);
      const fontSize = Math.min(
        14,
        size / Math.max(2, weightText.length * 0.6)
      );
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = colors['--primary-foreground'];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(weightText, node.x || 0, (node.y || 0) + 1);
    },
    [colors]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const start = link.source;
      const end = link.target;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = colors['--muted-foreground'];
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [colors]
  );

  if (transactions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>No Transactions</EmptyTitle>
            <EmptyDescription>
              No transaction data available to visualize.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
        graphData={graphData}
        nodeLabel={(node: GraphNode) =>
          `ID: ${node.id}\n` +
          `Weight: ${node.cumulativeWeight}\n` +
          `Origin: ${node.originNode}${node.isGenesis ? '\n(Genesis)' : ''}`
        }
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={8}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={() => colors['--muted-foreground']}
        linkCurvature={0}
        warmupTicks={300}
        cooldownTicks={150}
        cooldownTime={4000}
        linkVisibility={layers.showEdges}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={nodeSize / 2}
        linkWidth={1.5}
        linkColor={() => colors['--muted-foreground']}
        dagMode="lr"
        dagLevelDistance={160}
        d3AlphaDecay={0.005}
        d3VelocityDecay={0.5}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
        nodePointerAreaPaint={(node: GraphNode, color, ctx) => {
          const size = nodeSize + 4;
          ctx.fillStyle = color;
          ctx.fillRect(
            (node.x || 0) - size,
            (node.y || 0) - size,
            size,
            size
          );
        }}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={linkCanvasObject}
        />
      </div>
    </div>
  );
}

export default TangleGraph;
