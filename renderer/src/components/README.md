# renderer/src/components/

All React UI components. The app is structured as a VS Code-style IDE layout:

```
┌───────┬──────────┬──────────────────────────┬─────────────┐
│       │          │                          │             │
│  Act. │ Sidebar  │     Editor Area          │  Chat Panel │
│  Bar  │          │     (tabs + content)     │             │
│       │          │                          │             │
│       │          ├──────────────────────────┤             │
│       │          │     Terminal Panel       │             │
│       │          │                          │             │
├───────┴──────────┴──────────────────────────┴─────────────┤
│                       Status Bar                          │
└───────────────────────────────────────────────────────────┘
```

## Layout Components

| Component | Description |
|-----------|-------------|
| `ActivityBar.tsx` | Left-most icon rail — switches sidebar panels, new window, prompt settings, debug |
| `Sidebar.tsx` | Renders the active side panel (explorer, search, source control, etc.) |
| `Editor.tsx` | Tab-based editor area — renders file content, diffs, SQL results, Supabase tabs |
| `EditorTabs.tsx` | Horizontal tab bar with close, modified indicator, context menu |
| `StatusBar.tsx` | Bottom bar — git branch, file count, connection status |
| `Welcome.tsx` | Shown when no folder is open — import button + recent workspaces |

## Side Panels

| Component | Panel | Description |
|-----------|-------|-------------|
| `FileTree.tsx` | Explorer | Recursive file/folder tree with create, rename, delete |
| `SearchPanel.tsx` | Search | Workspace-wide text search with file filters |
| `SourceControlPanel.tsx` | Source Control | Git staged/unstaged files, commit, branch, push/pull |
| `NpmPanel.tsx` | NPM | Lists `package.json` scripts across all workspace projects |
| `SupabasePanel.tsx` | Supabase | Supabase project info, quick links to dashboard sections |
| `DatabasePanel.tsx` | Database | Database tables, SQL query input, Supabase auto-detection |
| `GitHubActionsTab.tsx` | GitHub | Workflows, runs, jobs, logs, issues |
| `AtlassianPanel.tsx` | Atlassian | Jira connections, projects, issues |
| `AgentsPanel.tsx` | Agents | Visual agent builder — node editor, per-agent parameters, trace viewer, ParametersEditorModal |

## Editor Tabs (special)

| Component | Description |
|-----------|-------------|
| `DiffViewer.tsx` | Side-by-side diff viewer for git changes |
| `SqlQueryResultTab.tsx` | SQL query results in a table view |
| `SupabaseStorageTab.tsx` | Supabase storage buckets browser |
| `SupabaseUsersTab.tsx` | Supabase users list |
| `GitHubLogsViewer.tsx` | GitHub Actions job log viewer |
| `Markdown.tsx` | Markdown renderer with syntax highlighting and clickable file references |

## Chat

| Component | Description |
|-----------|-------------|
| `ChatPanel.tsx` | Main chat orchestrator — mode selection, AI agent loop (with per-agent parameters), streaming |
| `ChatHistorySidebar.tsx` | Conversation history list with rename, delete |
| `PromptSettingsModal.tsx` | Edit agent prompts (system, research, planner, editor, verify) |
| `SettingsModal.tsx` | AI provider settings (Ollama/OpenAI, model, API key) |

### `chat/` subdirectory

| Component | Description |
|-----------|-------------|
| `ChatHeader.tsx` | Mode selector, history toggle, settings buttons |
| `ChatMessages.tsx` | Message list with markdown rendering |
| `ChatComposer.tsx` | Input textarea with file attachment, drag & drop |
| `ChatWelcome.tsx` | Empty-state with suggested prompts |
| `AgentActionRow.tsx` | Shows agent progress (research → plan → edit → verify) |

## Agent Builder

| Component / Section | Description |
|---------------------|-------------|
| `AgentsPanel.tsx` | Full agent builder UI: agent list, visual node editor, tool selectors, prompt editing, trace viewer |
| `ParametersEditorModal` | Modal for editing all numeric limits and prompt templates per-agent, with reset-to-default and diff-only persistence |
| ⚙ Parameters button | Shows count of modified parameters, opens the editor modal |

## Reusable UI

### `ui/` subdirectory

Generic, design-system-level components:

| Component | Description |
|-----------|-------------|
| `Badge.tsx` | Small label/counter badge |
| `Button.tsx` | Styled button with variants |
| `Dropdown.tsx` | Dropdown menu |
| `FileChip.tsx` | File attachment chip with remove button |
| `IconButton.tsx` | Icon-only button |
| `Input.tsx` | Styled text input |
| `Modal.tsx` | Modal dialog overlay |
| `Spinner.tsx` | Loading spinner |
| `Tabs.tsx` | Tab switcher |
| `TextArea.tsx` | Styled textarea |

### `icons/` subdirectory

SVG icon components for the UI (explorer, search, git, refresh, chevrons, etc.).

## Conventions

- Every component accesses the backend via `useBackend()` — never `window.electronAPI`
- Workspace state is accessed via `useWorkspace()` from `context/WorkspaceContext.tsx`
- Components are function components with hooks
- No CSS-in-JS — styles are in `app.css` and `styles/ui-components.css`
