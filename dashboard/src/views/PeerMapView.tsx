import React, { useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { usePeerTopology, useNodeStatus, PeerNode, PeerEdge } from '../hooks/useTangleData';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { Network, Activity, Users, Link2, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface GraphNode {
  id: string;
  val: number;
  color: string;
  state: string;
  peerCount: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

export function PeerMapView() {
  const { selectedRunId } = useTelemetryStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { data: topology, isLoading: topologyLoading } = usePeerTopology(selectedRunId);
  const { data: nodeStatus, isLoading: statusLoading } = useNodeStatus(selectedRunId);

  // Transform topology data into graph format
  const { nodes, links, stats } = useMemo(() => {
    if (!topology) return { nodes: [], links: [], stats: null };

    const graphNodes: GraphNode[] = topology.nodes.map((node) => {
      // Determine color based on state
      let color = '#6b7280'; // gray for unknown
      if (node.state === 'connected') color = '#10b981'; // green
      else if (node.state === 'disconnected') color = '#ef4444'; // red
      else if (node.state === 'partial') color = '#f59e0b'; // amber

      return {
        id: node.id,
        val: Math.max(5, node.peerCount * 2 + 3),
        color,
        state: node.state,
        peerCount: node.peerCount,
      };
    });

    const graphLinks: GraphLink[] = topology.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      color: edge.state === 1 ? '#10b981' : '#6b7280',
    }));

    return {
      nodes: graphNodes,
      links: graphLinks,
      stats: topology.stats,
    };
  }, [topology]);

  const graphData = useMemo(() => ({
    nodes,
    links,
  }), [nodes, links]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode || !topology) return null;
    return topology.nodes.find((n) => n.id === selectedNode);
  }, [selectedNode, topology]);

  const selectedStatusData = useMemo(() => {
    if (!selectedNode || !nodeStatus) return null;
    return nodeStatus.nodes.find((n) => n.nodeId === selectedNode);
  }, [selectedNode, nodeStatus]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
  }, [selectedNode]);

  const nodePaint = (node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const isSelected = node.id === selectedNode;
    const isHovered = node.id === hoveredNode;
    const radius = node.val;

    // Draw node
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Glow effect for selected/hovered
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 4, 0, 2 * Math.PI, false);
      ctx.strokeStyle = isSelected ? '#fff' : node.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Node label
    if (radius > 6 || isSelected || isHovered) {
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.fillText(node.id, node.x || 0, (node.y || 0) + radius + 12);
    }
  };

  const isLoading = topologyLoading || statusLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Network className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading peer topology...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main graph area */}
      <div className="flex-1 flex flex-col">
        {/* Stats bar */}
        <div className="flex items-center gap-6 p-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nodes:</span>
            <span className="text-sm font-semibold">{stats?.totalNodes || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Connections:</span>
            <span className="text-sm font-semibold">{stats?.totalConnections || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Avg Peers:</span>
            <span className="text-sm font-semibold">{stats?.avgConnections?.toFixed(1) || '0.0'}</span>
          </div>
          {nodeStatus && (
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{nodeStatus.healthyNodes} healthy</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{nodeStatus.unhealthyNodes} unhealthy</span>
              </div>
            </div>
          )}
        </div>

        {/* Graph */}
        <div className="flex-1 relative">
          {graphData.nodes.length > 0 ? (
            <ForceGraph2D
              graphData={graphData}
              nodeCanvasObject={nodePaint}
              linkDirectionalParticles={1}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleWidth={2}
              linkColor={(link: any) => link.color}
              onNodeClick={handleNodeClick}
              onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
              nodeLabel={(node: any) => `
                <div class="bg-popover text-popover-foreground p-2 rounded-md text-xs max-w-xs">
                  <p class="font-semibold">${node.id}</p>
                  <p>State: ${node.state}</p>
                  <p>Peers: ${node.peerCount}</p>
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
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No peer data available</p>
                <p className="text-sm mt-2">Start a simulation to see peer connections</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l border-border bg-card/50 overflow-y-auto">
        {selectedNodeData ? (
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold">{selectedNodeData.id}</h3>
              <div className="flex items-center gap-2 mt-2">
                {selectedNodeData.state === 'connected' ? (
                  <Wifi className="w-4 h-4 text-emerald-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm ${
                  selectedNodeData.state === 'connected' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {selectedNodeData.state}
                </span>
              </div>
            </div>

            {selectedStatusData && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                    <p className="text-xl font-semibold">{selectedStatusData.transactionCount}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Peers</p>
                    <p className="text-xl font-semibold">{selectedStatusData.peerCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Health:</span>
                  <span className={`font-medium ${
                    selectedStatusData.health === 'healthy' ? 'text-emerald-500' :
                    selectedStatusData.health === 'partial' ? 'text-amber-500' :
                    'text-red-500'
                  }`}>
                    {selectedStatusData.health}
                  </span>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Connected Peers ({selectedNodeData.connectedPeers.length})
              </h4>
              <div className="space-y-2">
                {selectedNodeData.connectedPeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex items-center justify-between p-2 bg-secondary/30 rounded-md text-sm"
                  >
                    <span className="font-medium">{peer.id}</span>
                    <span className={`text-xs ${
                      peer.state === 1 ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}>
                      {peer.state === 1 ? 'connected' : 'disconnected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a node to view details</p>
          </div>
        )}

        {/* Most connected nodes */}
        {stats?.mostConnectedNodes && stats.mostConnectedNodes.length > 0 && (
          <div className="p-4 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Most Connected</h4>
            <div className="space-y-2">
              {stats.mostConnectedNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between p-2 bg-secondary/30 rounded-md text-sm cursor-pointer hover:bg-secondary/50"
                  onClick={() => setSelectedNode(node.id)}
                >
                  <span className="font-medium">{node.id}</span>
                  <span className="text-xs text-muted-foreground">{node.peerCount} peers</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PeerMapView;
