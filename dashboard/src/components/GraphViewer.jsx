import React, { useRef, useState, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Spin } from "antd";

/**
 * GraphViewer expects a prop `transactions` which is an array of objects:
 * {
 *   transaction_id: string,
 *   timestamp: string,
 *   timestampInt: number,
 *   sender: string,
 *   receiver: string,
 *   amount: number,
 *   unit: string,
 *   price_per_unit: number,
 *   currency: string,
 *   previous_transactions: string[],
 *   cumulative_weight: number,
 *   proof_of_work: string
 * }
 */
export default function GraphViewer({ transactions = [] }) {
	const fgRef = useRef();
	const [graphData, setGraphData] = useState({ nodes: [], links: [] });

	useEffect(() => {
		// Transform transactions into ForceGraph2D format
		const nodes = transactions.map((tx) => ({
			id: tx.transaction_id,
			weight: tx.cumulative_weight,
			timestamp: tx.timestamp,
			timestampInt: tx.timestampInt,
			sender: tx.sender,
			receiver: tx.receiver,
			amount: tx.amount,
			unit: tx.unit,
			price_per_unit: tx.price_per_unit,
			currency: tx.currency,
			proof_of_work: tx.proof_of_work,
		}));

		const links = transactions.flatMap((tx) =>
			tx.previous_transactions.map((prevId) => ({
				source: prevId,
				target: tx.transaction_id,
			}))
		);

		setGraphData({ nodes, links });
	}, [transactions]);

	const nodePaint = (node, ctx, globalScale) => {
		let color = "#ffffff";
		if (node.weight > 5) color = "#52c41a";
		else if (node.weight > 1) color = "#faad14";
		const radius = 5 + (node.weight > 1 ? Math.log(node.weight) : 0);
		ctx.beginPath();
		ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
		ctx.fillStyle = color;
		ctx.fill();
	};

	if (!transactions.length) {
		return (
			<Spin
				style={{ margin: "auto", display: "block", paddingTop: 50 }}
			/>
		);
	}

	return (
		<ForceGraph2D
			ref={fgRef}
			graphData={graphData}
			nodeCanvasObject={nodePaint}
			nodePointerAreaPaint={nodePaint}
			linkDirectionalParticles={2}
			width={window.innerWidth - 300}
			height={window.innerHeight - 120}
			onNodeHover={(node) => {
				/* handled by parent tooltip */
			}}
			dagMode="radial"
		/>
	);
}
