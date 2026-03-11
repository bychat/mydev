# Architecture Overview

This document describes the hexagonal (ports & adapters) architecture of the application after the refactoring effort. It covers how connectors, orchestration, and storage are decoupled from framework-specific code.

---

## Core Concepts

### Hexagonal Architecture (Ports & Adapters)

The application follows a hexagonal architecture where:

- **Core domain** (`core/`) defines interfaces (ports) and pure business logic
- **Adapters** (`main/`, `server/`, `renderer/`) implement those ports for specific runtimes
- **Connectors** (`connectors/`) are self-contained plugins that implement the `Connector` interface

```
                    ┌─────────────────────────────────┐
                    │          CORE DOMAIN             │
                    │                                  │
                    │  connector.ts  (ConnectorRegistry)│
                    │  orchestrator.ts (Workflow, Agent) │
                    │  workflow-engine.ts               │
                    │  storage.ts    (StoragePort)      │
                    │  backend-adapter.ts               │
                    │                                  │
                    └─────────┬─────────┬──────────────┘
                              │         │
                 ┌────────────┤         ├────────────┐
                 ▼            ▼         ▼            ▼
          ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
          │ Electron │ │  Server  │ │ Renderer │ │   CLI    │
          │  (IPC)   │ │  (REST)  │ │ (React)  │ │          │
          └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## Connectors (Plugin System)

### Structure

Each connector lives in its own folder under `connectors/`:

```
connectors/
  github/
    api.ts     ← Pure HTTP client (no Electron/Express imports)
    index.ts   ← Connector plugin implementing the Connector interface
  atlassian/
    api.ts
    index.ts
  supabase/
    api.ts
    index.ts
  index.ts     ← Registry + barrel exports
```

### Key Interface: `Connector<TConfig>`

```ts
interface Connector<TConfig> {
  metadata: ConnectorMetadata;
  configFields: ConnectorConfigField[];
  actions: ConnectorAction[];
  testConnection(config: TConfig): Promise<{ success: boolean; error?: string }>;
  executeAction(actionId: string, config: TConfig, params?: Record<string, unknown>): Promise<ConnectorActionResult>;
}
```

### Adding a New Connector

1. Create `connectors/my-service/api.ts` — pure API client
2. Create `connectors/my-service/index.ts` — implement `Connector<MyConfig>`
3. Add to `connectors/index.ts` → `builtInConnectors` array
4. That's it — UI, IPC, REST all pick it up automatically

---

## Storage (Port Pattern)

### `core/storage.ts` — `StoragePort`

All persistence goes through this port interface. No domain module directly accesses the filesystem or database.

```ts
interface StoragePort {
  readJSON<T>(key: string, fallback: T): T | Promise<T>;
  writeJSON(key: string, data: unknown): void | Promise<void>;
  loadConnectorConfigs(): ...;
  saveConnectorConfig(...): ...;
  saveConnectorState(...): ...;
  loadSingleConnectorConfig(...): ...;
}
```

**Built-in adapter:** `FileStorageAdapter` — reads/writes JSON files in the user-data directory.

**Swappable:** Call `setStorage(myAdapter)` to use a database, cloud storage, or in-memory adapter (for testing).

---

## Orchestrator (Agent Profiles & Workflows)

### `core/orchestrator.ts`

Defines the domain types:

- **`AgentProfile`** — customizable persona with model, tools, and prompt overrides
- **`Workflow`** — a DAG of `WorkflowStep`s
- **`Artifact`** — data produced by steps (files, diffs, logs, JSON, messages)

### `core/workflow-engine.ts`

Pure application service that runs a workflow's step graph. Depends only on ports:

- `LlmPort` — for AI calls
- `WorkspaceToolPort` — for file/git/terminal operations
- `ConnectorRegistry` — for connector actions
- `OrchestratorStorage` — for persisting state

### IPC & REST Endpoints

| Operation | Electron IPC | REST Endpoint |
|-----------|-------------|---------------|
| List profiles | `orchestrator-list-profiles` | `GET /api/orchestrator/profiles` |
| Save profile | `orchestrator-save-profile` | `POST /api/orchestrator/profiles` |
| Delete profile | `orchestrator-delete-profile` | `DELETE /api/orchestrator/profiles/:id` |
| List workflows | `orchestrator-list-workflows` | `GET /api/orchestrator/workflows` |
| Get workflow | `orchestrator-get-workflow` | `GET /api/orchestrator/workflows/:id` |
| Save workflow | `orchestrator-save-workflow` | `POST /api/orchestrator/workflows` |
| Delete workflow | `orchestrator-delete-workflow` | `DELETE /api/orchestrator/workflows/:id` |

---

## Backend Adapters (Renderer ↔ Backend)

The renderer **never** directly uses `window.electronAPI` or `fetch()`. Instead:

```ts
// renderer/src/backend/index.ts
const backend = getBackend(); // auto-detects Electron vs Web
backend.connectorList();
backend.orchestratorListProfiles();
```

### `BackendAPI` interface (`renderer/src/backend/types.ts`)

Single interface covering all operations. Both adapters implement it:

- **`ElectronAdapter`** — delegates to `window.electronAPI` (IPC)
- **`HttpAdapter`** — delegates to REST + WebSocket

### `BackendAdapter` interface (`core/backend-adapter.ts`)

Higher-level abstraction for domain-specific grouping:

```ts
interface BackendAdapter {
  connectors: ConnectorOperations;
  orchestrator: OrchestratorOperations;
  mode: 'desktop' | 'cloud';
}
```

---

## Legacy Backward Compatibility

Per-connector IPC handlers and REST routes still exist for backward compatibility:

- `main/ipc/integrations.ipc.ts` — legacy Supabase/GitHub/Atlassian IPC
- `server/routes/integrations.routes.ts` — legacy REST routes
- `main/atlassian.ts`, `main/github.ts`, `main/supabase.ts` — re-export shims

**New code should use:**
- Generic connector API: `connector-execute` IPC / `POST /api/connectors/:id/actions/:actionId`
- Orchestrator API: `orchestrator-*` IPC / `/api/orchestrator/*` REST

Legacy routes will be removed in a future release once all renderer code is migrated.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `core/connector.ts` | Connector interface, ConnectorRegistry |
| `core/orchestrator.ts` | Workflow, AgentProfile, port interfaces |
| `core/workflow-engine.ts` | Workflow execution engine |
| `core/storage.ts` | StoragePort + FileStorageAdapter |
| `core/connector-bootstrap.ts` | Shared connector initialization |
| `core/backend-adapter.ts` | Backend adapter interfaces |
| `connectors/index.ts` | Built-in connector registration |
| `connectors/*/api.ts` | Pure API clients |
| `connectors/*/index.ts` | Connector plugins |
| `main/ipc/orchestrator.ipc.ts` | Electron IPC for orchestrator |
| `server/routes/orchestrator.routes.ts` | REST routes for orchestrator |
| `renderer/src/backend/types.ts` | Renderer BackendAPI interface |
