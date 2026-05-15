import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/components/common/StatTile';
import { Network, Users, Link2, Minus, Plus } from 'lucide-react';
import type { PeerTopology } from '@/types';

interface ConnectivityStatsProps {
  topology?: PeerTopology;
  isLoading: boolean;
}

export function ConnectivityStats({
  topology,
  isLoading,
}: ConnectivityStatsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Peer Connectivity Statistics</CardTitle>
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
          <CardTitle>Peer Connectivity Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No connectivity data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { nodes } = topology;

  const peerCounts = nodes.map((n) => n.peerCount);
  const minPeers = Math.min(...peerCounts);
  const maxPeers = Math.max(...peerCounts);
  const avgPeers =
    peerCounts.reduce((sum, count) => sum + count, 0) / peerCounts.length;

  const sortedNodes = [...nodes].sort((a, b) => b.peerCount - a.peerCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="size-4" />
          Peer Connectivity Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile title="Min Peers" value={minPeers} icon={Minus} />
          <StatTile title="Max Peers" value={maxPeers} icon={Plus} />
          <StatTile
            title="Avg Peers"
            value={avgPeers.toFixed(1)}
            icon={Users}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Node Connectivity Details</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node ID</TableHead>
                  <TableHead className="text-center">Peer Count</TableHead>
                  <TableHead className="text-center">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedNodes.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell className="font-mono text-xs">
                      {node.id.slice(0, 20)}…
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        <Link2 className="size-3" />
                        {node.peerCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          node.state === 'connected' ? 'default' : 'destructive'
                        }
                      >
                        {node.state}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ConnectivityStats;
