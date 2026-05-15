import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/components/common/StatTile';
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';
import type { TangleData } from '@/types';

interface ThroughputMetricsProps {
  tangleData?: TangleData;
  isLoading: boolean;
}

export function ThroughputMetrics({
  tangleData,
  isLoading,
}: ThroughputMetricsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Throughput Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!tangleData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Throughput Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transaction data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { transactions, total } = tangleData;

  const totalTx = total || transactions.length;
  const tps = totalTx > 0 ? (totalTx / 100).toFixed(2) : '0';

  const avgConfirmationTime =
    transactions.reduce((sum, tx) => {
      const completionDuration = tx.metadata?.completionDuration || 0;
      return sum + completionDuration;
    }, 0) / (transactions.length || 1);

  const nodeDistribution: Record<string, number> = {};
  transactions.forEach((tx) => {
    const node = tx._originNode || 'unknown';
    nodeDistribution[node] = (nodeDistribution[node] || 0) + 1;
  });

  const sortedNodes = Object.entries(nodeDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-4" />
          Transaction Throughput Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile
            title="Total Transactions"
            value={totalTx.toLocaleString()}
            icon={Activity}
          />
          <StatTile title="TPS" value={tps} icon={TrendingUp} />
          <StatTile
            title="Avg Confirmation"
            value={`${avgConfirmationTime.toFixed(0)}ms`}
            icon={Clock}
          />
          <StatTile
            title="Nodes Participated"
            value={Object.keys(nodeDistribution).length}
            icon={Activity}
          />
        </div>

        {sortedNodes.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">
              Transaction Distribution by Node
            </h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedNodes.map(([node, count]) => (
                    <TableRow key={node}>
                      <TableCell className="font-mono text-xs">
                        {node.slice(0, 20)}…
                      </TableCell>
                      <TableCell className="w-1/2">
                        <Progress
                          value={(count / totalTx) * 100}
                          className="h-2"
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {count}
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

export default ThroughputMetrics;
