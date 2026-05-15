import { cn } from '@/lib/utils';

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export function DetailRow({
  label,
  value,
  icon: Icon,
  className,
}: DetailRowProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {value}
      </div>
    </div>
  );
}

export default DetailRow;
