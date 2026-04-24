import React from "react";
import { Network, Activity, Wifi, Settings, Play, Loader2 } from "lucide-react";
import { useTelemetryStore } from "../store/useTelemetryStore";
import { useAvailableRuns, useNodes } from "../hooks/useTangleData";

interface LayoutProps {
	children: React.ReactNode;
	activeView: string;
	onViewChange: (view: string) => void;
}

const navItems = [
	{ id: "simulation", label: "Start Simulation", icon: Play },
	{ id: "tangle", label: "Tangle View", icon: Network },
	{ id: "hops", label: "Hop History", icon: Activity },
	{ id: "peers", label: "Peer Map", icon: Wifi },
];

export function Layout({ children, activeView, onViewChange }: LayoutProps) {
	const { isConnected, wsError, selectedRunId, setSelectedRunId } =
		useTelemetryStore();

	// Fetch available runs from API
	const { data: runs, isLoading: runsLoading, error: runsError } = useAvailableRuns();

	// Fetch nodes for selected run
	const { data: nodes, isLoading: nodesLoading } = useNodes(selectedRunId);

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* Header */}
			<header className="h-14 border-b border-border bg-card/50 flex items-center px-4 gap-4">
				<div className="flex items-center gap-2">
					<Network className="w-6 h-6 text-primary" />
					<h1 className="text-lg font-semibold">DockNet Telemetry</h1>
				</div>

				{/* Navigation */}
				<nav className="flex items-center gap-1 ml-4">
					{navItems.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								onClick={() => onViewChange(item.id)}
								className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
									activeView === item.id
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground hover:bg-accent"
								}`}
							>
								<Icon className="w-4 h-4" />
								{item.label}
							</button>
						);
					})}
				</nav>

				<div className="ml-auto flex items-center gap-4">
					{/* Run ID selector */}
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							Run:
						</span>
						{runsLoading ? (
							<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
						) : runsError || !runs || runs.length === 0 ? (
							<select
								value={selectedRunId}
								onChange={(e) => setSelectedRunId(parseInt(e.target.value))}
								aria-label="Select run ID"
								className="bg-background border border-input rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value={0}>Run 0</option>
							</select>
						) : (
							<select
								value={selectedRunId}
								onChange={(e) => setSelectedRunId(parseInt(e.target.value))}
								aria-label="Select run ID"
								className="bg-background border border-input rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								{runs.map((run) => (
									<option key={run.run_id} value={run.run_id}>
										Run {run.run_id} ({run.node_count || 0} nodes)
									</option>
								))}
							</select>
						)}
					</div>

					{/* Node count display */}
					{nodes && nodes.length > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">
								Nodes:
							</span>
							<span className="text-sm font-medium">
								{nodesLoading ? (
									<Loader2 className="w-3 h-3 animate-spin inline" />
								) : (
									nodes.length
								)}
							</span>
						</div>
					)}

					{/* Connection status */}
					<div className="flex items-center gap-2">
						<div
							className={`w-2 h-2 rounded-full ${
								isConnected
									? "bg-emerald-500 animate-pulse"
									: "bg-red-500"
							}`}
						/>
						<span className="text-sm text-muted-foreground">
							{isConnected
								? "Connected"
								: wsError || "Disconnected"}
						</span>
					</div>

					<button
						className="p-2 rounded-md hover:bg-accent text-muted-foreground"
						aria-label="Settings"
					>
						<Settings className="w-4 h-4" />
					</button>
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 overflow-hidden">{children}</main>
		</div>
	);
}

export default Layout;
