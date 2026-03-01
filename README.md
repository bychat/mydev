# mydev.bychat.io

An open-source AI-powered developer workspace — runs as an Electron desktop app, a CLI, or an enterprise cloud server.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the desktop app in development mode:

```bash
npm run dev
```

Start the enterprise cloud server:

```bash
npm run server:dev
```

Use the CLI:

```bash
npm run cli -- "explain the auth flow"
npm run cli -- -m agent "add dark mode support"
npm run cli -- -m ask -w ./my-project "what testing framework is used?"
```

## Build for Production

Build for your current platform:

```bash
npm run build
```

Or target a specific platform:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

Built output will be in the `dist/` folder.

## Architecture

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

### Desktop (Open Source)

The Electron app runs the full experience locally — file system access, integrated terminal, Git, AI chat, and all connector plugins via IPC.

### Cloud (Enterprise)

The Express server (`npm run server:dev`) exposes the same connector operations over REST. Layer on auth, RBAC, audit logging, and multi-tenancy for enterprise use.

### CLI

The command-line interface (`cli/index.ts`) lets you use mydev from the terminal — no Electron required. It reads your workspace, builds context, and talks to any OpenAI-compatible API.

## CLI

```
mydev [options] "your message"
echo "your message" | mydev [options]
```

### Modes

| Mode | Flag | Description |
|------|------|-------------|
| **ask** | `-m ask` | Answer questions about the codebase (default) |
| **agent** | `-m agent` | Plan and describe file changes with SEARCH/REPLACE blocks |
| **chat** | `-m chat` | General conversation — no workspace context |

### Options

| Flag | Description |
|------|-------------|
| `-m, --mode <mode>` | `ask`, `agent`, or `chat` (default: `ask`) |
| `-w, --workspace <path>` | Workspace directory (default: current directory) |
| `--model <name>` | Model to use (or set `MYDEV_MODEL` env var) |
| `--base-url <url>` | OpenAI-compatible API URL (or set `OPENAI_BASE_URL`) |
| `--api-key <key>` | API key (or set `OPENAI_API_KEY`) |
| `-s, --system <prompt>` | Custom system prompt |
| `--no-stream` | Wait for full response instead of streaming |
| `--list-models` | List available models and exit |
| `-o, --output <file>` | Write response to a file |
| `--verbose` | Show model, timing, and debug info |

### Examples

```bash
# Ask about a codebase
mydev "explain the auth flow"

# Agent mode — get code changes
mydev -m agent "add input validation to the signup form"

# Point at a different workspace
mydev -m ask -w ./my-project "what testing framework is used?"

# Use a specific model and API key
mydev --model gpt-4o --api-key sk-... "refactor the utils folder"

# Pipe input
echo "summarize this project" | mydev

# List available models
mydev --list-models

# Save response to a file
mydev -m agent -o changes.md "add dark mode support"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for the AI provider |
| `OPENAI_BASE_URL` | Base URL for the AI provider |
| `OLLAMA_BASE_URL` | Base URL for Ollama (fallback) |
| `MYDEV_MODEL` | Default model name |

### Global Install

```bash
npm run build:cli
npm link
# Now use "mydev" from anywhere:
mydev -w ~/projects/my-app "explain the auth flow"
```

## Project Structure

```
core/                        # Framework-agnostic core (shared by desktop & cloud)
  connector.ts               #   Connector interface, Registry, events
  backend-adapter.ts         #   BackendAdapter interface (IPC vs HTTP)

connectors/                  # Connector plugins
  index.ts                   #   Auto-registers all built-in connectors
  _template.connector.ts     #   Template — copy to create a new connector
  github.connector.ts        #   GitHub Actions, issues, repos
  atlassian.connector.ts     #   Atlassian / Jira projects & issues
  supabase.connector.ts      #   Supabase database, auth, storage

