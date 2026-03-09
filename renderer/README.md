# renderer/

React + Vite frontend. The same codebase runs inside Electron (desktop) **and** in a browser (web mode). Components never call `window.electronAPI` directly — they go through the `useBackend()` hook which auto-selects the right transport.

## Entry points

| File | Description |
|------|-------------|
| `index.html` | HTML shell loaded by Vite / Electron |
| `src/main.tsx` | React root — wraps `<App>` with `<BackendProvider>` |
| `src/App.tsx` | Top-level layout: activity bar, sidebar, editor, chat panel, terminal, agent execution context |

## Key directories

| Directory | Description |
|-----------|-------------|
| [`src/backend/`](src/backend/README.md) | Backend abstraction layer (Electron IPC vs HTTP) |
| [`src/components/`](src/components/README.md) | All UI components (including agent builder & trace viewer) |
| [`src/context/`](src/context/README.md) | React context providers (Backend, Workspace, AgentExecution) |
| [`src/hooks/`](src/hooks/README.md) | Custom React hooks (including agent pipeline, configs, trace) |
| [`src/types/`](src/types/README.md) | TypeScript type definitions (including agent builder types) |
| [`src/utils/`](src/utils/README.md) | Utility functions (including parameterizable prompt builders) |
| `src/styles/` | Additional CSS (ui-components) |

## Agent System

The renderer includes a full **visual agent builder** and **execution trace viewer**:

- **Agent Builder** (`AgentsPanel.tsx`) — node-based pipeline editor with per-node tool selectors, custom prompts, and edges
- **Agent Parameters** (`ParametersEditorModal`) — edit all numeric limits and prompt templates per-agent, with reset-to-default
- **Trace Viewer** — displays timestamped execution traces with step input/output, token counts, and status
- **Agent Pipeline** (`useAgentPipeline.ts`) — fully parameterizable orchestrator that threads `AgentParameters` through all prompt builders
- **Agent Configs** (`useAgentConfigs.ts`) — CRUD for agent configs, persisted to disk
- **Agent Execution Context** (`AgentExecutionContext.tsx`) — bridges execution and observability

## How the backend abstraction works

```
Component / Hook
  → useBackend()                   // from context/BackendContext.tsx
    → BackendAPI interface         // from backend/types.ts
      ├─ electron-adapter.ts       // window.electronAPI (IPC)
      └─ http-adapter.ts           // fetch() + WebSocket
```

Detection is automatic: if `window.electronAPI` exists → Electron mode, otherwise → web mode.

## Building

```bash
# Development (Vite dev server with HMR)
npm run dev:renderer

# Production build (outputs to renderer/dist/)
npx vite build
```

## Vite config

`vite.config.ts` (at project root) configures:
- React plugin
- `renderer/` as the Vite root
- `@/` alias → `renderer/src/`
- Dev proxy: `/api` → `localhost:3001`, `/ws` → `ws://localhost:3001`
