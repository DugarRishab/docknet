import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DashboardHeatmap } from '@/hooks/useDashboard';

interface SimulationHeatmapProps {
  data?: DashboardHeatmap;
  isLoading: boolean;
}

export function SimulationHeatmap({ data, isLoading }: SimulationHeatmapProps) {
  if (isLoading) {
    return (
      <Card >
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { buckets, txPerNodeRanges, nodeCountRanges } = data;

  const visibleNodeCounts = nodeCountRanges.filter((nc) =>
    buckets.some((b) => b.nodeCount === nc && b.exists)
  );

  const yAxis =
    visibleNodeCounts.length > 0 ? visibleNodeCounts : nodeCountRanges;

  const maxTxPerNode = Math.max(
    ...buckets.filter((b) => b.exists).map((b) => b.txPerNode),
    50
  );
  const xAxis = txPerNodeRanges.filter((t) => t <= maxTxPerNode + 5);

  return (
    <Card className='h-auto'>
      <CardHeader>
        <CardTitle>Simulation Coverage</CardTitle>
        <CardDescription>
          Heatmap showing which (nodes × transactions-per-node) configurations
          have been simulated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <div className="inline-block">
                <div className="flex">
                  <div className="w-24 shrink-0" />
                  <div className="flex">
                    {xAxis.map((tx) => (
                      <div
                        key={tx}
                        className="w-8 text-center text-xs text-muted-foreground"
                      >
                        {tx}
                      </div>
                    ))}
                  </div>
                </div>

                {yAxis.map((nodeCount) => (
                  <div key={nodeCount} className="flex items-center">
                    <div className="w-24 shrink-0 pr-2 text-right text-sm text-muted-foreground">
                      {nodeCount} node{nodeCount > 1 ? 's' : ''}
                    </div>
                    <div className="flex">
                      {xAxis.map((txPerNode) => {
                        const cell = buckets.find(
                          (b) =>
                            b.nodeCount === nodeCount &&
                            b.txPerNode === txPerNode
                        );
                        const exists = cell?.exists ?? false;

                        return (
                          <Tooltip key={`${nodeCount}-${txPerNode}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'size-8 border border-border',
                                  exists ? 'bg-primary' : 'bg-muted'
                                )}
                                aria-label={`${nodeCount} nodes, ${txPerNode}-${
                                  txPerNode + 4
                                } tx/node: ${
                                  exists ? 'Run exists' : 'No data'
                                }`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {nodeCount} node{nodeCount > 1 ? 's' : ''} ·{' '}
                              {txPerNode}-{txPerNode + 4} tx/node ·{' '}
                              {exists ? 'Run exists' : 'No data'}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded-sm border bg-primary" />
                <span className="text-muted-foreground">Run exists</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 rounded-sm border bg-muted" />
                <span className="text-muted-foreground">No data</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Transactions per Node (buckets of 5)
            </p>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export default SimulationHeatmap;
