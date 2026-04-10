import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { TangleView } from "./views/TangleView";
import { HopHistoryView } from "./views/HopHistoryView";
import { PeerMapView } from "./views/PeerMapView";
import { SimulationStartView } from "./views/SimulationStartView";
import { useWebSocket } from "./hooks/useWebSocket";

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

function AppContent() {
	const [activeView, setActiveView] = useState("tangle");

	// Initialize WebSocket connection
	useWebSocket();

	return (
		<Layout activeView={activeView} onViewChange={setActiveView}>
			<div className="h-full">
				{activeView === "simulation" && <SimulationStartView />}
				{activeView === "tangle" && <TangleView />}
				{activeView === "hops" && <HopHistoryView />}
				{activeView === "peers" && <PeerMapView />}
			</div>
		</Layout>
	);
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AppContent />
		</QueryClientProvider>
	);
}

export default App;
