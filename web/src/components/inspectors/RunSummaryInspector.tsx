import { useParams } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatTile } from '@/components/common/StatTile';
import {
  useRunSummary,
  useTangleData,
  useNodeStatus,
} from '@/hooks/useTangleData';
import { RunSummaryCharts } from './RunSummaryCharts';
import {
  Activity,
  Database,
  Users,
  Clock,
  Network,
  Layers,
  Weight,
  Timer,
  Zap,
  Share2,
  Calendar,
  Hash,
} from 'lucide-react';
import { format } from 'date-fns';

function statusVariant(
  status?: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active' || status === 'completed') return 'default';
  if (status === 'running') return 'secondary';
  if (status === 'failed' || status === 'error') return 'destructive';
  return 'outline';
}

export function RunSummaryInspector() {
  const { runId } = useParams<{ runId: string }>();
  const runIdNum = parseInt(runId || '0', 10);

  const { data: summary, isLoading: summaryLoading } = useRunSummary(runIdNum);
  const { data: tangleData, isLoading: tangleLoading } =
    useTangleData(runIdNum);
  const { data: nodeStatus, isLoading: nodeLoading } = useNodeStatus(runIdNum);

  const isLoading = summaryLoading || tangleLoading || nodeLoading;

  const txPerNode = summary?.nodes
    ? Math.round((summary.uniqueTransactions || 0) / summary.nodes)
    : 0;

  const duration =
    summary?.startedAt && summary?.endedAt
      ? new Date(summary.endedAt).getTime() -
        new Date(summary.startedAt).getTime()
      : 0;

  return (
    <div className="flex h-full flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold">
              Run Analysis Report
            </CardTitle>
            <CardDescription className="text-xs">
              Run #{runIdNum}
              {summary?.label ? ` · ${summary.label}` : ''}
              {' · '}
              {summary?.status || 'Unknown'}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(summary?.status)}>
            {summary?.status || 'Unknown'}
          </Badge>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              title="Tx per Node"
              value={txPerNode}
              description={`${
                summary?.uniqueTransactions?.toLocaleString() || 0
              } unique`}
              icon={Database}
              loading={isLoading}
            />
            <StatTile
              title="Active Nodes"
              value={summary?.nodes || 0}
              description={`${nodeStatus?.healthyNodes || 0} healthy`}
              icon={Users}
              loading={isLoading}
            />
            <StatTile
              title="Max DAG Depth"
              value={summary?.maxDagDepth || 0}
              description="levels"
              icon={Layers}
              loading={isLoading}
            />
            <StatTile
              title="Genesis Weight"
              value={summary?.genesisWeight || 0}
              description="cumulative"
              icon={Weight}
              loading={isLoading}
            />
            <StatTile
              title="Avg Verification"
              value={`${summary?.avgVerificationTime || 0}ms`}
              description="per transaction"
              icon={Zap}
              loading={isLoading}
            />
            <StatTile
              title="Avg Completion"
              value={`${summary?.avgCompletionTime || 0}ms`}
              description="end-to-end"
              icon={Timer}
              loading={isLoading}
            />
            <StatTile
              title="Propagation Delay"
              value={`${summary?.avgPropagationDelay || 0}ms`}
              description="avg across nodes"
              icon={Share2}
              loading={isLoading}
            />
            <StatTile
              title="Total Peers"
              value={summary?.totalPeers || 0}
              description="connections"
              icon={Network}
              loading={isLoading}
            />
          </div>

          <Separator />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Run Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0 text-sm">
              <MetaRow label="Run ID" icon={Hash}>
                <span className="font-mono">#{runIdNum}</span>
              </MetaRow>
              <MetaRow label="Started" icon={Calendar}>
                {summary?.startedAt
                  ? format(new Date(summary.startedAt), 'MMM d, HH:mm:ss')
                  : '—'}
              </MetaRow>
              <MetaRow label="Duration" icon={Clock}>
                {duration > 0
                  ? `${(duration / 1000).toFixed(1)}s`
                  : summary?.startedAt
                  ? 'In Progress'
                  : '—'}
              </MetaRow>
              <MetaRow label="Status" icon={Activity}>
                <Badge variant="outline">
                  {summary?.status || 'Unknown'}
                </Badge>
              </MetaRow>
              <Separator className="my-1" />
              <MetaRow label="Total Transactions">
                {summary?.totalTransactions?.toLocaleString() || 0}
              </MetaRow>
              <MetaRow label="Unique Transactions">
                {summary?.uniqueTransactions?.toLocaleString() || 0}
              </MetaRow>
              <MetaRow label="Nodes">{summary?.nodes || 0}</MetaRow>
              <MetaRow label="Peers">{summary?.totalPeers || 0}</MetaRow>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex min-h-[280px] flex-col gap-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Analytics
            </h4>
            <RunSummaryCharts
              transactions={tangleData?.transactions || []}
              runId={runIdNum}
            />
          </div>

          {nodeStatus?.nodes && nodeStatus.nodes.length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Node Health Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 pt-0">
                  {nodeStatus.nodes.slice(0, 5).map((node) => (
                    <div
                      key={node.nodeId}
                      className="flex items-center justify-between py-1 text-xs"
                    >
                      <span className="font-mono text-muted-foreground">
                        {node.nodeId.slice(0, 16)}…
                      </span>
                      <Badge
                        variant={
                          node.health === 'healthy' ? 'default' : 'destructive'
                        }
                      >
                        {node.health}
                      </Badge>
                    </div>
                  ))}
                  {nodeStatus.nodes.length > 5 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{nodeStatus.nodes.length - 5} more nodes
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function MetaRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

export default RunSummaryInspector;
