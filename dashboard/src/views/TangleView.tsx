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
  originNodes: string[];
  timestamp: number;
  isGenesis: boolean;
  isConfirmed: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

interface TransactionGroup {
  transactions: Transaction[];
  maxWeight: number;
  origins: string[];
  isConfirmed: boolean;
}

export function TangleView() {
  const { selectedRunId, setSelectedTransaction } = useTelemetryStore();
  const { data: tangleData, isLoading, error } = useTangleData(selectedRunId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Transform transactions into graph data with proper deduplication and link validation
  const { nodes, links, origins } = useMemo(() => {
    if (!tangleData?.transactions) return { nodes: [], links: [], origins: [] };

    // Step 1: Group transactions by ID (each transaction appears on multiple nodes)
    const txGroups = new Map<string, TransactionGroup>();
    const originSet = new Set<string>();

    tangleData.transactions.forEach((tx) => {
      const origin = tx._originNode || 'unknown';
      originSet.add(origin);

      const txId = tx.data?.transaction_id || tx.id;
      if (!txGroups.has(txId)) {
        txGroups.set(txId, {
          transactions: [],
          maxWeight: 0,
          origins: [],
          isConfirmed: false,
        });
      }

      const group = txGroups.get(txId)!;
      group.transactions.push(tx);
      group.maxWeight = Math.max(group.maxWeight, tx.metadata?.cumulative_weight || 1);
      if (!group.origins.includes(origin)) {
        group.origins.push(origin);
      }
      if (tx.metadata?.consensusTimestamp && tx.metadata.consensusTimestamp > 0) {
        group.isConfirmed = true;
      }
    });

    // Color palette for different origins
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    // Step 2: Create unique nodes from groups
    const nodeMap = new Map<string, GraphNode>();

    txGroups.forEach((group, txId) => {
      const baseTx = group.transactions[0];
      const isGenesis = txId === 'genesis' || baseTx.data?.parents?.length === 0;

      // Determine color based on status and origin
      let color: string;
      if (group.isConfirmed) {
        color = '#22c55e'; // Green for confirmed
      } else if (isGenesis) {
        color = '#3b82f6'; // Blue for genesis
      } else {
        // Use origin-based color for pending
        const originIndex = origins.indexOf(group.origins[0]) % colors.length;
        color = colors[originIndex] || '#f59e0b';
      }

      nodeMap.set(txId, {
        id: txId,
        val: Math.sqrt(group.maxWeight) * 2 + 3,
        color,
        sender: baseTx.data?.sender || 'unknown',
        receiver: baseTx.data?.receiver || 'unknown',
        amount: baseTx.data?.amount || 0,
        cumulativeWeight: group.maxWeight,
        originNodes: group.origins,
        timestamp: baseTx.data?.timestamp || 0,
        isGenesis,
        isConfirmed: group.isConfirmed,
      });
    });

    // Step 3: Build validated links (only link to existing nodes)
    const linkList: GraphLink[] = [];
    const linkSet = new Set<string>();

    txGroups.forEach((group, txId) => {
      const baseTx = group.transactions[0];

      if (baseTx.data?.parents && baseTx.data.parents.length > 0) {
        baseTx.data.parents.forEach((parentId) => {
          // Skip genesis parent references and self-references
          if (parentId === 'genesis' || parentId === txId) {
            return;
          }

          // Only create link if parent exists in our node set
          if (nodeMap.has(parentId)) {
            const linkKey = `${parentId}->${txId}`;
            if (!linkSet.has(linkKey)) {
              linkList.push({
                source: parentId,
                target: txId,
                color: '#4b5563',
              });
              linkSet.add(linkKey);
            }
          }
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

      const matchesOrigin = filterOrigin === null ||
        node.originNodes.includes(filterOrigin);

      return matchesSearch && matchesOrigin;
    });
  }, [nodes, searchQuery, filterOrigin]);

  // Get connected links for filtered nodes
  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return links.filter(link =>
      nodeIds.has(link.source as string) && nodeIds.has(link.target as string)
    );
  }, [links, filteredNodes]);

  const graphData = useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id);
    // Find the transaction with matching origin (or first if no match)
    const tx = tangleData?.transactions.find(t =>
      (t.data?.transaction_id === node.id || t.id === node.id)
    );
    if (tx) {
      setSelectedTransaction(tx);
    }
  }, [tangleData, setSelectedTransaction]);

  const nodePaint = (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = node.id === selectedNode;
    const radius = node.val;
    const x = node.x || 0;
    const y = node.y || 0;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Draw border for selected or genesis nodes
    if (isSelected || node.isGenesis) {
      ctx.beginPath();
      ctx.arc(x, y, radius + (isSelected ? 3 : 2), 0, 2 * Math.PI, false);
      ctx.strokeStyle = isSelected ? '#fff' : '#60a5fa';
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();
    }

    // Draw label for larger nodes or when zoomed in
    if (globalScale > 1.2 || radius > 6 || isSelected) {
      ctx.font = `${Math.max(10, Math.round(radius))}px Inter, sans-serif`;
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = node.id.slice(0, 8) + (node.id.length > 8 ? '...' : '');
      ctx.fillText(label, x, y + radius + 14);
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
                <p>Status: ${node.isConfirmed ? 'Confirmed' : 'Pending'}</p>
                <p>Nodes: ${node.originNodes.join(', ')}</p>
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
