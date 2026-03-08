# main/

Electron main-process modules. These run in Node.js with full system access and are invoked by the renderer process through `ipcMain` handlers defined in `ipc.ts`.

> **Important:** The same modules are also imported by `server/routes.ts` for the web/cloud mode. Keep them free of Electron-specific imports (use `core/dataDir.ts` instead of `app.getPath()`). The only files that import from `electron` are `index.ts`, `ipc.ts`, `connectorIpc.ts`, `terminal.ts`, and `debugWindow.ts`.

## Modules

| File | Description |
|------|-------------|
| **`index.ts`** | App entrypoint — creates `BrowserWindow`, registers IPC, builds menu |
| **`ipc.ts`** | Legacy IPC registration (still imports from `ipc/` barrel). See `ipc/` directory below |
| **`ai.ts`** | AI chat completion (OpenAI-compatible). `chatComplete`, `chatCompleteStream`, `loadSettings`, `saveSettings`, `checkOllama`, `listModels` |
| **`fileSystem.ts`** | File & Git operations — `readDirectoryTree`, `getGitChangedFiles`, `gitStage`, `gitCommit`, `gitPush`, `createFile`, `deleteFileOrFolder`, etc. |
| **`chatHistory.ts`** | Conversation persistence — `loadAppHistory`, `createConversation`, `updateConversation`, `getRecentWorkspaces` |
| **`prompts.ts`** | Agent prompt settings — `loadPrompts`, `savePrompts`, `resetPrompts` |
| **`terminal.ts`** | Integrated terminal via `node-pty` — `createTerminal`, `resizeTerminal`, `killTerminal` |
| **`github.ts`** | GitHub API — workflows, runs, jobs, logs, issues via `GITHUB_TOKEN` |
| **`atlassian.ts`** | Atlassian/Jira API — projects, issues via API token auth |
| **`supabase.ts`** | Supabase API — users, storage, tables, SQL execution |
| **`connectorIpc.ts`** | Connector Registry ↔ IPC bridge for the plugin system |
| **`debugWindow.ts`** | Opens a secondary window showing AI request/response logs |

## `ipc/` — Modular IPC Handlers

IPC handlers have been split into domain-specific modules. Each file exports a `registerXxxIpc()` function called at startup.

| File | Domain |
|------|--------|
| `ipc/index.ts` | Barrel — re-exports all registration functions |
| `ipc/ai.ipc.ts` | AI chat, settings, models, Ollama check |
| `ipc/fs.ipc.ts` | File system & Git operations |
| `ipc/history.ipc.ts` | Chat history & workspaces |
| `ipc/prompts.ipc.ts` | Agent prompt settings |
| `ipc/integrations.ipc.ts` | Supabase, GitHub, Atlassian integrations |
| `ipc/window.ipc.ts` | Window management (new window, folder select) |

## Data flow

```
Renderer (preload.js)
  → ipcRenderer.invoke('channel', ...args)
    → ipcMain.handle('channel', handler)
      → main/ai.ts | main/fileSystem.ts | main/chatHistory.ts | ...
        → result returned to renderer
```

## Settings & persistence

All persistent data is stored in `getUserDataDir()` (from `core/dataDir.ts`):

| File | Module |
|------|--------|
| `ai-settings.json` | `ai.ts` |
| `prompt-settings.json` | `prompts.ts` |
| `app-history.json` | `chatHistory.ts` |
| `atlassian-connections.json` | `atlassian.ts` |
| `connector-config-*.json` | `connectorIpc.ts` |
