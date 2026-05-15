import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/empty';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { StatTile } from '@/components/common/StatTile';
import { StartSimulationDialog } from '@/components/dialogs/StartSimulationDialog';
import { BulkQueueDialog } from '@/components/dialogs/BulkQueueDialog';
import { EditQueueItemDialog } from '@/components/dialogs/EditQueueItemDialog';
import {
  useQueue,
  useRemoveQueueItem,
  useReorderQueue,
  useStartQueueNow,
  usePreemptQueue,
  type QueueItem,
} from '@/hooks/useSimulationQueue';
import { estimateDuration } from '@/lib/simulationParams';
import {
  Play,
  Plus,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ListOrdered,
  AlertTriangle,
  ChevronRight,
  Edit2,
  Clock,
  Timer,
} from 'lucide-react';

function StatusBadge({
  status,
  errorMessage,
}: {
  status: string;
  errorMessage?: string;
}) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline">PENDING</Badge>;
    case 'started':
      return (
        <Badge variant="secondary" className="gap-1">
          <Spinner data-icon="inline-start" className="size-4" />
          STARTED
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 data-icon="inline-start" className="size-4" />
          COMPLETED
        </Badge>
      );
    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger asChild> 
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle data-icon="inline-start" className="size-4" />
              ERROR
            </Badge>
          </TooltipTrigger>
          {errorMessage && <TooltipContent>{errorMessage}</TooltipContent>}
        </Tooltip>
      );
    default:
      return <Badge variant="outline">{status.toUpperCase()}</Badge>;
  }
}

/**
 * Format hours as "X.Y hrs" or "Xh Ym" for display
 */
