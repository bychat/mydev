# renderer/src/backend/

Backend abstraction layer. Provides a single `BackendAPI` interface that the entire UI programs against. The correct implementation is chosen automatically at startup.

## Files

| File | Description |
|------|-------------|
| `types.ts` | `BackendAPI` interface — every method the UI can call |
| `electron-adapter.ts` | Implementation that wraps `window.electronAPI` (Electron IPC) |
| `http-adapter.ts` | Implementation that calls the Express REST API + WebSocket |
| `index.ts` | Auto-detect & singleton export (`getBackend()`, `getBackendMode()`) |

## How it works

```typescript
// index.ts — detection logic
export function getBackendMode(): BackendMode {
  return typeof window !== 'undefined' && window.electronAPI
    ? 'electron'
    : 'web';
}
```

- **Electron mode** — `electron-adapter.ts` delegates every call to `window.electronAPI.*` which goes through `preload.js` → `ipcRenderer.invoke()` → `main/ipc.ts`.
- **Web mode** — `http-adapter.ts` makes `fetch('/api/...')` calls for request/response operations and connects a WebSocket at `/ws` for streaming (AI chunks, terminal I/O).

## Usage

Components and hooks access the backend through `useBackend()`:

```tsx
import { useBackend } from '../context/BackendContext';

function MyComponent() {
  const backend = useBackend();
  const settings = await backend.aiLoadSettings();
}
```

For hooks that can't use React context (called outside the tree), use the raw singleton:

```typescript
import { getBackend } from '../backend';
const backend = getBackend();
```

## BackendAPI interface (summary)

| Category | Methods |
|----------|---------|
| Window | `newWindow`, `selectFolder`, `openFolder` |
| File System | `readFile`, `saveFile`, `createFile`, `createFolder`, `deleteFileOrFolder`, `renameFileOrFolder`, `refreshTree` |
| Git | `gitStatus`, `gitDiff`, `gitStage`, `gitCommit`, `gitPush`, `gitPull`, `gitCheckout`, `gitCreateBranch`, … |
| AI | `aiChat`, `aiChatStream`, `onAiChatChunk`, `aiChatAbort`, `aiLoadSettings`, `aiSaveSettings`, `aiCheckOllama`, `aiListModels` |
| Chat History | `historyLoad`, `historyCreateConversation`, `historyUpdateConversation`, `historyDeleteConversation`, … |
| Terminal | `terminalCreate`, `terminalInput`, `terminalResize`, `terminalKill`, `onTerminalData`, `onTerminalExit` |
| Integrations | `detectSupabase`, `supabaseGetUsers`, `githubListWorkflows`, `atlassianLoadConnections`, … |
| Prompts | `promptsLoad`, `promptsSave`, `promptsReset` |
| Shell | `shellOpenExternal` |

See `types.ts` for the full typed interface.
