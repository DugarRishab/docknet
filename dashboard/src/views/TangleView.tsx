import React, { useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTangleData, Transaction } from '../hooks/useTangleData';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { Search, Filter, Info, Network } from 'lucide-react';

interface GraphNode {
  id: string;
  val: number;
  color: string;
  sender: string;
  receiver: string;
  amount: number;
  cumulativeWeight: number;
  originNode: string;
  timestamp: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

export function TangleView() {
  const { selectedRunId, setSelectedTransaction } = useTelemetryStore();
  const { data: tangleData, isLoading, error } = useTangleData(selectedRunId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Transform transactions into graph data
  const { nodes, links, origins } = useMemo(() => {
    if (!tangleData?.transactions) return { nodes: [], links: [], origins: [] };

    const nodeMap = new Map<string, GraphNode>();
    const linkList: GraphLink[] = [];
    const originSet = new Set<string>();

    // Color palette for different origins
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    const originColors = new Map<string, string>();
    let colorIndex = 0;

    tangleData.transactions.forEach((tx) => {
      const origin = tx._originNode || 'unknown';
      originSet.add(origin);
      
      if (!originColors.has(origin)) {
        originColors.set(origin, colors[colorIndex % colors.length]);
        colorIndex++;
      }

      const txId = tx.data?.transaction_id || tx.id;
      if (!nodeMap.has(txId)) {
        nodeMap.set(txId, {
          id: txId,
          val: Math.sqrt(tx.metadata?.cumulative_weight || 1) * 2 + 3,
          color: originColors.get(origin) || '#6b7280',
          sender: tx.data?.sender || 'unknown',
          receiver: tx.data?.receiver || 'unknown',
          amount: tx.data?.amount || 0,
          cumulativeWeight: tx.metadata?.cumulative_weight || 1,
          originNode: origin,
          timestamp: tx.data?.timestamp || 0,
        });
      }

      // Create links from parents
      if (tx.data?.parents) {
        tx.data.parents.forEach((parentId) => {
          linkList.push({
            source: parentId,
            target: txId,
            color: '#4b5563',
          });
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linkList,
      origins: Array.from(originSet),
    };
  }, [tangleData]);

  // Filter nodes based on search and origin filter
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch = searchQuery === '' || 
        node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.receiver.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesOrigin = filterOrigin === null || node.originNode === filterOrigin;
      
      return matchesSearch && matchesOrigin;
    });
  }, [nodes, searchQuery, filterOrigin]);

  // Get connected links for filtered nodes
  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return links.filter(link => nodeIds.has(link.source as string) && nodeIds.has(link.target as string));
  }, [links, filteredNodes]);

  const graphData = useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id);
    const tx = tangleData?.transactions.find(t => 
      t.data?.transaction_id === node.id || t.id === node.id
    );
    if (tx) {
      setSelectedTransaction(tx);
    }
  }, [tangleData, setSelectedTransaction]);

  const nodePaint = (node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const isSelected = node.id === selectedNode;
    const radius = node.val;
    
    // Draw node
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 3, 0, 2 * Math.PI, false);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Label for larger nodes
    if (radius > 6 || isSelected) {
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.fillText(node.id.slice(0, 8) + '...', node.x || 0, (node.y || 0) + radius + 12);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Network className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading tangle data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-destructive/10 border border-destructive text-destructive px-6 py-4 rounded-lg">
          <p className="font-medium">Error loading tangle data</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions, nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterOrigin || ''}
            onChange={(e) => setFilterOrigin(e.target.value || null)}
            aria-label="Filter by origin node"
            className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Nodes</option>
            {origins.map((origin) => (
              <option key={origin} value={origin}>{origin}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <span>{tangleData?.total || 0} transactions</span>
          <span>{tangleData?.nodes || 0} nodes</span>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            graphData={graphData}
            nodeCanvasObject={nodePaint}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={2}
            linkColor={(link: any) => link.color}
            onNodeClick={handleNodeClick}
            nodeLabel={(node: any) => `
              <div class="bg-popover text-popover-foreground p-2 rounded-md text-xs max-w-xs">
                <p class="font-semibold">${node.id}</p>
                <p>Sender: ${node.sender}</p>
                <p>Receiver: ${node.receiver}</p>
                <p>Amount: ${node.amount}</p>
                <p>Weight: ${node.cumulativeWeight}</p>
                <p>Origin: ${node.originNode}</p>
              </div>
            `}
            warmupTicks={100}
            cooldownTicks={50}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            backgroundColor="transparent"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transactions to display</p>
              <p className="text-sm mt-2">Start a simulation to see the tangle</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TangleView;