function formatHours(totalHours: number): string {
  if (!Number.isFinite(totalHours) || totalHours <= 0) return '0h';
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function SimulationQueue() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: queueItems, isLoading: queueLoading } = useQueue(4000);
  const removeItem = useRemoveQueueItem();
  const reorderItems = useReorderQueue();
  const startNow = useStartQueueNow();
  const preemptQueue = usePreemptQueue();

  const handleDelete = (id: number) => removeItem.mutate(id);

  const handleEdit = (item: QueueItem) => {
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleMoveUp = (index: number) => {
    if (!queueItems || index === 0) return;
    const pendingItems = queueItems.filter((item) => item.status === 'pending');
    if (pendingItems.length < 2) return;
    const itemIndex = pendingItems.findIndex(
      (item) => item.id === queueItems[index].id
    );
    if (itemIndex <= 0) return;
    const newOrder = [...pendingItems];
    [newOrder[itemIndex], newOrder[itemIndex - 1]] = [
      newOrder[itemIndex - 1],
      newOrder[itemIndex],
    ];
    reorderItems.mutate(newOrder.map((item) => item.id));
  };

  const handleMoveDown = (index: number) => {
    if (!queueItems) return;
    const pendingItems = queueItems.filter((item) => item.status === 'pending');
    if (pendingItems.length < 2) return;
    const itemIndex = pendingItems.findIndex(
      (item) => item.id === queueItems[index].id
    );
    if (itemIndex < 0 || itemIndex >= pendingItems.length - 1) return;
    const newOrder = [...pendingItems];
    [newOrder[itemIndex], newOrder[itemIndex + 1]] = [
      newOrder[itemIndex + 1],
      newOrder[itemIndex],
    ];
    reorderItems.mutate(newOrder.map((item) => item.id));
  };

  // Calculate stats
  const pendingItems = queueItems?.filter((item) => item.status === 'pending') ?? [];
  const startedItems = queueItems?.filter((item) => item.status === 'started') ?? [];
  const completedItems = queueItems?.filter((item) => item.status === 'completed') ?? [];
  const errorItems = queueItems?.filter((item) => item.status === 'error') ?? [];

  // Calculate total hours ran from completed queue items
  const totalHoursRan = useMemo(() => {
    let totalSeconds = 0;
    for (const item of completedItems) {
      if (item.started_at && item.completed_at) {
        const start = new Date(item.started_at).getTime();
        const end = new Date(item.completed_at).getTime();
        totalSeconds += (end - start) / 1000;
      }
    }
    return totalSeconds / 3600;
  }, [completedItems]);

  // Calculate total hours remaining from pending items
  const totalHoursRemaining = useMemo(() => {
    let totalSeconds = 0;
    for (const item of pendingItems) {
      totalSeconds += estimateDuration({
        node_count: item.node_count,
        tx_count: item.tx_count,
        tx_delay: item.tx_delay,
        max_peers: item.max_peers,
        orphan_ttl: item.orphan_ttl,
        orphan_pool_max: item.orphan_pool_max,
        rate_limit_base: item.rate_limit_base,
        rate_limit_burst: item.rate_limit_burst,
        rate_limit_window_sec: item.rate_limit_window_sec,
        monitor_period: item.monitor_period,
        wait: item.wait,
      });
    }
    return totalSeconds / 3600;
  }, [pendingItems]);

  // Filter and sort queue items - always by position (front of queue at top)
  const filteredItems = useMemo(() => {
    if (!queueItems) return [];
    if (statusFilter === 'all') return queueItems;
    return queueItems.filter(item => item.status === statusFilter);
  }, [queueItems, statusFilter]);

  // Always sort by position ascending (front of queue at top)
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => a.position - b.position);
  }, [filteredItems]);

  // ============================================================================
  // QUEUE TABLE VIEW
  // ============================================================================
  const renderQueueTable = () => (
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {['all', 'pending', 'started', 'completed', 'error'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
        <div className="rounded-md border">
          {queueLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Spinner className="size-5" />
            </div>
          ) : sortedItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Params</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {item.position}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {item.label || `Queue item ${item.id}`}
                        </span>
                        {item.error_message && (
                          <span className="text-xs text-destructive">
                            {item.error_message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>
                          {item.node_count} nodes × {item.tx_count} tx
                        </span>
                        <span className="text-muted-foreground">
                          orphan_ttl {item.orphan_ttl}s · wait {item.wait}s · monitor {item.monitor_period}s
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={item.status}
                        errorMessage={item.error_message ?? undefined}
                      />
                    </TableCell>
                    <TableCell>
                      {item.run_id ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => navigate(`/run/${item.run_id}`)}
                        >
                          Run #{item.run_id}
                          <ChevronRight data-icon="inline-end" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(item)}
                            aria-label="Edit"
                          >
                            <Edit2 />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              const originalIndex = queueItems?.findIndex(i => i.id === item.id) ?? 0;
                              handleMoveUp(originalIndex);
                            }}
                            disabled={reorderItems.isPending}
                            aria-label="Move up"
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              const originalIndex = queueItems?.findIndex(i => i.id === item.id) ?? 0;
                              handleMoveDown(originalIndex);
                            }}
                            disabled={reorderItems.isPending}
                            aria-label="Move down"
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => handleDelete(item.id)}
                            disabled={removeItem.isPending}
                            aria-label="Delete"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListOrdered />
                  </EmptyMedia>
                  <EmptyTitle>No queue items</EmptyTitle>
                  <EmptyDescription>
                    {statusFilter === 'all'
                      ? 'Add simulations to the queue to run them automatically one after another.'
                      : `No items with status "${statusFilter}" found.`}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>
    );

  // Main component return
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col gap-6 overflow-auto p-6">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Simulation Queue
            </h1>
            <p className="text-sm text-muted-foreground">
              Queue simulations to run automatically one after another.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-4" />
              Add to Queue
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
            >
              <Layers className="size-4" />
              Bulk Queue
            </Button>
            <Button
              variant="outline"
              onClick={() => preemptQueue.mutate()}
              disabled={preemptQueue.isPending}
            >
              <AlertTriangle data-icon="inline-start" />
              Preempt
            </Button>
            <Button
              onClick={() => startNow.mutate()}
              disabled={startNow.isPending || pendingItems.length === 0}
            >
              <Play data-icon="inline-start" />
              Run Next Now
            </Button>
          </div>
        </header>

        {/* Stats Grid - Now with 6 cards including hours */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile title="Pending" value={pendingItems.length} />
          <StatTile title="Running" value={startedItems.length} />
          <StatTile title="Completed" value={completedItems.length} />
          <StatTile title="Errors" value={errorItems.length} />
          <StatTile
            title="Hours Ran"
            value={formatHours(totalHoursRan)}
            icon={Clock}
          />
          <StatTile
            title="Hours Remaining"
            value={formatHours(totalHoursRemaining)}
            icon={Timer}
          />
        </div>

        {renderQueueTable()}

        <StartSimulationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        <BulkQueueDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
        />

        <EditQueueItemDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          item={editingItem}
        />
      </div>
    </TooltipProvider>
  );
}

export default SimulationQueue;
