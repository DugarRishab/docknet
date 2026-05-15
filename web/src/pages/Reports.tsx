import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useMultiRunReports, useDeleteReport } from '@/hooks/useReports';
import { CreateReportDialog } from '@/components/dialogs/CreateReportDialog';
import { FileText, Trash2, BarChart3, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Reports() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: reports, isLoading, error } = useMultiRunReports();
  const deleteMutation = useDeleteReport();

  const handleDelete = (reportId: string) => {
    if (!confirm('Delete this report?')) return;
    deleteMutation.mutate(reportId, {
      onSuccess: () => console.log('Report deleted'),
      onError: () => console.error('Failed to delete report'),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Reports</h1>
          <p className="text-muted-foreground">
            Multi-run comparative analysis and IEEE-grade research reports
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <BarChart3 className="mr-2 size-4" />
          Start Analysis
        </Button>
      </div>

      <Separator />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (!reports || reports.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Reports Yet</h3>
            <p className="mb-4 max-w-sm text-muted-foreground">
              Generate your first multi-run comparative analysis report by clicking "Start Analysis"
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <BarChart3 className="mr-2 size-4" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {reports && reports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card
              key={report.reportId}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                !report.ready && 'opacity-70'
              )}
              onClick={() => report.ready && navigate(`/reports/${report.reportId}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{report.reportId}</CardTitle>
                  <Badge variant={report.ready ? 'default' : 'secondary'}>
                    {report.ready ? 'Ready' : 'Generating'}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {report.generatedAt
                    ? new Date(report.generatedAt).toLocaleString()
                    : 'Pending...'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Runs analyzed</span>
                  <span className="font-medium">{report.runCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Charts</span>
                  <span className="font-medium">{report.chartsCount}</span>
                </div>
                {report.ready && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/reports/${report.reportId}`);
                      }}
                    >
                      <FileText className="mr-2 size-3" />
                      View Report
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(report.reportId);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
                {!report.ready && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin" />
                    Generating report...
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateReportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
