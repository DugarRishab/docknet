import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/common/StatTile';
import { format } from 'date-fns';
import {
  Activity,
  Clock,
  Network,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { RunSummary } from '@/types';

interface ExecutiveSummaryProps {
  runId: number;
  summary?: RunSummary;
  isLoading: boolean;
}

function statusVariant(
  status?: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'running') return 'secondary';
  if (status === 'failed' || status === 'error') return 'destructive';
  return 'outline';
}

export function ExecutiveSummary({
  runId,
  summary,
  isLoading,
}: ExecutiveSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No summary data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const duration =
    summary.endedAt && summary.startedAt
      ? new Date(summary.endedAt).getTime() -
        new Date(summary.startedAt).getTime()
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Run ID</p>
            <p className="text-sm font-semibold">#{runId}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <div>
              <Badge variant={statusVariant(summary.status)}>
                {summary.status === 'completed' ? (
                  <CheckCircle2 data-icon="inline-start" />
                ) : summary.status === 'failed' ? (
                  <AlertCircle data-icon="inline-start" />
                ) : null}
                {summary.status}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Started</p>
            <p className="text-sm">
              {format(new Date(summary.startedAt), 'PPp')}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="flex items-center gap-1 text-sm">
              <Clock className="size-3" />
              {duration > 0 ? `${(duration / 1000).toFixed(1)}s` : '—'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            title="Nodes"
            value={summary.nodes ?? 0}
            icon={Network}
          />
          <StatTile
            title="Transactions"
            value={summary.totalTransactions?.toLocaleString() ?? 0}
            icon={Activity}
          />
          <StatTile
            title="Unique Transactions"
            value={summary.uniqueTransactions?.toLocaleString() ?? 0}
            icon={CheckCircle2}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Consistency Score</span>
            <span className="text-xs text-muted-foreground">
              Calculating…
            </span>
          </div>
          <Progress value={0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export default ExecutiveSummary;
