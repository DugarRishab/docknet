import React, { useState, useEffect } from "react";
import { Layout, Typography } from "antd";
import Navbar from "./components/Navbar";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import GraphViewer from "./components/GraphViewer";
import axios from "axios";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export default function App() {
	const [nodes, setNodes] = useState([
		{ key: "Node Alpha", label: "Node Alpha" },
		{ key: "Node Beta", label: "Node Beta" },
		{ key: "Node Gamma", label: "Node Gamma" },
		{ key: "Node Delta", label: "Node Delta" },
		{ key: "Node Epsilon", label: "Node Epsilon" },
		{ key: "Node Zeta", label: "Node Zeta" },
		{ key: "Node Eta", label: "Node Eta" },
		{ key: "Node Theta", label: "Node Theta" },
		{ key: "Node Iota", label: "Node Iota" },
		{ key: "Node Kappa", label: "Node Kappa" },
		{ key: "Node Lambda", label: "Node Lambda" },
		{ key: "Node Mu", label: "Node Mu" },
	]);
	const [selectedNode, setSelectedNode] = useState(null);
	const [graphData, setGraphData] = useState([
		{
			transaction_id: "tx-001",
			timestamp: "2025-06-20T10:00:00Z",
			timestampInt: 1718925600,
			sender: "Node Alpha",
			receiver: "Node Beta",
			amount: 100,
			unit: "kWh",
			price_per_unit: 0.12,
			currency: "USD",
			previous_transactions: [],
			cumulative_weight: 1,
			proof_of_work: "0000a1b2c3",
		},
		{
			transaction_id: "tx-002",
			timestamp: "2025-06-20T10:01:00Z",
			timestampInt: 1718925660,
			sender: "Node Gamma",
			receiver: "Node Delta",
			amount: 50,
			unit: "kWh",
			price_per_unit: 0.15,
			currency: "USD",
			previous_transactions: [],
			cumulative_weight: 1,
			proof_of_work: "0000d4e5f6",
		},
		{
			transaction_id: "tx-003",
			timestamp: "2025-06-20T10:02:00Z",
			timestampInt: 1718925720,
			sender: "Node Beta",
			receiver: "Node Epsilon",
			amount: 20,
			unit: "kWh",
			price_per_unit: 0.11,
			currency: "USD",
			previous_transactions: ["tx-001"],
			cumulative_weight: 2,
			proof_of_work: "0000abc123",
		},
		{
			transaction_id: "tx-004",
			timestamp: "2025-06-20T10:03:00Z",
			timestampInt: 1718925780,
			sender: "Node Delta",
			receiver: "Node Zeta",
			amount: 30,
			unit: "kWh",
			price_per_unit: 0.14,
			currency: "USD",
			previous_transactions: ["tx-002"],
			cumulative_weight: 2,
			proof_of_work: "0000def456",
		},
		{
			transaction_id: "tx-005",
			timestamp: "2025-06-20T10:04:00Z",
			timestampInt: 1718925840,
			sender: "Node Epsilon",
			receiver: "Node Eta",
			amount: 25,
			unit: "kWh",
			price_per_unit: 0.13,
			currency: "USD",
			previous_transactions: ["tx-003", "tx-002"],
			cumulative_weight: 3,
			proof_of_work: "0000fed987",
		},
		{
			transaction_id: "tx-006",
			timestamp: "2025-06-20T10:05:00Z",
			timestampInt: 1718925900,
			sender: "Node Zeta",
			receiver: "Node Theta",
			amount: 40,
			unit: "kWh",
			price_per_unit: 0.16,
			currency: "USD",
			previous_transactions: ["tx-004", "tx-001"],
			cumulative_weight: 3,
			proof_of_work: "0000bac876",
		},
		{
			transaction_id: "tx-007",
			timestamp: "2025-06-20T10:06:00Z",
			timestampInt: 1718925960,
			sender: "Node Eta",
			receiver: "Node Iota",
			amount: 15,
			unit: "kWh",
			price_per_unit: 0.1,
			currency: "USD",
			previous_transactions: ["tx-005", "tx-003"],
			cumulative_weight: 4,
			proof_of_work: "0000cba234",
		},
		{
			transaction_id: "tx-008",
			timestamp: "2025-06-20T10:07:00Z",
			timestampInt: 1718926020,
			sender: "Node Theta",
			receiver: "Node Kappa",
			amount: 60,
			unit: "kWh",
			price_per_unit: 0.17,
			currency: "USD",
			previous_transactions: ["tx-006"],
			cumulative_weight: 2,
			proof_of_work: "0000fed321",
		},
		{
			transaction_id: "tx-009",
			timestamp: "2025-06-20T10:08:00Z",
			timestampInt: 1718926080,
			sender: "Node Iota",
			receiver: "Node Lambda",
			amount: 35,
			unit: "kWh",
			price_per_unit: 0.12,
			currency: "USD",
			previous_transactions: ["tx-007", "tx-005"],
			cumulative_weight: 5,
			proof_of_work: "0000fab567",
		},
		{
			transaction_id: "tx-010",
			timestamp: "2025-06-20T10:09:00Z",
			timestampInt: 1718926140,
			sender: "Node Kappa",
			receiver: "Node Mu",
			amount: 45,
			unit: "kWh",
			price_per_unit: 0.18,
			currency: "USD",
			previous_transactions: ["tx-008", "tx-004", "tx-002"],
			cumulative_weight: 6,
			proof_of_work: "0000ace890",
		},
	]);

	// useEffect(() => {
	// 	axios.get("/api/workers").then((res) => setNodes(res.data));
	// }, []);

	// useEffect(() => {
	// 	if (selectedNode) {
	// 		const ws = new WebSocket(
	// 			`ws://localhost:4000/tangle/${selectedNode.id}`
	// 		);
	// 		ws.onmessage = (evt) => {
	// 			const data = JSON.parse(evt.data);
	// 			setGraphData(data);
	// 		};
	// 		return () => ws.close();
	// 	}
	// }, [selectedNode]);

	const handleAction = (type) => {
		axios.post(`/api/simulation/${type}`);
	};

	return (
		<Layout style={{ height: "100vh" }}>
			<Header>
				<Navbar title="DockNet Dashboard" />
			</Header>
			<Toolbar onAction={handleAction} />
			<Layout>
				<Sider width={250}>
					<Sidebar
						nodes={nodes}
						selected={selectedNode}
						onSelect={setSelectedNode}
					/>
				</Sider>
				<Content style={{ padding: 24, background: "#fff" }}>
					{selectedNode ? (
						<GraphViewer transactions={graphData} />
					) : (
						<Title level={4}>
							Select a node to view its Tangle
						</Title>
					)}
				</Content>
			</Layout>
		</Layout>
	);
}
