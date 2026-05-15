import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { DetailRow } from '@/components/common/DetailRow';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import type { PeerNode } from '@/types';
import { X, Server, Users, Activity, Wifi } from 'lucide-react';

interface NodeInspectorProps {
  node: PeerNode;
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const { setSelectedNode } = useVisualizerStore();

  return (
    <div className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle className="text-sm font-medium">Node Details</CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSelectedNode(null)}
          aria-label="Close"
        >
          <X />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          <DetailRow
            label="Node ID"
            value={<span className="font-mono">{node.id}</span>}
            icon={Server}
          />

          {node.label && <DetailRow label="Label" value={node.label} />}

          <Separator />

          <DetailRow
            label="Status"
            value={
              <Badge
                variant={node.state === 'connected' ? 'default' : 'secondary'}
              >
                <Wifi data-icon="inline-start" />
                {node.state}
              </Badge>
            }
          />

          <DetailRow
            label="Connected Peers"
            value={`${node.peerCount} peers`}
            icon={Users}
          />

          <Separator />

          {node.connectedPeers && node.connectedPeers.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Peer Connections</p>
              <div className="rounded-md border">
                <Table>
                  <TableBody>
                    {node.connectedPeers.slice(0, 10).map((peer) => (
                      <TableRow key={peer.id}>
                        <TableCell className="font-mono text-xs">
                          {peer.id.slice(0, 16)}…
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            {peer.state === 1 ? 'Active' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {node.connectedPeers.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  +{node.connectedPeers.length - 10} more
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm" className="flex-1">
              <Activity data-icon="inline-start" />
              Ping
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default NodeInspector;
