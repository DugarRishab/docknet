import { useNavigate } from 'react-router-dom';
import { useAvailableRuns, deleteRun } from '@/hooks/useTangleData';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { format } from 'date-fns';
import {
  Trash2,
  Eye,
  Activity,
  Database,
  Plus,
  Clock,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'running') return 'secondary';
  if (status === 'failed' || status === 'error') return 'destructive';
  return 'outline';
}

function RunCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mt-2 h-4 w-32" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </CardContent>
      <CardFooter className="border-t pt-3">
        <Skeleton className="h-7 flex-1" />
        <Skeleton className="ml-2 h-7 flex-1" />
      </CardFooter>
    </Card>
  );
}

export function RunsOverview() {
  const navigate = useNavigate();
  const { data: runs, isLoading } = useAvailableRuns();
  const { setSelectedRunId } = useTelemetryStore();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      setDeletingId(null);
    },
  });

  const handleViewRun = (runId: number) => {
    setSelectedRunId(runId);
    navigate(`/run/${runId}`);
  };

  const handleDeleteRun = (runId: number) => {
    setDeletingId(runId);
    deleteMutation.mutate(runId);
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-auto p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <RunCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>No Simulation Runs</EmptyTitle>
            <EmptyDescription>
              Get started by creating your first simulation run.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate('/start')}>
              <Plus data-icon="inline-start" />
              Start Simulation
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Simulation Runs
          </h1>
          <p className="text-sm text-muted-foreground">
            {runs.length} run{runs.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Button onClick={() => navigate('/start')}>
          <Plus data-icon="inline-start" />
          New Simulation
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {runs.map((run) => (
          <Card key={run.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="truncate" title={run.label || `Run #${run.id}`}>
                  {run.label || `Run #${run.id}`}
                </CardTitle>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Started {format(new Date(run.started_at), 'PPp')}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <span>{run.node_count} nodes</span>
              </div>
              {run.tx_count !== undefined && (
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-muted-foreground" />
                  <span>{run.tx_count.toLocaleString()} transactions</span>
                </div>
              )}
              {run.duration != null && (
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{(run.duration / 1000).toFixed(1)}s duration</span>
                </div>
              )}
              {run.consistencyScore !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Consistency:
                  </span>
                  <Badge
                    variant={
                      run.consistencyScore >= 95 ? 'default' : 'destructive'
                    }
                  >
                    {run.consistencyScore.toFixed(1)}%
                  </Badge>
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2 border-t pt-3">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleViewRun(run.id)}
              >
                <Eye data-icon="inline-start" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleDeleteRun(run.id)}
              >
                <Trash2 data-icon="inline-start" />
                {deletingId === run.id ? 'Deleting…' : 'Delete'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default RunsOverview;
