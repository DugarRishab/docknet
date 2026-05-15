import {
  useTangleData,
  usePeerTopology,
  useRunSummary,
} from '@/hooks/useTangleData';
import {
  useGenerateReport,
  useGeneratedReportMarkdown,
} from '@/hooks/useGeneratedReport';
import { ExecutiveSummary } from './ExecutiveSummary';
import { TopologyAnalysis } from './TopologyAnalysis';
import { ThroughputMetrics } from './ThroughputMetrics';
import { ConnectivityStats } from './ConnectivityStats';
import { ConflictAnalysis } from './ConflictAnalysis';
import { GeneratedReportView } from './GeneratedReportView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { FileText } from 'lucide-react';

interface RunReportProps {
  runId: number;
}

export function RunReport({ runId }: RunReportProps) {
  const { data: tangleData, isLoading: tangleLoading } = useTangleData(runId);
  const { data: topology, isLoading: topologyLoading } = usePeerTopology(runId);
  const { data: summary, isLoading: summaryLoading } = useRunSummary(runId);

  const generateReport = useGenerateReport(runId);
  const { data: generatedMarkdown, isLoading: markdownLoading } =
    useGeneratedReportMarkdown(runId, generateReport.isSuccess);

  const lastGenerated = generateReport.data?.generatedAt;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-semibold">Run Report</span>
                {lastGenerated && (
                  <span className="text-sm text-muted-foreground">
                    Last generated:{' '}
                    {new Date(lastGenerated).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <Button
              onClick={() => generateReport.mutate()}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText data-icon="inline-start" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <GeneratedReportView
          runId={runId}
          markdown={generatedMarkdown || ''}
          generatedAt={lastGenerated}
          isLoading={markdownLoading}
        />
        <ExecutiveSummary
          runId={runId}
          summary={summary}
          isLoading={summaryLoading}
        />
        <TopologyAnalysis topology={topology} isLoading={topologyLoading} />
        <ThroughputMetrics tangleData={tangleData} isLoading={tangleLoading} />
        <ConnectivityStats topology={topology} isLoading={topologyLoading} />
        <ConflictAnalysis tangleData={tangleData} isLoading={tangleLoading} />
      </div>
    </div>
  );
}

export default RunReport;
