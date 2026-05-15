import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Simulations } from '@/pages/Simulations';
import { RunDetail } from '@/pages/RunDetail';
import { SimulationQueue } from '@/pages/SimulationQueue';
import { Reports } from '@/pages/Reports';
import { ReportDetail } from '@/pages/ReportDetail';

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="simulations" element={<Simulations />} />
              <Route path="queue" element={<SimulationQueue />} />
              <Route path="run/:runId" element={<RunDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/:reportId" element={<ReportDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App
