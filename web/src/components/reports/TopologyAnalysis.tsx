import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/components/common/StatTile';
import { Network, Link2, Users } from 'lucide-react';
import type { PeerTopology } from '@/types';

interface TopologyAnalysisProps {
  topology?: PeerTopology;
  isLoading: boolean;
}

export function TopologyAnalysis({
  topology,
  isLoading,
}: TopologyAnalysisProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Topology Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!topology) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Topology Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No topology data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { stats, nodes } = topology;

  const connectedCount = nodes.filter((n) => n.state === 'connected').length;
  const disconnectedCount = nodes.length - connectedCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="size-4" />
          Network Topology Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile title="Total Nodes" value={stats.totalNodes} icon={Users} />
          <StatTile
            title="Total Connections"
            value={stats.totalConnections}
            icon={Link2}
          />
          <StatTile
            title="Avg Peers/Node"
            value={stats.avgConnections.toFixed(1)}
            icon={Network}
          />
          <StatTile
            title="Connected"
            value={`${connectedCount}/${nodes.length}`}
            icon={Users}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Connection State Breakdown</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <Card>
              <CardContent className="flex items-center justify-between p-3">
                <span className="text-sm">Connected</span>
                <Badge variant="default">{connectedCount}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-3">
                <span className="text-sm">Disconnected</span>
                <Badge variant="secondary">{disconnectedCount}</Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {stats.mostConnectedNodes.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">Most Connected Nodes</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node ID</TableHead>
                    <TableHead className="text-right">Peers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.mostConnectedNodes.slice(0, 5).map((node) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-mono text-xs">
                        {node.id.slice(0, 16)}…
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {node.peerCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TopologyAnalysis;