main/                        # Electron main process
  index.ts                   #   App entrypoint, window creation
  ipc.ts                     #   IPC handlers (file, git, AI, etc.)
  connectorIpc.ts            #   Connector Registry ↔ IPC bridge
  ai.ts                      #   AI chat (OpenAI-compatible, Ollama)
  atlassian.ts               #   Atlassian/Jira API
  github.ts                  #   GitHub API
  supabase.ts                #   Supabase API
  fileSystem.ts              #   File & directory operations
  terminal.ts                #   Integrated terminal (node-pty)
  chatHistory.ts             #   Conversation persistence
  prompts.ts                 #   Agent prompt settings
  debugWindow.ts             #   AI debug window

server/                      # Enterprise cloud server
  index.ts                   #   Express REST API entrypoint
  tsconfig.json              #   TypeScript config for server build

cli/                         # Command-line interface
  index.ts                   #   CLI entrypoint (no Electron dependency)
  tsconfig.json              #   TypeScript config for CLI build

renderer/                    # React frontend (Vite)
  src/
    App.tsx                  #   Root app component
    components/              #   UI components (chat, panels, editor, etc.)
    context/                 #   React context providers
    hooks/                   #   Custom hooks
    types/                   #   TypeScript type definitions
    utils/                   #   Utility functions

preload.js                   # Electron preload (contextIsolation bridge)
```

## Connector Plugin System

The connector system is the extensibility layer. Each integration (GitHub, Jira, Supabase, Slack, Linear, etc.) implements a standard `Connector` interface and registers itself with the `ConnectorRegistry`. The same connector works in both desktop and cloud mode with zero changes.

### Adding a New Connector (~5 minutes)

**Step 1:** Copy the template

```bash
cp connectors/_template.connector.ts connectors/linear.connector.ts
```

**Step 2:** Implement the interface

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

**Step 3:** Register it in `connectors/index.ts`

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
- **Desktop:** Electron IPC → `connector-list`, `connector-execute`, etc.
- **Cloud:** REST API → `GET /api/connectors`, `POST /api/connectors/linear/actions/list-issues`

### Built-in Connectors

| Connector | Category | Actions |
|-----------|----------|---------|
| **GitHub** | Source Control | Workflows, runs, jobs, logs, issues, rerun |
| **Atlassian / Jira** | Project Management | Projects, issues |
| **Supabase** | Database | Users, storage, tables, SQL queries |

## API Reference

### REST API (Cloud Mode)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/connectors` | List all connectors |
| `GET` | `/api/connectors/:id` | Get connector details (config fields, actions, state) |
| `POST` | `/api/connectors/:id/test` | Test connection with `{ config: { ... } }` |
| `POST` | `/api/connectors/:id/config` | Save config with `{ config: { ... } }` |
| `GET` | `/api/connectors/:id/config` | Load saved config |
| `POST` | `/api/connectors/:id/actions/:actionId` | Execute action with `{ params: { ... } }` |
| `POST` | `/api/ai/chat` | AI chat completion |
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

## Enterprise Cloud Features

The server version (`server/index.ts`) is designed to be extended with:

- **Authentication** — JWT / OAuth2 middleware
- **RBAC** — Role-based access to connectors and actions
- **Audit Logging** — Track all connector operations
- **Multi-tenancy** — Isolate configs per team / organization
- **AI Gateway** — Centralized AI routing with usage metering
- **SSE / WebSocket** — Real-time streaming for AI and live updates
- **Rate Limiting** — Per-user and per-connector throttling

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start desktop app (Electron + Vite dev server) |
| `npm run cli -- "msg"` | Run CLI directly via tsx |
| `npm run server` | Start enterprise cloud server |
| `npm run server:dev` | Start enterprise cloud server with hot-reload |
| `npm run build` | Build for current platform |
| `npm run build:cli` | Compile CLI to `dist-cli/` (for `npm link`) |
| `npm run build:mac` | Build macOS dmg (x64 + arm64) |
| `npm run build:win` | Build Windows installer |
| `npm run build:linux` | Build Linux AppImage |
| `npm run build:main` | Compile Electron main process TypeScript |

## License

MIT
