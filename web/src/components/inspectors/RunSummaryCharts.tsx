import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { Transaction } from '@/types';

interface RunSummaryChartsProps {
  transactions: Transaction[];
  runId: number;
}

type ChartTab = 'weights' | 'timing' | 'hops';

const weightsConfig = {
  weight: {
    label: 'Cumulative Weight',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

const timingConfig = {
  verification: { label: 'Verification', color: 'var(--chart-1)' },
  completion: { label: 'Completion', color: 'var(--chart-2)' },
  propagation: { label: 'Propagation', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const hopsConfig = {
  hops: { label: 'Hops', color: 'var(--chart-1)' },
  delay: { label: 'Delay (ms)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function RunSummaryCharts({ transactions }: RunSummaryChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('weights');

  const weightsData = useMemo(() => {
    if (!transactions.length) return [];
    const sorted = [...transactions]
      .filter((t) => t.metadata?.cumulative_weight !== undefined)
      .sort((a, b) => (a.data.timestamp || 0) - (b.data.timestamp || 0));
    return sorted.map((tx, index) => ({
      index: index + 1,
      weight: tx.metadata?.cumulative_weight || 0,
    }));
  }, [transactions]);

  const timingData = useMemo(() => {
    if (!transactions.length) return [];
    const nodeStats = new Map<
      string,
      {
        nodeId: string;
        verificationSum: number;
        completionSum: number;
        propagationSum: number;
        count: number;
      }
    >();

    transactions.forEach((tx) => {
      const nodeId = tx._originNode || 'unknown';
      const existing = nodeStats.get(nodeId) || {
        nodeId: nodeId.slice(0, 8),
        verificationSum: 0,
        completionSum: 0,
        propagationSum: 0,
        count: 0,
      };

      existing.verificationSum += tx.metadata?.verificationDuration || 0;
      existing.completionSum += tx.metadata?.completionDuration || 0;
      existing.propagationSum += tx.metadata?.avgPropagationDelay || 0;
      existing.count++;

      nodeStats.set(nodeId, existing);
    });

    return Array.from(nodeStats.values()).map((stats) => ({
      nodeId: stats.nodeId,
      verification:
        stats.count > 0 ? Math.round(stats.verificationSum / stats.count) : 0,
      completion:
        stats.count > 0 ? Math.round(stats.completionSum / stats.count) : 0,
      propagation:
        stats.count > 0 ? Math.round(stats.propagationSum / stats.count) : 0,
    }));
  }, [transactions]);

  const hopsData = useMemo(() => {
    if (!transactions.length) return [];
    const sorted = [...transactions]
      .filter((t) => t.metadata?.hops && t.metadata.hops.length > 0)
      .sort((a, b) => (a.data.timestamp || 0) - (b.data.timestamp || 0))
      .slice(0, 50);
    return sorted.map((tx, index) => ({
      index: index + 1,
      hops: tx.metadata?.hops?.length || 0,
      delay: tx.metadata?.propagationDelay || 0,
    }));
  }, [transactions]);

  const hasData = transactions.length > 0;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as ChartTab)}
      className="flex flex-col gap-2"
    >
      <TabsList className="w-full">
        <TabsTrigger value="weights" className="flex-1">
          Weights
        </TabsTrigger>
        <TabsTrigger value="timing" className="flex-1">
          Timing
        </TabsTrigger>
        <TabsTrigger value="hops" className="flex-1">
          Hops
        </TabsTrigger>
      </TabsList>

      <Card>
        <CardContent className="p-2">
          <TabsContent value="weights" className="mt-0">
            {hasData && weightsData.length > 0 ? (
              <ChartContainer
                config={weightsConfig}
                className="aspect-auto h-[180px] w-full"
              >
                <AreaChart
                  data={weightsData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="weight-gradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-weight)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-weight)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-weight)"
                    strokeWidth={2}
                    fill="url(#weight-gradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyMessage text="No weight data available" />
            )}
          </TabsContent>

          <TabsContent value="timing" className="mt-0">
            {hasData && timingData.length > 0 ? (
              <ChartContainer
                config={timingConfig}
                className="aspect-auto h-[180px] w-full"
              >
                <BarChart
                  data={timingData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nodeId" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="verification"
                    fill="var(--color-verification)"
                  />
                  <Bar dataKey="completion" fill="var(--color-completion)" />
                  <Bar
                    dataKey="propagation"
                    fill="var(--color-propagation)"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyMessage text="No timing data available" />
            )}
          </TabsContent>

          <TabsContent value="hops" className="mt-0">
            {hasData && hopsData.length > 0 ? (
              <ChartContainer
                config={hopsConfig}
                className="aspect-auto h-[180px] w-full"
              >
                <LineChart
                  data={hopsData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" tick={{ fontSize: 10 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-hops)"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-delay)"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hops"
                    stroke="var(--color-hops)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="delay"
                    stroke="var(--color-delay)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyMessage text="No propagation data available" />
            )}
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export default RunSummaryCharts;
