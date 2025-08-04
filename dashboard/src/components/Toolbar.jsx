import React from "react";
import { Button, Space } from "antd";

export default function Toolbar({ onAction }) {
	return (
		<Space style={{ padding: "10px 20px", background: "#f0f2f5" }}>
			<Button type="primary" onClick={() => onAction("start")}>
				Start Simulation
			</Button>
			<Button danger onClick={() => onAction("stop")}>
				Stop Simulation
			</Button>
			<Button onClick={() => onAction("reset")}>Reset Tangle</Button>
		</Space>
	);
}
