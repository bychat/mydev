# mydev Connector Plugin System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                       │
│                     (renderer/src/)                          │
│                                                             │
│  Uses BackendAdapter interface — never talks to backend     │
│  directly. Same UI works in desktop AND cloud mode.         │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    ┌─────▼──────┐          ┌──────▼───────┐
    │  Electron   │          │   Express    │
    │  IPC Bridge │          │  REST API    │
    │  (desktop)  │          │  (cloud)     │
    └─────┬──────┘          └──────┬───────┘
          │                         │
          └────────────┬────────────┘
                       │
              ┌────────▼────────┐
              │   Connector     │
              │   Registry      │
              │   (core/)       │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼───┐    ┌────▼────┐   ┌────▼────────┐
   │ GitHub  │    │ Jira    │   │ Supabase    │
   │Connector│    │Connector│   │ Connector   │
   └─────────┘    └─────────┘   └─────────────┘
                  ... more ...
```

## Quick Start

### Desktop (Open Source)
```bash
npm run dev         # Start Electron app with all connectors
```

### Cloud (Enterprise)
```bash
npm run server:dev  # Start Express API server with hot-reload
```

## Adding a New Connector

**It takes ~5 minutes to add a new integration.** No changes to the UI, IPC layer, or server needed.

### Step 1: Copy the template

```bash
cp connectors/_template.connector.ts connectors/linear.connector.ts
```

### Step 2: Implement the interface

Edit `connectors/linear.connector.ts`:

```typescript
import type { Connector, ConnectorActionResult } from '../core/connector';

export interface LinearConfig {
  apiKey: string;
}

export const linearConnector: Connector<LinearConfig> = {
  metadata: {
    id: 'linear',
    name: 'Linear',
    description: 'Linear issue tracking and project management',
    icon: 'linear',
    category: 'project-management',
    version: '1.0.0',
  },
  
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  
  actions: [
    { id: 'list-issues', name: 'List Issues', description: 'Fetch issues' },
    { id: 'list-projects', name: 'List Projects', description: 'Fetch projects' },
  ],
  
  async testConnection(config) {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Authorization': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { id } }' }),
    });
    return res.ok ? { success: true } : { success: false, error: `HTTP ${res.status}` };
  },
  
  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    // Implement your actions here
    switch (actionId) {
      case 'list-issues':
        // ... call Linear API
        return { success: true, data: [] };
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
```

### Step 3: Register it

In `connectors/index.ts`, add:

```typescript
import { linearConnector } from './linear.connector';

export const builtInConnectors: Connector<any>[] = [
  githubConnector,
  atlassianConnector,
  supabaseConnector,
  linearConnector,     // ← Add here
];
```

**Done.** The connector is now available via:
- Desktop: Electron IPC → `connector-list`, `connector-execute`, etc.
- Cloud: REST API → `GET /api/connectors`, `POST /api/connectors/linear/actions/list-issues`

## API Reference

### REST API (Cloud Mode)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/connectors` | List all connectors |
| `GET` | `/api/connectors/:id` | Get connector details |
| `POST` | `/api/connectors/:id/test` | Test connection |
| `POST` | `/api/connectors/:id/config` | Save config |
| `GET` | `/api/connectors/:id/config` | Load config |
| `POST` | `/api/connectors/:id/actions/:actionId` | Execute action |
| `GET` | `/api/health` | Health check |

### IPC Channels (Desktop Mode)

| Channel | Description |
|---------|-------------|
| `connector-list` | List all connectors |
| `connector-get` | Get connector details |
| `connector-get-state` | Get connection state |
| `connector-test` | Test connection |
| `connector-save-config` | Save config |
| `connector-load-config` | Load config |
| `connector-execute` | Execute action |

## Enterprise Features (Cloud)

The server version (`server/index.ts`) is designed to be extended with:

- **Authentication**: JWT/OAuth2 middleware
- **RBAC**: Role-based access to connectors and actions
- **Audit Logging**: Track all connector operations
- **Multi-tenancy**: Isolate configs per team/org
- **AI Gateway**: Centralized AI routing with usage metering
- **SSE/WebSocket**: Real-time streaming for AI and live updates
- **Rate Limiting**: Per-user and per-connector throttling

## File Structure

```
core/
  connector.ts          # Connector interface + Registry (framework-agnostic)
  backend-adapter.ts    # BackendAdapter interface (desktop vs cloud)

connectors/
  index.ts              # Registers all built-in connectors
  _template.connector.ts # Template for new connectors
  github.connector.ts   # GitHub connector
  atlassian.connector.ts # Atlassian/Jira connector
  supabase.connector.ts # Supabase connector

main/
  connectorIpc.ts       # Electron IPC ↔ ConnectorRegistry bridge
  index.ts              # Electron main (registers connectors at boot)

server/
  index.ts              # Express REST API (enterprise cloud)
  tsconfig.json         # TypeScript config for server build
```
