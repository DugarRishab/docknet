import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatTile } from '@/components/common/StatTile';
import { AlertTriangle, CheckCircle2, GitBranch, Scale } from 'lucide-react';
import type { TangleData } from '@/types';

interface ConflictAnalysisProps {
  tangleData?: TangleData;
  isLoading: boolean;
}

export function ConflictAnalysis({
  tangleData,
  isLoading,
}: ConflictAnalysisProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conflict / Resolution Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!tangleData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conflict / Resolution Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transaction data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { transactions } = tangleData;

  const transactionsWithConflicts = transactions.filter((tx) => {
    const parents = tx.data.parents || [];
    return parents.length > 2;
  });

  const conflictCount = transactionsWithConflicts.length;
  const totalTx = transactions.length;
  const conflictRate = totalTx > 0 ? (conflictCount / totalTx) * 100 : 0;

  const resolvedConflicts = conflictCount;
  const resolutionRate =
    conflictCount > 0 ? (resolvedConflicts / conflictCount) * 100 : 0;

  const avgTips =
    transactions.reduce(
      (sum, tx) => sum + (tx.data.parents?.length || 0),
      0
    ) / (transactions.length || 1);

  const weights = transactions.map((tx) => tx.metadata?.cumulative_weight || 0);
  const maxWeight = Math.max(...weights, 1);
  const minWeight = Math.min(...weights, 0);
  const avgWeight =
    weights.reduce((sum, w) => sum + w, 0) / (weights.length || 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" />
          Conflict / Resolution Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile
            title="Conflicts"
            value={conflictCount}
            description={`${conflictRate.toFixed(1)}% of transactions`}
            icon={AlertTriangle}
          />
          <StatTile
            title="Resolved"
            value={resolvedConflicts}
            description={`${resolutionRate.toFixed(1)}% resolution rate`}
            icon={CheckCircle2}
          />
          <StatTile
            title="Avg Tips"
            value={avgTips.toFixed(1)}
            description="Per transaction"
            icon={GitBranch}
          />
          <StatTile
            title="Avg Weight"
            value={avgWeight.toFixed(0)}
            description="Cumulative"
            icon={Scale}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Consensus Health</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <Card>
              <CardContent className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  Resolution Rate
                </span>
                <span className="font-semibold">
                  {resolutionRate.toFixed(1)}%
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-sm">
                  <GitBranch className="size-4 text-muted-foreground" />
                  Branching Factor
                </span>
                <span className="font-semibold">{avgTips.toFixed(2)}</span>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Weight Distribution</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <StatTile title="Minimum" value={minWeight} />
            <StatTile title="Maximum" value={maxWeight} />
            <StatTile title="Average" value={avgWeight.toFixed(1)} />
          </div>
        </div>

        <Alert>
          <Scale />
          <AlertTitle>Analysis Summary</AlertTitle>
          <AlertDescription>
            This simulation showed {conflictRate.toFixed(1)}% conflicting
            transactions with a {resolutionRate.toFixed(1)}% resolution rate.
            The average cumulative weight of {avgWeight.toFixed(1)} indicates{' '}
            {avgWeight > 10 ? 'strong' : 'moderate'} consensus across the
            network.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default ConflictAnalysis;
