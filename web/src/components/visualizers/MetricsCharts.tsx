import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart3 } from 'lucide-react';
import type { Transaction } from '@/types';

interface MetricsChartsProps {
  transactions: Transaction[];
  runId: number;
}

const timeSeriesConfig = {
  transactions: { label: 'Transactions', color: 'var(--chart-1)' },
  confirmed: { label: 'Confirmed', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const nodeConfig = {
  count: { label: 'Count', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const propagationConfig = {
  count: { label: 'Count', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function MetricsCharts({ transactions }: MetricsChartsProps) {
  const chartData = useMemo(() => {
    const timeBuckets = new Map<string, { count: number; confirmed: number }>();
    transactions.forEach((tx) => {
      const timestamp = Math.floor(tx.data.timestamp / 10000) * 10000;
      const key = new Date(timestamp).toLocaleTimeString();
      const existing = timeBuckets.get(key) || { count: 0, confirmed: 0 };
      existing.count++;
      if (tx.metadata?.consensusTimestamp) {
        existing.confirmed++;
      }
      timeBuckets.set(key, existing);
    });
    return Array.from(timeBuckets.entries()).map(([time, data]) => ({
      time,
      transactions: data.count,
      confirmed: data.confirmed,
    }));
  }, [transactions]);

  const nodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach((tx) => {
      const nodeId = tx._originNode || 'unknown';
      counts.set(nodeId, (counts.get(nodeId) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([nodeId, count]) => ({ nodeId: nodeId.slice(0, 8), count }))
      .slice(0, 10);
  }, [transactions]);

  const propagationData = useMemo(() => {
    const delays = transactions
      .map((tx) => tx.metadata?.propagationDelay)
      .filter((d): d is number => d !== undefined && d > 0);
    const buckets = new Map<string, number>();
    const bucketSize = 50;
    delays.forEach((delay) => {
      const bucket = `${Math.floor(delay / bucketSize) * bucketSize}-${
        Math.floor(delay / bucketSize) * bucketSize + bucketSize
      }ms`;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
    return Array.from(buckets.entries())
      .map(([range, count]) => ({ range, count }))
      .slice(0, 20);
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>No Metrics Data</EmptyTitle>
            <EmptyDescription>
              No transaction data available for metrics visualization.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Transactions Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={timeSeriesConfig}
                className="aspect-auto h-[200px] w-full"
              >
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="transactions"
                    stroke="var(--color-transactions)"
                    fill="var(--color-transactions)"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Transactions Per Node
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={nodeConfig}
                className="aspect-auto h-[200px] w-full"
              >
                <BarChart data={nodeCounts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nodeId" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Consensus Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={timeSeriesConfig}
                className="aspect-auto h-[200px] w-full"
              >
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="confirmed"
                    stroke="var(--color-confirmed)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Propagation Delay Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={propagationConfig}
                className="aspect-auto h-[200px] w-full"
              >
                <BarChart data={propagationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 8 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

export default MetricsCharts;
