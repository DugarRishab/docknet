// src/components/TabbedNodeView.jsx
import React from "react";
import { Tabs } from "antd";
import GraphViewer from "./GraphViewer";
import TransactionHistory from "./TransactionHistory";

export default function TabbedNodeView({ graphData, nodeId }) {
	return (
		<Tabs defaultActiveKey="1" type="card">
			<Tabs.TabPane tab="Tangle View" key="1">
				<GraphViewer data={graphData} />
			</Tabs.TabPane>
			<Tabs.TabPane tab="Transaction History" key="2">
				<TransactionHistory nodeId={nodeId} />
			</Tabs.TabPane>
		</Tabs>
	);
}
