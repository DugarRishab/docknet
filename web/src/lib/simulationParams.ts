// Shared simulation parameters and validation
// Keep in sync with central/controllers/simulationController.js validation

export interface SimulationFormData {
  node_count: number;
  tx_count: number;
  tx_delay: number;
  max_peers: number;
  wait: number;
  orphan_ttl: number;
  orphan_pool_max: number;
  rate_limit_base: number;
  rate_limit_burst: number;
  rate_limit_window_sec: number;
  monitor_period: number;
}

export interface FieldConfig {
  key: keyof SimulationFormData;
  label: string;
  description: string;
  iconName: string;
  min: number;
  max: number;
  unit?: string;
}

export const fieldConfigs: FieldConfig[] = [
  { key: 'node_count', label: 'Node Count',        description: 'Number of nodes in the simulation network',           iconName: 'Users',    min: 1, max: 100 },
  { key: 'tx_count',   label: 'Tx per Node',       description: 'Transactions each node generates',                    iconName: 'Database', min: 1, max: 10000 },
  { key: 'tx_delay',   label: 'Transaction Delay', description: 'Seconds each node waits between transactions',        iconName: 'Timer',    min: 0, max: 3600,   unit: 's' },
  { key: 'max_peers',  label: 'Max Peers',         description: 'Maximum peer connections per node',                   iconName: 'Network',  min: 1, max: 50 },
  { key: 'wait',       label: 'Wait Period',       description: 'Seconds to wait after last tx for queue drain',       iconName: 'Clock',    min: 0, max: 3600,  unit: 's' },
  { key: 'orphan_ttl', label: 'Orphan TTL',        description: 'Seconds before orphan transactions expire',            iconName: 'Trash2',   min: 60, max: 3600,  unit: 's' },
  { key: 'orphan_pool_max', label: 'Orphan Pool Max', description: 'Maximum orphan transactions to retain',              iconName: 'Layers',   min: 100, max: 5000 },
  { key: 'rate_limit_base', label: 'Rate Limit Base', description: 'Base rate limit per peer',                            iconName: 'Gauge',    min: 1, max: 1000000 },
  { key: 'rate_limit_burst', label: 'Rate Limit Burst', description: 'Burst allowance for rate limiting',                  iconName: 'Zap',      min: 1, max: 1000000 },
  { key: 'rate_limit_window_sec', label: 'Rate Window', description: 'Rate limit window in seconds',                       iconName: 'Timer',    min: 1, max: 300,   unit: 's' },
  { key: 'monitor_period', label: 'Monitor Period',  description: 'Telemetry reporting interval in seconds',               iconName: 'Activity', min: 1, max: 60,    unit: 's' },
];

export const presets = {
  small:  { node_count: 3,  tx_count: 5,  tx_delay: 5,  max_peers: 3,  wait: 60,  orphan_ttl: 600, orphan_pool_max: 1000, rate_limit_base: 10, rate_limit_burst: 20, rate_limit_window_sec: 60, monitor_period: 5 },
  medium: { node_count: 5,  tx_count: 10, tx_delay: 10, max_peers: 5,  wait: 120, orphan_ttl: 600, orphan_pool_max: 1000, rate_limit_base: 10, rate_limit_burst: 20, rate_limit_window_sec: 60, monitor_period: 5 },
  large:  { node_count: 10, tx_count: 20, tx_delay: 15, max_peers: 8,  wait: 300, orphan_ttl: 600, orphan_pool_max: 1000, rate_limit_base: 10, rate_limit_burst: 20, rate_limit_window_sec: 60, monitor_period: 5 },
  stress: { node_count: 20, tx_count: 30, tx_delay: 5,  max_peers: 10, wait: 300, orphan_ttl: 600, orphan_pool_max: 1000, rate_limit_base: 10, rate_limit_burst: 20, rate_limit_window_sec: 60, monitor_period: 5 },
};

export type ValidationErrors = Partial<Record<keyof SimulationFormData, string>>;

export function validateField(key: keyof SimulationFormData, value: number): string | undefined {
  const config = fieldConfigs.find(f => f.key === key);
  if (!config) return undefined;

  if (isNaN(value)) return 'Please enter a valid number';
  if (value < config.min) return `Must be at least ${config.min}`;
  if (value > config.max) return `Must be at most ${config.max}`;
  return undefined;
}

export function validateForm(data: SimulationFormData): ValidationErrors {
  const result: ValidationErrors = {};
  for (const config of fieldConfigs) {
    const error = validateField(config.key, data[config.key]);
    if (error) result[config.key] = error;
  }
  return result;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Estimate simulation duration in **seconds**.
 *
 * Each node generates `tx_count` transactions sequentially with `tx_delay`
 * seconds between each. All nodes run in parallel, so per-node work dominates
 * the wall-clock time. After the last transaction, every node sleeps for
 * `wait` seconds to allow queue drain.
 */
export function estimateDuration(formData: SimulationFormData): number {
  const setupTime = 5 + formData.node_count * 2;            // container boot + per-node init
  const txTime    = formData.tx_count * formData.tx_delay;  // per-node sequential generation
  const drainTime = formData.wait;                          // post-tx wait period
  return Math.ceil(setupTime + txTime + drainTime);
}

/**
 * Format a duration given in seconds as a compact human-readable string.
 * e.g. 45 → "45s", 125 → "2m 5s", 7325 → "2h 2m".
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}
