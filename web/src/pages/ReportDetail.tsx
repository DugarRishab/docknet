import { useParams, Link } from 'react-router-dom';
import { useReportContent, useReportStatus, getMultiRunChartUrl } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

// Custom markdown components for styling
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 text-xl font-semibold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-medium">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-4 leading-7 text-muted-foreground">{children}</p>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
      );
    }
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
        <code>{children}</code>
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-4 py-2">{children}</td>
  ),
  hr: () => <Separator className="my-6" />,
};

// Transform markdown image paths to full URLs
function transformMarkdown(content: string, reportId: string): string {
  // Replace relative chart paths with full URLs
  return content.replace(
    /!\[([^\]]*)\]\(charts\/([^)]+)\)/g,
    (_match, altText, fileName) => {
      return `![${altText}](${getMultiRunChartUrl(reportId, fileName)})`;
    }
  );
}

export function ReportDetail() {
  const { reportId } = useParams<{ reportId: string }>();
  const [showRaw, setShowRaw] = useState(false);

  const { data: status, isLoading: statusLoading } = useReportStatus(reportId || '', !!reportId);
  const { data: content, isLoading: contentLoading } = useReportContent(
    reportId || '',
    !!reportId && status?.ready
  );

  const transformedContent = useMemo(() => {
    if (!content || !reportId) return '';
    return transformMarkdown(content, reportId);
  }, [content, reportId]);

  const isLoading = statusLoading || contentLoading;
  const notReady = !statusLoading && !status?.ready;

  const handleDownload = () => {
    if (!content || !reportId) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/reports">
              <ArrowLeft className="mr-2 size-4" />
              Back to Reports
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{reportId}</h1>
            <p className="text-sm text-muted-foreground">Multi-Run Analysis Report</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.ready ? (
            <Badge variant="default">Ready</Badge>
          ) : (
            <Badge variant="secondary">Generating</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'View Rendered' : 'View Raw'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!content}
          >
            <Download className="mr-2 size-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="mr-2 size-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading report...</span>
          </div>
        )}

        {notReady && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Loader2 className="size-12 animate-spin text-primary" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Generating Report</h2>
              <p className="text-muted-foreground">
                This may take 30-60 seconds depending on the number of runs...
              </p>
            </div>
          </div>
        )}

        {status?.ready && content && (
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-4xl p-8">
              {showRaw ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-muted p-6 font-mono text-sm">
                  {content}
                </pre>
              ) : (
                <div className="prose prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown components={markdownComponents}>
                    {transformedContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
