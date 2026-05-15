import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatTileProps {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ElementType;
  loading?: boolean;
}

export function StatTile({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: StatTileProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
        {description && !loading && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default StatTile;
