import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import type { ViewTab } from '@/types';
import { Network, Share2, GitGraph, FileText } from 'lucide-react';

interface EditorLayoutProps {
  runId: number;
  transactionCount?: number;
  nodeCount?: number;
  children: ReactNode;
}

const TABS: { value: ViewTab; label: string; icon: typeof Network }[] = [
  { value: 'tangle', label: 'Tangle DAG', icon: Network },
  { value: 'peers', label: 'Peer Map', icon: Share2 },
  { value: 'hops', label: 'Hops', icon: GitGraph },
  { value: 'report', label: 'Report', icon: FileText },
];

export function EditorLayout({
  runId,
  transactionCount,
  nodeCount,
  children,
}: EditorLayoutProps) {
  const {
    activeTab,
    setActiveTab,
    selectedOriginNode,
    availableNodes,
    setSelectedOriginNode,
  } = useVisualizerStore();

  const showOriginSelect =
    activeTab !== 'report' && availableNodes.length > 1;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ViewTab)}
      className="flex h-full w-full flex-1 min-h-0 flex-col gap-0"
    >
      <div className="flex flex-wrap items-center gap-4 border-b bg-background px-6 py-3">
        <div className="flex flex-col">
          <span className="font-heading text-sm font-semibold">
            Run #{runId}
          </span>
          <span className="text-xs text-muted-foreground">
            {typeof transactionCount === 'number'
              ? `${transactionCount} tx`
              : '— tx'}
            {' · '}
            {typeof nodeCount === 'number' ? `${nodeCount} nodes` : '— nodes'}
          </span>
        </div>

        <TabsList variant="default" className="ml-2 bg-transparent gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                <Icon data-icon="inline-start" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {showOriginSelect && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Origin node</span>
            <Select
              value={selectedOriginNode}
              onValueChange={setSelectedOriginNode}
            >
              <SelectTrigger size="sm" className="w-56">
                <SelectValue placeholder="Select node" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableNodes.map((node) => (
                    <SelectItem key={node} value={node}>
                      <span className="font-mono text-xs">
                        {node.length > 24 ? `${node.slice(0, 24)}…` : node}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </Tabs>
  );
}

export default EditorLayout;
