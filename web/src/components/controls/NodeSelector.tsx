import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Server, ChevronLeft, ChevronRight } from 'lucide-react';

interface NodeSelectorProps {
  nodes: string[];
  selectedNode: string;
  onSelectNode: (node: string) => void;
}

export function NodeSelector({
  nodes,
  selectedNode,
  onSelectNode,
}: NodeSelectorProps) {
  if (nodes.length === 0) {
    return null;
  }

  const currentIndex = nodes.indexOf(selectedNode);

  const handlePrevious = () => {
    const newIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1;
    onSelectNode(nodes[newIndex]);
  };

  const handleNext = () => {
    const newIndex = currentIndex >= nodes.length - 1 ? 0 : currentIndex + 1;
    onSelectNode(nodes[newIndex]);
  };

  return (
    <div className="flex items-center gap-2">
      <Server className="size-3.5 text-muted-foreground" aria-hidden />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handlePrevious}
        disabled={nodes.length <= 1}
        aria-label="Previous node"
      >
        <ChevronLeft />
      </Button>
      <Select value={selectedNode} onValueChange={onSelectNode}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Select node..." />
        </SelectTrigger>
        <SelectContent>
          {nodes.map((node) => (
            <SelectItem key={node} value={node}>
              {node}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleNext}
        disabled={nodes.length <= 1}
        aria-label="Next node"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export default NodeSelector;
