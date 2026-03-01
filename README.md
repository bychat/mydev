# bychat

An open-source AI-powered developer workspace — runs as an Electron desktop app, a CLI, or an enterprise cloud server. The core app for [bychat.io](https://bychat.io).

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

## Getting Started

Install dependencies:

```bash
npm install
```

### Desktop App (Electron)

```bash
npm run dev
```

### Web App

```bash
npm run web
# → UI at http://localhost:5173, API at http://localhost:3001
```

### CLI

```bash
# Ask a question about the current directory
npm run ask -- "explain the auth flow"

# Agent mode — plan & apply code changes
npm run agent -- "add input validation to the signup form"

# General chat (no workspace context)
npm run chat -- "explain the difference between REST and GraphQL"

# Point at a different workspace
npm run ask -- -w ./my-project "what testing framework is used?"
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

The command-line interface (`cli/index.ts`) lets you use bychat from the terminal — no Electron required. It reads your workspace, builds context, and talks to any OpenAI-compatible API.

## CLI

```
bychat <command> [options] "your message"
echo "your message" | bychat agent [options]
```

### Commands

| Command | Description |
|---------|-------------|
| **ask** | Answer questions about the codebase (default) |
| **agent** | Plan and describe file changes with SEARCH/REPLACE blocks |
| **chat** | General conversation — no workspace context |

### Options

| Flag | Description |
|------|-------------|
| `-w, --workspace <path>` | Workspace directory (default: current directory) |
| `--model <name>` | Model to use (or set `BYCHAT_MODEL` env var) |
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
bychat ask "explain the auth flow"

# Agent mode — get code changes
bychat agent "add input validation to the signup form"

# Point at a different workspace
bychat ask -w ./my-project "what testing framework is used?"

# Use a specific model and API key
bychat ask --model gpt-4o --api-key sk-... "refactor the utils folder"

# Pipe input
echo "summarize this project" | bychat agent

# List available models
bychat --list-models

# Save response to a file
bychat agent -o changes.md "add dark mode support"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for the AI provider |
| `OPENAI_BASE_URL` | Base URL for the AI provider |
| `OLLAMA_BASE_URL` | Base URL for Ollama (fallback) |
| `BYCHAT_MODEL` | Default model name |

### Global Install

```bash
npm run build:cli
npm link
# Now use "bychat" from anywhere:
bychat ask -w ~/projects/my-app "explain the auth flow"
```

## Docker

Build the CLI Docker image:

```bash
npm run docker:build
# or: docker build -t bychat .
```

### Mount your workspace at runtime

```bash
docker run --rm -it \
  -e OPENAI_API_KEY="sk-..." \
  -e OPENAI_BASE_URL="https://api.openai.com/v1" \
  -v $(pwd):/workspace \
  bychat agent -w /workspace "add input validation"
```

### Embed a workspace into the image

```bash
docker build -t bychat-project --build-arg EMBED_WORKSPACE=./my-project .
docker run --rm -it \
  -e OPENAI_API_KEY="sk-..." \
  bychat-project agent -w /workspace "add tests"
```

### Persist data between runs

```bash
docker run --rm -it \
  -v bychat-data:/data \
  -v $(pwd):/workspace \
  -e OPENAI_API_KEY="sk-..." \
  bychat agent -w /workspace "refactor utils"
```

## Project Structure

Each major directory has its own `README.md` with detailed docs:

| Directory | README | Description |
|-----------|--------|-------------|
| [`core/`](core/README.md) | ✅ | Framework-agnostic shared modules (connector system, chat logic, data dir) |
| [`connectors/`](connectors/README.md) | ✅ | Connector plugins (GitHub, Jira, Supabase) |
| [`main/`](main/README.md) | ✅ | Electron main process (IPC handlers, AI, git, terminal) |
| [`server/`](server/README.md) | ✅ | Express + WebSocket cloud server |
| [`cli/`](cli/README.md) | ✅ | Command-line interface |
| [`renderer/`](renderer/README.md) | ✅ | React frontend (Vite) |
| [`renderer/src/backend/`](renderer/src/backend/README.md) | ✅ | Backend abstraction layer (Electron IPC vs HTTP) |
| [`renderer/src/components/`](renderer/src/components/README.md) | ✅ | UI components |
| [`renderer/src/context/`](renderer/src/context/README.md) | ✅ | React context providers |
| [`renderer/src/hooks/`](renderer/src/hooks/README.md) | ✅ | Custom React hooks |
| [`renderer/src/types/`](renderer/src/types/README.md) | ✅ | TypeScript type definitions |
| [`renderer/src/utils/`](renderer/src/utils/README.md) | ✅ | Utility functions |

```
core/                        # Framework-agnostic core (shared by desktop, CLI & cloud)
  connector.ts               #   Connector interface, Registry, events
  backend-adapter.ts         #   BackendAdapter interface (IPC vs HTTP)
  chat.ts                    #   Shared prompt builders, SEARCH/REPLACE utils, types
  dataDir.ts                 #   Shared user-data directory resolver

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
  index.ts                   #   Express + WebSocket entrypoint
  routes.ts                  #   REST API routes (mirrors Electron IPC 1:1)

cli/                         # Command-line interface
  index.ts                   #   CLI entrypoint (no Electron dependency)
  tsconfig.json              #   TypeScript config for CLI build

scripts/                     # Development & CI scripts
  test-server.sh             #   Server integration tests

renderer/                    # React frontend (Vite)
  src/
    App.tsx                  #   Root app component
    main.tsx                 #   Entry — wraps App with BackendProvider
    backend/                 #   Backend abstraction layer
      types.ts               #     BackendAPI interface
      electron-adapter.ts    #     Electron IPC adapter
      http-adapter.ts        #     HTTP/WS adapter (web mode)
      index.ts               #     Auto-detect & singleton export
    components/              #   UI components (chat, panels, editor, etc.)
    context/                 #   React context providers
      BackendContext.tsx      #     useBackend() hook — all components use this
      WorkspaceContext.tsx    #     Workspace state (file tree, git, etc.)
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

### REST API (Cloud / Web Mode)

All routes are mounted at `/api`. See [`server/README.md`](server/README.md) for the complete endpoint table.

| Category | Endpoints | Description |
|----------|-----------|-------------|
| File System | `/api/fs/*` | Open folder, read/write files, create, delete, rename |
| Git | `/api/git/*` | Status, diff, stage, commit, branch, push, pull |
| AI | `/api/ai/*` | Chat completion, model listing, settings |
| Prompts | `/api/prompts` | Load, save, reset agent prompts |
| Chat History | `/api/history/*` | Workspaces, conversations CRUD |
| Supabase | `/api/supabase/*` | Users, storage, tables, SQL queries |
| GitHub | `/api/github/*` | Workflows, runs, jobs, logs, issues |
| Atlassian | `/api/atlassian/*` | Connections, projects, issues |
| Connectors | `/api/connectors/*` | Generic connector plugin CRUD & execute |
| Health | `/api/health` | Status, uptime, connector count |

### WebSocket (Cloud / Web Mode)

WebSocket endpoint: `ws://localhost:3001/ws`

| Event | Direction | Description |
|-------|-----------|-------------|
| `ai-chat-stream` | client → server | Start streaming AI response |
| `ai-chat-chunk` | server → client | Individual AI response token |
| `ai-chat-chunk-done` | server → client | Stream complete |
| `terminal-input` | client → server | Send keystrokes to PTY |
| `terminal-data` | server → client | Terminal output |
| `terminal-exit` | server → client | Terminal process exited |

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

### Run

| Script | Description |
|--------|-------------|
| `npm run dev` | Desktop app (Electron + Vite) |
| `npm run web` | Web app (Vite + Express, hot-reload) |
| `npm run web:prod` | Web app (production build, single server) |
| `npm run ask -- "msg"` | CLI — ask about the codebase |
| `npm run agent -- "msg"` | CLI — agent mode (plans & applies changes) |
| `npm run chat -- "msg"` | CLI — general chat (no workspace) |

### Build

| Script | Description |
|--------|-------------|
| `npm run build` | Desktop app for current platform |
| `npm run build:main` | Compile Electron main process TS |
| `npm run build:cli` | Compile CLI to `dist-cli/` (for `npm link`) |
| `npm run build:mac` | macOS dmg (x64 + arm64) |
| `npm run build:win` | Windows installer |
| `npm run build:linux` | Linux AppImage |

### Other

| Script | Description |
|--------|-------------|
| `npm run server` | Express API only (no UI) |
| `npm run server:dev` | Express API with hot-reload |
| `npm run test:server` | Integration tests (21 endpoints) |

## Web Mode

The same React UI runs in a browser with no Electron required. In web mode the frontend talks to the Express server over REST + WebSocket instead of IPC.

```bash
# Development (hot-reload on both UI and API)
npm run web
# → UI: http://localhost:5173   API: http://localhost:3001

# Production (pre-built UI served by Express)
npm run web:prod
# → http://localhost:3001
```

### Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `PORT` | Server port (default: `3001`) |
| `BYCHAT_DATA_DIR` | Override the data directory (shared between desktop/CLI/server) |

## License

MIT

---

Made with ❤️ by [bychat.io](https://bychat.io)