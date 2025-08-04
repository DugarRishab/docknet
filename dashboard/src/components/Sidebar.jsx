import React from "react";
import { Menu } from "antd";

export default function Sidebar({ nodes, selected, onSelect }) {
	return (
		<Menu
			mode="inline"
			selectedKeys={[selected?.id]}
			onClick={({ key }) => onSelect(nodes.find((n) => n.key === key))}
			items={nodes}
		>
			
		</Menu>
	);
}
