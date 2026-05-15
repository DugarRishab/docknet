import { StatTile } from '@/components/common/StatTile';
import { Database, CheckCircle2, Network, FileCode } from 'lucide-react';
import type { DashboardSummary } from '@/hooks/useDashboard';

interface DashboardStatsProps {
  data?: DashboardSummary;
  isLoading: boolean;
}

export function DashboardStats({ data, isLoading }: DashboardStatsProps) {
  const stats = [
    {
      title: 'Total Runs',
      value: data?.totalRuns ?? 0,
      icon: Database,
      description: 'All simulation runs',
    },
    {
      title: 'Completed Runs',
      value: data?.completedRuns ?? 0,
      icon: CheckCircle2,
      description: 'Successfully completed',
    },
    {
      title: 'Total Nodes',
      value: data?.totalNodes ?? 0,
      icon: Network,
      description: 'Across all runs',
    },
    {
      title: 'Total Transactions',
      value: data?.totalTransactions?.toLocaleString() ?? 0,
      icon: FileCode,
      description: 'Processed transactions',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatTile
          key={stat.title}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
          loading={isLoading}
        />
      ))}
    </div>
  );
}

export default DashboardStats;
