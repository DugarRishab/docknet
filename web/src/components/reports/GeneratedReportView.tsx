import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { ChevronDown, ChevronUp, FileDown, FileText } from 'lucide-react';
import {
  getChartImageUrl,
  fetchGeneratedReportBundle,
} from '@/hooks/useGeneratedReport';

interface GeneratedReportViewProps {
  runId: number;
  markdown: string;
  generatedAt?: string;
  isLoading?: boolean;
}

export function GeneratedReportView({
  runId,
  markdown,
  generatedAt,
  isLoading = false,
}: GeneratedReportViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const bundleContent = await fetchGeneratedReportBundle(runId);
      const blob = new Blob([bundleContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `run_${runId}_report.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report bundle:', err);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `run_${runId}_report.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const ImageComponent = (
    props: React.ImgHTMLAttributes<HTMLImageElement>
  ) => {
    const { src, alt, ...rest } = props;
    let fullSrc = src || '';
    if (src && src.startsWith('charts/')) {
      fullSrc = getChartImageUrl(runId, src.replace('charts/', ''));
    }
    return (
      <img
        src={fullSrc}
        alt={alt || ''}
        {...rest}
        className="max-w-full rounded-md border"
      />
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Generated Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Spinner />
            Loading report…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!markdown) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Generated Report
            {generatedAt && (
              <span className="text-xs font-normal text-muted-foreground">
                (generated {new Date(generatedAt).toLocaleString()})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FileDown data-icon="inline-start" />
              )}
              {isDownloading ? 'Downloading…' : 'Download .md'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp data-icon="inline-start" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown data-icon="inline-start" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <ScrollArea className="h-[600px] rounded-md border bg-muted p-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ImageComponent,
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}

export default GeneratedReportView;
