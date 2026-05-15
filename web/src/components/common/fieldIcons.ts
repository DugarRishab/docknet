import {
  Users,
  Database,
  Timer,
  Network,
  Zap,
  Clock,
  type LucideIcon,
} from 'lucide-react';

export const fieldIconMap: Record<string, LucideIcon> = {
  Users,
  Database,
  Timer,
  Network,
  Zap,
  Clock,
};

export function getFieldIcon(name: string): LucideIcon {
  return fieldIconMap[name] ?? Database;
}
