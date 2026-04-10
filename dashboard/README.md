# DockNet Dashboard

A modern React-based telemetry dashboard for the DockNet Tangle simulation system.

## Features

- **Tangle View**: Interactive force-directed graph visualization of the entire DAG (Directed Acyclic Graph)
- **Hop History View**: Transaction propagation timelines with side-by-side comparison
- **Peer Map View**: P2P network topology with node health monitoring
- Real-time WebSocket updates from worker nodes
- shadcn/ui components with dark theme
- Responsive design with Tailwind CSS

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand (client) + React Query (server)
- **Visualization**: react-force-graph-2d, D3
- **Icons**: Lucide React
- **TypeScript**: Full TypeScript support

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Views

- `TangleView.tsx` - DAG visualization with search, filtering, and node selection
- `HopHistoryView.tsx` - Transaction hop history with comparison tools
- `PeerMapView.tsx` - Network topology graph with health indicators

### State Management

- `useTelemetryStore.ts` - Zustand store for WebSocket data and UI state
- `useTangleData.ts` - React Query hooks for REST API endpoints
- `useWebSocket.ts` - WebSocket connection with auto-reconnect

### API Integration

The dashboard connects to the DockNet Central Node via:

**REST Endpoints**:
- `GET /api/tangle/all` - Fetch aggregated tangle data
- `GET /api/tangle/:txId` - Single transaction details
- `GET /api/tangle/:txId/hops` - Transaction hop history
- `GET /api/tangle/compare/transactions` - Compare multiple transactions
- `GET /api/peers/topology` - Network topology
- `GET /api/peers/nodes/status` - Node health status

**WebSocket**:
- `ws://localhost:3000` - Real-time telemetry updates

## Configuration

The dashboard expects the Central Node to be running on `http://localhost:3000` (or the URL specified in your environment).

## Development

### Project Structure

```
src/
├── components/         # Reusable UI components
│   └── Layout.tsx      # Main layout with navigation
├── views/              # Page-level views
│   ├── TangleView.tsx
│   ├── HopHistoryView.tsx
│   └── PeerMapView.tsx
├── hooks/              # Custom React hooks
│   ├── useTangleData.ts
│   ├── useWebSocket.ts
│   └── useTelemetryStore.ts
├── lib/                # Utilities
│   └── utils.ts
├── store/              # State management
│   └── useTelemetryStore.ts
├── App.tsx             # Main app component
└── main.jsx            # Entry point
```

### Key Dependencies

- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `react-force-graph-2d` - Force-directed graph visualization
- `d3` - Data visualization utilities
- `lucide-react` - Icon library
- `tailwindcss-animate` - CSS animations

## License

Part of the DockNet Tangle Simulation Project.
