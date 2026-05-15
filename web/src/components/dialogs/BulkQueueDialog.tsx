import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useBulkAddQueueItems } from '@/hooks/useSimulationQueue';
import { estimateDuration, formatDurationSeconds } from '@/lib/simulationParams';
import { Layers, Play, AlertCircle } from 'lucide-react';

interface BulkQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BULK_DEFAULTS = {
  tx_delay: 300,
  wait: 600,
  max_peers: 5,
  orphan_ttl: 600,
  orphan_pool_max: 1000,
  rate_limit_base: 100000,
  rate_limit_burst: 200000,
  rate_limit_window_sec: 60,
  monitor_period: 5,
};

const TX_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const NODE_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10];

function buildItems(nodeCount: number, datePrefix: string) {
  return TX_COUNTS.map((txCount) => ({
    label: `bulk-N${nodeCount}-tx${txCount}-${datePrefix}`,
    node_count: nodeCount,
    tx_count: txCount,
    tx_delay: BULK_DEFAULTS.tx_delay,
    wait: BULK_DEFAULTS.wait,
    max_peers: BULK_DEFAULTS.max_peers,
    orphan_ttl: BULK_DEFAULTS.orphan_ttl,
    orphan_pool_max: BULK_DEFAULTS.orphan_pool_max,
    rate_limit_base: BULK_DEFAULTS.rate_limit_base,
    rate_limit_burst: BULK_DEFAULTS.rate_limit_burst,
    rate_limit_window_sec: BULK_DEFAULTS.rate_limit_window_sec,
    monitor_period: BULK_DEFAULTS.monitor_period,
  }));
}

function formatDatePrefix() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function BulkQueueDialog({ open, onOpenChange }: BulkQueueDialogProps) {
  const bulkAdd = useBulkAddQueueItems();
  const [pendingNode, setPendingNode] = useState<number | null>(null);

  const datePrefix = useMemo(() => formatDatePrefix(), []);

  const handleQueueNodeBatch = async (nodeCount: number) => {
    setPendingNode(nodeCount);
    try {
      const items = buildItems(nodeCount, datePrefix);
      await bulkAdd.mutateAsync({ items });
    } finally {
      setPendingNode(null);
    }
  };

  const handleQueueAll = async () => {
    setPendingNode(-1);
    try {
      const allItems = NODE_COUNTS.flatMap((n) => buildItems(n, datePrefix));
      await bulkAdd.mutateAsync({ items: allItems });
    } finally {
      setPendingNode(null);
    }
  };

  const totalDurationAll = useMemo(() => {
    return NODE_COUNTS.reduce((sum, n) => {
      return (
        sum +
        TX_COUNTS.reduce((s, tx) => {
          return (
            s +
            estimateDuration({
              node_count: n,
              tx_count: tx,
              tx_delay: BULK_DEFAULTS.tx_delay,
              wait: BULK_DEFAULTS.wait,
              max_peers: BULK_DEFAULTS.max_peers,
              orphan_ttl: BULK_DEFAULTS.orphan_ttl,
              orphan_pool_max: BULK_DEFAULTS.orphan_pool_max,
              rate_limit_base: BULK_DEFAULTS.rate_limit_base,
              rate_limit_burst: BULK_DEFAULTS.rate_limit_burst,
              rate_limit_window_sec: BULK_DEFAULTS.rate_limit_window_sec,
              monitor_period: BULK_DEFAULTS.monitor_period,
            })
          );
        }, 0)
      );
    }, 0);
  }, []);

  const perBatchDuration = useMemo(() => {
    return TX_COUNTS.reduce((s, tx) => {
      return (
        s +
        estimateDuration({
          node_count: 3,
          tx_count: tx,
          tx_delay: BULK_DEFAULTS.tx_delay,
          wait: BULK_DEFAULTS.wait,
          max_peers: BULK_DEFAULTS.max_peers,
          orphan_ttl: BULK_DEFAULTS.orphan_ttl,
          orphan_pool_max: BULK_DEFAULTS.orphan_pool_max,
          rate_limit_base: BULK_DEFAULTS.rate_limit_base,
          rate_limit_burst: BULK_DEFAULTS.rate_limit_burst,
          rate_limit_window_sec: BULK_DEFAULTS.rate_limit_window_sec,
          monitor_period: BULK_DEFAULTS.monitor_period,
        })
      );
    }, 0);
  }, []);

  const isBulkLoading = bulkAdd.isPending;
  const error = bulkAdd.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4" />
            Bulk Queue Simulations
          </DialogTitle>
          <DialogDescription>
            Queue many simulation runs with one click. Each preset queues 10
            runs with tx_count ranging 5→50.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <Alert>
            <AlertTitle>Bulk defaults</AlertTitle>
            <AlertDescription>
              tx_delay={BULK_DEFAULTS.tx_delay}s, wait={BULK_DEFAULTS.wait}s,
              rate_limit_base={BULK_DEFAULTS.rate_limit_base},{' '}
              rate_limit_burst={BULK_DEFAULTS.rate_limit_burst} (effectively
              disabled). Est. per batch:{' '}
              {formatDurationSeconds(perBatchDuration)}. Est. all 80 runs:{' '}
              {formatDurationSeconds(totalDurationAll)}.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NODE_COUNTS.map((nodeCount) => (
              <Button
                key={nodeCount}
                variant="outline"
                disabled={isBulkLoading}
                onClick={() => handleQueueNodeBatch(nodeCount)}
              >
                {pendingNode === nodeCount ? (
                  <Spinner data-icon="inline-start" className="size-4" />
                ) : (
                  <Play data-icon="inline-start" className="size-4" />
                )}
                {nodeCount} nodes × 10
              </Button>
            ))}
          </div>

          <Button
            disabled={isBulkLoading}
            onClick={handleQueueAll}
          >
            {pendingNode === -1 ? (
              <Spinner data-icon="inline-start" className="size-4" />
            ) : (
              <Layers data-icon="inline-start" className="size-4" />
            )}
            Queue All 8 Batches (80 runs)
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Failed to queue</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
