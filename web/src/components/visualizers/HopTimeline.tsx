import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GitGraph } from 'lucide-react';
import type { Transaction } from '@/types';

interface HopTimelineProps {
  transactions: Transaction[];
  runId: number;
}

export function HopTimeline({ transactions }: HopTimelineProps) {
  const transactionsWithHops = useMemo(() => {
    return transactions
      .filter((tx) => tx.metadata?.hops && tx.metadata.hops.length > 0)
      .slice(0, 20);
  }, [transactions]);

  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = 0;
    transactionsWithHops.forEach((tx) => {
      if (tx.metadata?.hops) {
        tx.metadata.hops.forEach((hop) => {
          min = Math.min(min, hop.timestamp);
          max = Math.max(max, hop.timestamp);
        });
      }
    });
    return {
      minTime: min === Infinity ? 0 : min,
      maxTime: max === 0 ? 1 : max,
    };
  }, [transactionsWithHops]);

  if (transactionsWithHops.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitGraph />
            </EmptyMedia>
            <EmptyTitle>No Hop Data</EmptyTitle>
            <EmptyDescription>
              Transactions need to have propagation hop data to display here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const timeRange = maxTime - minTime || 1;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-full w-full overflow-auto p-4">
        <div className="flex flex-col gap-4">
          {transactionsWithHops.map((tx, index) => {
            const hops = tx.metadata?.hops || [];
            const firstHop = hops[0]?.timestamp || minTime;
            const lastHop = hops[hops.length - 1]?.timestamp || firstHop;
            const duration = lastHop - firstHop;

            return (
              <Card key={tx.data.transaction_id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {tx.data.transaction_id.slice(0, 16)}…
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {hops.length} hops · {duration.toFixed(0)}ms
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="relative h-8 rounded bg-muted">
                    {hops.map((hop, hopIndex) => {
                      const position =
                        ((hop.timestamp - minTime) / timeRange) * 100;
                      return (
                        <Tooltip key={`${tx.data.transaction_id}-${hopIndex}`}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
                              style={{ left: `${position}%` }}
                              aria-label={`Hop ${hopIndex + 1}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono">{hop.uid}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(hop.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0ms</span>
                    <span>{(duration / 2).toFixed(0)}ms</span>
                    <span>{duration.toFixed(0)}ms</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default HopTimeline;
