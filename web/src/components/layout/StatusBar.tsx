import { Badge } from '@/components/ui/badge';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  transactionCount?: number;
  nodeCount?: number;
  lastUpdate?: Date;
}

export function StatusBar({
  transactionCount,
  nodeCount,
  lastUpdate,
}: StatusBarProps) {
  const { isConnected, wsError } = useTelemetryStore();

  return (
    <div className="flex h-8 items-center justify-between border-t bg-card px-3 text-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              isConnected ? 'bg-primary' : 'bg-destructive'
            )}
            aria-hidden
          />
          <span
            className={
              isConnected ? 'text-foreground' : 'text-destructive'
            }
          >
            {isConnected ? 'Connected' : wsError || 'Disconnected'}
          </span>
        </div>

        {nodeCount !== undefined && (
          <Badge variant="secondary">{nodeCount} nodes</Badge>
        )}

        {transactionCount !== undefined && (
          <Badge variant="secondary">
            {transactionCount.toLocaleString()} tx
          </Badge>
        )}
      </div>

      {lastUpdate && (
        <span className="text-muted-foreground">
          Last update {formatDistanceToNow(lastUpdate, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

export default StatusBar;
