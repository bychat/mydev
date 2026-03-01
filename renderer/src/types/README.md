# renderer/src/types/

TypeScript type definitions for the renderer. Each domain has its own file; `index.ts` re-exports everything.

## Files

| File | Types |
|------|-------|
| `ai.types.ts` | `AISettings`, `ChatMessage`, `AIChatResult` |
| `atlassian.types.ts` | `AtlassianConnection`, `AtlassianProject`, `AtlassianIssue`, `AtlassianProjectsResult`, `AtlassianIssuesResult`, `AtlassianConnectionResult` |
| `electron.types.ts` | `ElectronAPI` interface (for `window.electronAPI` in preload) |
| `file.types.ts` | `TreeEntry`, `Tab`, `FolderResult`, `FileResult`, `SaveResult` |
| `git.types.ts` | `GitChange`, `GitFileChange`, `DiffResult`, `GitBranchInfo`, `GitOpResult` |
| `github.types.ts` | `GitHubWorkflow`, `GitHubWorkflowRun`, `GitHubJob`, `GitHubIssue`, `GitHubRepoInfo`, result types |
| `history.types.ts` | `Conversation`, `WorkspaceHistory`, `AppHistory` |
| `npm.types.ts` | `NpmProject` |
| `prompts.types.ts` | `PromptSettings`, `DEFAULT_PROMPTS` |
| `supabase.types.ts` | `SupabaseConfig`, `SupabaseUser`, `SupabaseBucket`, `SqlQueryResult`, result types |
| `ui.types.ts` | `SidePanel` (union of all sidebar panel names) |

## Usage

```typescript
// Import specific types
import type { AISettings, ChatMessage } from '../types/ai.types';

// Or import everything via barrel
import type { AISettings, TreeEntry, GitChange } from '../types';
```

## Relationship to backend types

The types here define the **shapes** that flow between the renderer and the backend. The `BackendAPI` interface (`backend/types.ts`) uses these types for its method signatures. The Electron preload bridge (`preload.js`) and the HTTP adapter (`backend/http-adapter.ts`) both produce/consume these same types.
