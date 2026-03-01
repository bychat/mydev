# server/

Express + WebSocket server for web/cloud mode. Exposes the **same** operations as the Electron IPC layer, so the React frontend works identically in both modes.

## Files

| File | Description |
|------|-------------|
| `index.ts` | App entrypoint — Express app, WebSocket server, static SPA serving, connector REST API |
| `routes.ts` | All `/api/*` REST endpoints — delegates to `main/` modules |
| `tsconfig.json` | TypeScript config (not used at runtime — server runs via `tsx`) |

## Running

```bash
# Development (hot-reload)
npm run server:dev       # API only
npm run web              # API + Vite UI (recommended)

# Production
npm run web:prod         # Builds UI, then serves everything from Express
```

## Architecture

```
┌──────────────┐
│  Express App │
├──────────────┤
│  Middleware   │  cors, JSON body parser, request logging
├──────────────┤
│  /api/*      │  REST routes (routes.ts) → main/ modules
├──────────────┤
│  /ws         │  WebSocket server (terminal I/O, AI streaming)
├──────────────┤
│  /*          │  Static SPA (renderer/dist/) + fallback to index.html
├──────────────┤
│  Connectors  │  /api/connectors/* (connector plugin REST API)
└──────────────┘
```

## REST API

All routes are defined in `routes.ts` and mounted at `/api`. They mirror the Electron IPC handlers 1:1:

### File System
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fs/open-folder` | Open a folder, return tree + git info |
| POST | `/api/fs/read-file` | Read file contents |
| POST | `/api/fs/save-file` | Write file contents |
| POST | `/api/fs/create-file` | Create a new file |
| POST | `/api/fs/create-folder` | Create a new directory |
| POST | `/api/fs/delete` | Delete a file or folder |
| POST | `/api/fs/rename` | Rename/move a file or folder |
| POST | `/api/fs/refresh-tree` | Re-read the directory tree |

### Git
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/git/status` | Changed files list |
| POST | `/api/git/status-split` | Staged / unstaged split |
| POST | `/api/git/diff` | Diff for a single file |
| POST | `/api/git/stage` | Stage a file |
| POST | `/api/git/unstage` | Unstage a file |
| POST | `/api/git/stage-all` | Stage all changes |
| POST | `/api/git/unstage-all` | Unstage all |
| POST | `/api/git/discard` | Discard file changes |
| POST | `/api/git/commit` | Commit staged changes |
| POST | `/api/git/branch-info` | Current branch, ahead/behind |
| POST | `/api/git/list-branches` | All local branches |
| POST | `/api/git/checkout` | Switch branch |
| POST | `/api/git/create-branch` | Create + checkout new branch |
| POST | `/api/git/pull` | Git pull |
| POST | `/api/git/push` | Git push |

### AI
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/check-ollama` | Check if Ollama is running |
| POST | `/api/ai/list-models` | List available models |
| POST | `/api/ai/chat` | Non-streaming chat completion |
| POST | `/api/ai/abort` | Abort in-flight request |
| GET | `/api/ai/settings` | Load AI provider settings |
| POST | `/api/ai/settings` | Save AI provider settings |

### Prompts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prompts` | Load prompt settings |
| POST | `/api/prompts` | Save prompt settings |
| POST | `/api/prompts/reset` | Reset prompts to defaults |

### Chat History
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/history` | Full app history |
| GET | `/api/history/recent-workspaces` | Recent workspaces (with `?limit=N`) |
| POST | `/api/history/open-workspace` | Get or create workspace entry |
| POST | `/api/history/remove-workspace` | Remove a workspace |
| POST | `/api/history/conversation/*` | Create, get, update, delete, rename conversations |

### Integrations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/supabase/detect` | Detect Supabase config in workspace |
| POST | `/api/supabase/users` | Fetch Supabase users |
| POST | `/api/supabase/storage` | Fetch storage buckets |
| POST | `/api/supabase/tables` | Fetch database tables |
| POST | `/api/supabase/query` | Execute SQL query |
| POST | `/api/github/extract-repo-info` | Parse owner/repo from remote URL |
| GET | `/api/github/:owner/:repo/workflows` | List GitHub Actions workflows |
| GET | `/api/github/:owner/:repo/runs` | List workflow runs |
| GET | `/api/github/:owner/:repo/issues` | List issues |
| GET | `/api/atlassian/connections` | Load saved Jira connections |
| POST | `/api/atlassian/connections` | Save Jira connections |
| POST | `/api/atlassian/projects` | Fetch Jira projects |
| POST | `/api/atlassian/issues` | Fetch Jira issues |

## WebSocket

The WebSocket server listens at `/ws` and handles:

| Event | Direction | Description |
|-------|-----------|-------------|
| `terminal-input` | client → server | Send keystrokes to a terminal |
| `terminal-resize` | client → server | Resize a terminal |
| `terminal-data` | server → client | Terminal output |
| `terminal-exit` | server → client | Terminal process exited |
| `ai-chat-stream` | client → server | Start streaming AI chat |
| `ai-chat-chunk` | server → client | Streamed AI response chunk |
| `ai-chat-chunk-done` | server → client | Stream complete |

## Integration tests

```bash
npm run test:server   # runs scripts/test-server.sh (21 endpoint checks)
```
