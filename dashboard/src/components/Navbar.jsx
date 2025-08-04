import React from "react";
import { Typography } from "antd";
const { Title } = Typography;

export default function Navbar({ title }) {
	return (
		<Title level={3} style={{ color: "white", margin: 0 }}>
			{title}
		</Title>
	);
}
