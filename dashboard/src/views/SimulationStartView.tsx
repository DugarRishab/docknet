import React, { useState } from "react";
import {
	Play,
	Settings,
	Users,
	Clock,
	Network,
	Zap,
	RotateCcw,
	CheckCircle,
	AlertCircle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

interface SimulationParams {
	node_count: number;
	tx_count: number;
	tx_delay: number;
	max_peers: number;
	pow: number;
	run: number;
	wait: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// API URL for starting simulation
// GET ${API_BASE_URL}/api/start?node_count=5&tx_count=100&tx_delay=50&max_peers=5&pow=3&run=0&wait=300

async function startSimulation(params: SimulationParams) {
	const queryParams = new URLSearchParams({
		node_count: params.node_count.toString(),
		tx_count: params.tx_count.toString(),
		tx_delay: params.tx_delay.toString(),
		max_peers: params.max_peers.toString(),
		pow: params.pow.toString(),
		run: params.run.toString(),
		wait: params.wait.toString(),
	});

	const response = await axios.get(
		`${API_BASE_URL}/api/start?${queryParams}`,
	);
	return response.data;
}

export function SimulationStartView() {
	const [params, setParams] = useState<SimulationParams>({
		node_count: 5,
		tx_count: 100,
		tx_delay: 30,
		max_peers: 5,
		pow: 3,
		run: 0,
		wait: 300,
	});

	const mutation = useMutation({
		mutationFn: startSimulation,
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		mutation.mutate(params);
	};

	const handleChange = (field: keyof SimulationParams, value: number) => {
		setParams((prev) => ({ ...prev, [field]: value }));
	};

	const resetToDefaults = () => {
		setParams({
			node_count: 5,
			tx_count: 100,
			tx_delay: 30,
			max_peers: 5,
			pow: 3,
			run: 0,
			wait: 300,
		});
		mutation.reset();
	};

	return (
		<div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Play className="w-6 h-6 text-primary" />
				<h2 className="text-xl font-semibold">Start Simulation</h2>
			</div>

			{/* API URL Reference */}
			<div className="bg-secondary/30 rounded-lg p-4 border border-border">
				<p className="text-sm text-muted-foreground mb-2">
					API Endpoint:
				</p>
				<code className="text-xs bg-background px-2 py-1 rounded font-mono break-all">
					GET {API_BASE_URL}/api/start?node_count={"{n}"}&tx_count=
					{"{n}"}&tx_delay={"{sec}"}&max_peers={"{n}"}&pow={"{1-5}"}
					&run={"{id}"}&wait={"{sec}"}
				</code>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Node Configuration */}
				<div className="bg-card border border-border rounded-lg p-6">
					<div className="flex items-center gap-2 mb-4">
						<Users className="w-5 h-5 text-primary" />
						<h3 className="text-lg font-medium">
							Node Configuration
						</h3>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Number of Nodes
							</label>
							<input
								type="number"
								min={1}
								max={100}
								value={params.node_count}
								onChange={(e) =>
									handleChange(
										"node_count",
										parseInt(e.target.value) || 1,
									)
								}
								title="Number of worker nodes to spawn"
								placeholder="5"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Worker nodes to spawn (1-100)
							</p>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">
								Max Peers per Node
							</label>
							<input
								type="number"
								min={1}
								max={20}
								value={params.max_peers}
								onChange={(e) =>
									handleChange(
										"max_peers",
										parseInt(e.target.value) || 1,
									)
								}
								title="Maximum peer connections per node"
								placeholder="5"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Maximum peer connections (1-20)
							</p>
						</div>
					</div>
				</div>

				{/* Transaction Configuration */}
				<div className="bg-card border border-border rounded-lg p-6">
					<div className="flex items-center gap-2 mb-4">
						<Zap className="w-5 h-5 text-primary" />
						<h3 className="text-lg font-medium">
							Transaction Configuration
						</h3>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Transactions per Node
							</label>
							<input
								type="number"
								min={1}
								max={10000}
								value={params.tx_count}
								onChange={(e) =>
									handleChange(
										"tx_count",
										parseInt(e.target.value) || 1,
									)
								}
								title="Number of transactions per node"
								placeholder="100"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								TX count per node
							</p>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">
								Transaction Delay (seconds)
							</label>
							<input
								type="number"
								min={0}
								max={10000}
								value={params.tx_delay}
								onChange={(e) =>
									handleChange(
										"tx_delay",
										parseInt(e.target.value) || 0,
									)
								}
								title="Delay between transactions in seconds"
								placeholder="30"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Delay between TX in seconds
							</p>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">
								PoW Difficulty (1-5)
							</label>
							<input
								type="number"
								min={1}
								max={5}
								value={params.pow}
								onChange={(e) =>
									handleChange(
										"pow",
										parseInt(e.target.value) || 1,
									)
								}
								title="Proof of Work difficulty level"
								placeholder="3"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Proof-of-Work difficulty
							</p>
						</div>
					</div>
				</div>

				{/* Simulation Settings */}
				<div className="bg-card border border-border rounded-lg p-6">
					<div className="flex items-center gap-2 mb-4">
						<Settings className="w-5 h-5 text-primary" />
						<h3 className="text-lg font-medium">
							Simulation Settings
						</h3>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Run ID
							</label>
							<input
								type="number"
								min={0}
								value={params.run}
								onChange={(e) =>
									handleChange(
										"run",
										parseInt(e.target.value) || 0,
									)
								}
								title="Run identifier for grouping results"
								placeholder="0"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Run identifier for grouping
							</p>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">
								Wait Period (seconds)
							</label>
							<input
								type="number"
								min={10}
								max={3600}
								value={params.wait}
								onChange={(e) =>
									handleChange(
										"wait",
										parseInt(e.target.value) || 10,
									)
								}
								title="Wait period after last transaction in seconds"
								placeholder="300"
								className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<p className="text-xs text-muted-foreground">
								Time to wait after last TX
							</p>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">
								Total Duration (est.)
							</label>
							<div className="px-3 py-2 bg-secondary/30 rounded-md text-sm">
								<Clock className="w-4 h-4 inline mr-2" />
								{Math.ceil(
									(params.tx_count * params.tx_delay +
										params.wait) /
										60,
								)}{" "}
								min
							</div>
							<p className="text-xs text-muted-foreground">
								Estimated completion time
							</p>
						</div>
					</div>
				</div>

				{/* Summary */}
				<div className="bg-secondary/30 rounded-lg p-4">
					<h4 className="text-sm font-medium mb-2">
						Simulation Summary
					</h4>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
						<div>
							<span className="text-muted-foreground">
								Total Nodes:
							</span>
							<span className="ml-2 font-semibold">
								{params.node_count}
							</span>
						</div>
						<div>
							<span className="text-muted-foreground">
								Total TX:
							</span>
							<span className="ml-2 font-semibold">
								{params.node_count * params.tx_count}
							</span>
						</div>
						<div>
							<span className="text-muted-foreground">
								Network Size:
							</span>
							<span className="ml-2 font-semibold">
								{params.node_count * params.max_peers} edges
								(max)
							</span>
						</div>
						<div>
							<span className="text-muted-foreground">
								Run ID:
							</span>
							<span className="ml-2 font-semibold">
								{params.run}
							</span>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-4">
					<button
						type="submit"
						disabled={mutation.isPending}
						className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{mutation.isPending ? (
							<>
								<div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
								Starting...
							</>
						) : (
							<>
								<Play className="w-4 h-4" />
								Start Simulation
							</>
						)}
					</button>

					<button
						type="button"
						onClick={resetToDefaults}
						disabled={mutation.isPending}
						className="flex items-center gap-2 px-4 py-3 border border-input rounded-md font-medium hover:bg-accent disabled:opacity-50"
					>
						<RotateCcw className="w-4 h-4" />
						Reset
					</button>
				</div>

				{/* Status */}
				{mutation.isSuccess && (
					<div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500">
						<CheckCircle className="w-5 h-5" />
						<span>
							Simulation started successfully!{" "}
							{mutation.data?.message}
						</span>
					</div>
				)}

				{mutation.isError && (
					<div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
						<AlertCircle className="w-5 h-5" />
						<span>
							Failed to start simulation:{" "}
							{mutation.error?.message}
						</span>
					</div>
				)}
			</form>
		</div>
	);
}

export default SimulationStartView;
