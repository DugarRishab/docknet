import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { StartSimulationDialog } from '@/components/dialogs/StartSimulationDialog';
import {
  LayoutDashboard,
  Database,
  ListOrdered,
  Network,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/simulations', icon: Database, label: 'Simulations' },
  { path: '/queue', icon: ListOrdered, label: 'Queue' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
];

export function Navbar() {
  const { isConnected } = useTelemetryStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <nav className="flex h-16 items-center gap-4 border-b bg-background px-6 justify-between">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md  text-primary-foreground">
          <Network className="size-4" />
        </div>
        <span className="font-heading text-sm font-semibold">DOCKNET</span>
        <Separator orientation="vertical" className="h-16 ml-2" />
      </div>

      

      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive: linkActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  linkActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {/* <Button
          onClick={() => setDialogOpen(true)}
          size="sm"
        >
          <Play className="size-4" />
          Start Simulation
        </Button> */}
        <Badge
          variant={isConnected ? 'default' : 'destructive'}
          className="flex items-center gap-1"
        >
          <span
            className={cn(
              'size-2 rounded-full',
              isConnected ? 'bg-current' : 'bg-current'
            )}
            aria-hidden
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      <StartSimulationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </nav>
  );
}

export default Navbar;
