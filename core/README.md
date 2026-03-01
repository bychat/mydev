# core/

Framework-agnostic shared modules used by **all three runtimes** — Desktop (Electron), Web (Express server), and CLI. Nothing in this directory imports Electron or browser APIs.

## Modules

### `connector.ts` — Plugin System

The extensibility layer. Defines the `Connector<TConfig>` interface that every integration implements, and the `ConnectorRegistry` singleton that manages them at runtime.

**Key exports:**

| Export | Description |
|--------|-------------|
| `Connector<T>` | Interface: `metadata`, `configFields`, `actions`, `testConnection()`, `executeAction()` |
| `ConnectorRegistry` | Singleton that registers, configures, and invokes connectors |
| `getConnectorRegistry()` | Returns the global registry instance |
| `ConnectorMetadata` | Type: id, name, description, icon, category, version |
| `ConnectorAction` | Type: id, name, description, input/output schemas |
| `ConnectorCategory` | Union: `'source-control'` \| `'project-management'` \| `'database'` \| … |

**Used by:** `connectors/`, `main/connectorIpc.ts`, `server/index.ts`

---

### `chat.ts` — Shared AI Chat Logic

Prompt builders, parsers, and SEARCH/REPLACE utilities shared between the desktop renderer, the CLI agent, and the server.

**Key exports:**

| Export | Description |
|--------|-------------|
| `ChatMessage` | Type: `{ role, content, displayText? }` |
| `FileActionPlan` | Type: `{ file, action, description }` |
| `buildSystemContext()` | Builds the system prompt with workspace file listing |
| `buildResearchPrompt()` | Creates the file-research agent prompt |
| `buildActionPlanPrompt()` | Creates the action-planner prompt |
| `buildFileChangePrompt()` | Creates the code-editor prompt per file |
| `buildVerifyPrompt()` | Creates the verification agent prompt |
| `parseSearchReplaceBlocks()` | Extracts `<<<<<<< SEARCH … >>>>>>> REPLACE` blocks |
| `applySearchReplaceBlocks()` | Applies SEARCH/REPLACE blocks to file content (with fuzzy fallback) |
| `stripMarkdownFences()` | Removes ` ``` ` wrappers from AI output |

**Used by:** `cli/index.ts`, `renderer/src/components/ChatPanel.tsx`, `renderer/src/utils/chatPrompts.ts`

---

### `dataDir.ts` — Shared Data Directory

Returns the user-data directory used for persisting settings, chat history, and prompt configs. All three runtimes resolve to the **same** path, so configuration is shared.

**Resolution order:**
1. `BYCHAT_DATA_DIR` environment variable (explicit override)
2. Electron's `app.getPath('userData')` (when running inside Electron)
3. Platform default: `~/Library/Application Support/bychat` (macOS)

**Used by:** `main/ai.ts`, `main/chatHistory.ts`, `main/prompts.ts`, `main/atlassian.ts`, `cli/index.ts`, `server/routes.ts`

---

### `backend-adapter.ts` — Backend Adapter Interface

Defines the abstract `BackendAdapter` interface used by the connector IPC bridge. This is an older abstraction — most new code uses the `renderer/src/backend/types.ts` `BackendAPI` interface instead.
