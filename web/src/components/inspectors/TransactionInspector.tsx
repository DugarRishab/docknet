import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DetailRow } from '@/components/common/DetailRow';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import type { Transaction } from '@/types';
import { format } from 'date-fns';
import { Copy, X, GitCommit, Clock, Scale } from 'lucide-react';

interface TransactionInspectorProps {
  transaction: Transaction;
}

export function TransactionInspector({
  transaction,
}: TransactionInspectorProps) {
  const { setSelectedTransaction, toggleComparison } = useVisualizerStore();
  const data = transaction.data;
  const metadata = transaction.metadata;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle className="text-sm font-medium">
          Transaction Details
        </CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSelectedTransaction(null)}
          aria-label="Close"
        >
          <X />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Transaction ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {data.transaction_id}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(data.transaction_id)}
                aria-label="Copy"
              >
                <Copy />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Sender" value={data.sender} />
            <DetailRow label="Receiver" value={data.receiver} />
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Amount</p>
            <div className="text-lg font-semibold">
              {data.amount} {data.unit || 'units'}
            </div>
            {data.price_per_unit && (
              <p className="text-xs text-muted-foreground">
                @ {data.price_per_unit} {data.currency || 'USD'}
              </p>
            )}
          </div>

          <DetailRow
            label="Timestamp"
            value={format(data.timestamp, 'PPpp')}
            icon={Clock}
          />

          {metadata?.cumulative_weight !== undefined && (
            <DetailRow
              label="Cumulative Weight"
              value={metadata.cumulative_weight}
              icon={Scale}
            />
          )}

          <DetailRow
            label="Status"
            value={
              <Badge
                variant={
                  metadata?.consensusTimestamp ? 'default' : 'secondary'
                }
              >
                {metadata?.consensusTimestamp ? 'Confirmed' : 'Pending'}
              </Badge>
            }
          />

          <Separator />

          {data.parents && data.parents.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                Parents ({data.parents.length})
              </p>
              <div className="flex flex-col gap-1">
                {data.parents.slice(0, 3).map((parentId) => (
                  <div key={parentId} className="flex items-center gap-2">
                    <GitCommit className="size-3 text-muted-foreground" />
                    <code className="flex-1 truncate text-xs">{parentId}</code>
                  </div>
                ))}
                {data.parents.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{data.parents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => toggleComparison(data.transaction_id)}
            >
              Compare
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() =>
                handleCopy(JSON.stringify(transaction, null, 2))
              }
            >
              Export JSON
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default TransactionInspector;
