import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  useGenerateMultiRunReport,
  useFilteredRuns,
  type ReportFilters,
  type FilteredRun,
} from '@/hooks/useReports';
import { BarChart3, Filter, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateReportDialog({ open, onOpenChange }: CreateReportDialogProps) {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  const [useFilters, setUseFilters] = useState(true);
  const [generating, setGenerating] = useState(false);

  const {
    data: filteredRuns,
    isLoading: runsLoading,
    error: runsError,
  } = useFilteredRuns(filters, useFilters && open);

  const generateMutation = useGenerateMultiRunReport();

  const updateFilter = useCallback(
    <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
      setSelectedRunIds([]);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    setSelectedRunIds([]);
  }, []);

  const toggleRunSelection = useCallback((runId: number) => {
    setSelectedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payload = useFilters
        ? { filters }
        : { runIds: selectedRunIds };

      await generateMutation.mutateAsync(payload);
      onOpenChange(false);
      setFilters({});
      setSelectedRunIds([]);
    } finally {
      setGenerating(false);
    }
  };

  const hasSelection = useFilters
    ? (filteredRuns && filteredRuns.length > 0)
    : selectedRunIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            Create Multi-Run Analysis Report
          </DialogTitle>
          <DialogDescription>
            Select simulation runs by filters or manually, then generate a research-grade
            comparative report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={useFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setUseFilters(true);
                setSelectedRunIds([]);
              }}
            >
              <Filter className="mr-2 size-4" />
              Filter Runs
            </Button>
            <Button
              variant={!useFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setUseFilters(false);
                setFilters({});
              }}
            >
              Manual Select
            </Button>
          </div>

          {useFilters && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Filter Criteria</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {/* Node Count Range */}
                  <div className="space-y-2">
                    <Label>Node Count Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.nodeRange?.[0] ?? ''}
                        onChange={(e) =>
                          updateFilter('nodeRange', [
                            parseInt(e.target.value) || 0,
                            filters.nodeRange?.[1] ?? 100,
                          ])
                        }
                        className="h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.nodeRange?.[1] ?? ''}
                        onChange={(e) =>
                          updateFilter('nodeRange', [
                            filters.nodeRange?.[0] ?? 0,
                            parseInt(e.target.value) || 100,
                          ])
                        }
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Tx Count Range */}
                  <div className="space-y-2">
                    <Label>Tx Count Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.txRange?.[0] ?? ''}
                        onChange={(e) =>
                          updateFilter('txRange', [
                            parseInt(e.target.value) || 0,
                            filters.txRange?.[1] ?? 10000,
                          ])
                        }
                        className="h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.txRange?.[1] ?? ''}
                        onChange={(e) =>
                          updateFilter('txRange', [
                            filters.txRange?.[0] ?? 0,
                            parseInt(e.target.value) || 10000,
                          ])
                        }
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Tx Delay */}
                  <div className="space-y-2">
                    <Label>Tx Delay (ms)</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={filters.txDelay ?? ''}
                      onChange={(e) =>
                        updateFilter(
                          'txDelay',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      className="h-8"
                    />
                  </div>

                  {/* Max Peers */}
                  <div className="space-y-2">
                    <Label>Max Peers</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={filters.maxPeers ?? ''}
                      onChange={(e) =>
                        updateFilter(
                          'maxPeers',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      className="h-8"
                    />
                  </div>

                  {/* Orphan TTL */}
                  <div className="space-y-2">
                    <Label>Orphan TTL (s)</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={filters.orphanTtl ?? ''}
                      onChange={(e) =>
                        updateFilter('orphanTtl', e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      className="h-8"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={filters.status || 'all'}
                      onValueChange={(val) =>
                        updateFilter('status', val === 'all' ? undefined : (val as ReportFilters['status']))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Any status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                {filteredRuns && (
                  <Badge variant="secondary">{filteredRuns.length} runs match</Badge>
                )}
              </div>
            </>
          )}

          {/* Runs table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {useFilters ? 'Matching Runs' : 'All Runs'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="mr-2 size-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading runs...</span>
                </div>
              )}

              {runsError && (
                <div className="flex items-center justify-center gap-2 py-8 text-destructive">
                  <AlertCircle className="size-5" />
                  <span>Failed to load runs</span>
                </div>
              )}

              {filteredRuns && filteredRuns.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No runs match the selected criteria
                </div>
              )}

              {filteredRuns && filteredRuns.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 px-2 text-xs font-medium text-muted-foreground">
                    {!useFilters && <span>Select</span>}
                    <span>Run ID</span>
                    <span>Nodes</span>
                    <span>Tx Count</span>
                    <span>Status</span>
                    <span>Date</span>
                  </div>
                  <Separator />
                  <div className="max-h-[240px] overflow-y-auto space-y-1">
                    {filteredRuns.map((run: FilteredRun) => {
                      const isSelected = selectedRunIds.includes(run.run_id);
                      return (
                        <div
                          key={run.run_id}
                          className={cn(
                            'grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 rounded-md px-2 py-1.5 text-sm items-center',
                            !useFilters && 'cursor-pointer hover:bg-muted',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => !useFilters && toggleRunSelection(run.run_id)}
                        >
                          {!useFilters && (
                            <div className="flex items-center justify-center">
                              {isSelected && <Check className="size-4 text-primary" />}
                            </div>
                          )}
                          <span className="font-mono">{run.run_id}</span>
                          <span>{run.param_node_count}</span>
                          <span>{run.param_tx_count}</span>
                          <Badge
                            variant={
                              run.status === 'complete' || run.status === 'completed'
                                ? 'default'
                                : run.status === 'running'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="w-fit text-xs"
                          >
                            {run.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {run.started_at
                              ? new Date(run.started_at).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!hasSelection || generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 size-4" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
