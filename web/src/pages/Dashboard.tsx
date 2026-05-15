import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { SimulationHeatmap } from '@/components/dashboard/SimulationHeatmap';
import {
  useDashboardSummary,
  useDashboardHeatmap,
} from '@/hooks/useDashboard';
import StartSimulation from './StartSimulation';

export function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: heatmap, isLoading: heatmapLoading } = useDashboardHeatmap();

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all simulation runs
        </p>
      </header>

      <DashboardStats data={summary} isLoading={summaryLoading} />

      <div className="flex flex-row gap-4">
        <SimulationHeatmap data={heatmap} isLoading={heatmapLoading} />

        <div className="w-196">
          <StartSimulation />
        </div>
      </div>

      
    </div>
  );
}

export default Dashboard;
