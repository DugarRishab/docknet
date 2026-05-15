import { useNavigate } from 'react-router-dom';
import { useAvailableRuns, deleteRun } from '@/hooks/useTangleData';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StartSimulationDialog } from '@/components/dialogs/StartSimulationDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Trash2,
  Eye,
  Database,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatDurationSeconds } from '@/lib/simulationParams';

const COLUMN_COUNT = 11;

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed' || status === 'complete') return 'default';
  if (status === 'running') return 'secondary';
  if (status === 'failed' || status === 'error' || status === 'incomplete')
    return 'destructive';
  return 'outline';
}

function formatDurationMs(ms?: number | null): string {
  if (ms == null || ms <= 0) return '—';
  return formatDurationSeconds(ms / 1000);
}

function formatNum(value?: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString();
}

export function Simulations() {
  const navigate = useNavigate();
  const { data: runs, isLoading } = useAvailableRuns();
  const { setSelectedRunId } = useTelemetryStore();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead className="text-right">Tx / Node</TableHead>
                <TableHead className="text-right">Tx Delay</TableHead>
                <TableHead className="text-right">Max Peers</TableHead>
                <TableHead className="text-right">Wait</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <Button onClick={() => setDialogOpen(true)}>
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
          <h1 className="text-2xl font-semibold tracking-tight">Simulations</h1>
          <p className="text-sm text-muted-foreground">
            {runs.length} run{runs.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          New Simulation
        </Button>
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Nodes</TableHead>
              <TableHead className="text-right">Tx / Node</TableHead>
              <TableHead className="text-right">Tx Delay</TableHead>
              <TableHead className="text-right">Max Peers</TableHead>
              <TableHead className="text-right">Wait</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">Run #{run.run_id}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(run.status)}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    run.nodes_reported != null &&
                    run.nodes_expected != null &&
                    run.nodes_reported !== run.nodes_expected
                      ? 'text-destructive'
                      : ''
                  }`}
                >
                  {run.nodes_reported != null && run.nodes_expected != null
                    ? `${formatNum(run.nodes_reported)} | ${formatNum(run.nodes_expected)}`
                    : formatNum(run.node_count)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    run.actual_tx_per_node != null &&
                    run.tx_count != null &&
                    Math.round(run.actual_tx_per_node) !== run.tx_count
                      ? 'text-destructive'
                      : ''
                  }`}
                >
                  {run.actual_tx_per_node != null && run.tx_count != null
                    ? `${formatNum(Math.round(run.actual_tx_per_node))} | ${formatNum(run.tx_count)}`
                    : formatNum(run.tx_count)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {run.tx_delay != null ? `${run.tx_delay}s` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNum(run.max_peers)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {run.wait != null ? `${run.wait}s` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDurationMs(run.duration)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(run.started_at), 'PPp')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Run actions"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => handleViewRun(run.run_id)}
                      >
                        <Eye />
                        {run.status === 'completed' || run.status === 'complete'
                          ? 'View Details'
                          : 'View'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={run.status === 'running'}
                        onSelect={() => handleDeleteRun(run.run_id)}
                      >
                        <Trash2 />
                        {deletingId === run.run_id ? 'Deleting…' : 'Delete'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <StartSimulationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default Simulations;
