# renderer/src/types/

TypeScript type definitions for the renderer. Each domain has its own file; `index.ts` re-exports everything.

## Files

| File | Types |
|------|-------|
| `agent.types.ts` | `AgentConfig`, `AgentNode`, `AgentEdge`, `AgentTool`, `AgentParameters`, `DEFAULT_AGENT_PARAMETERS`, `AgentTrace`, `TraceStep`, `PhaseCategory` |
| `ai.types.ts` | `AISettings`, `ChatMessage`, `AIChatResult` |
| `atlassian.types.ts` | `AtlassianConnection`, `AtlassianProject`, `AtlassianIssue`, `AtlassianProjectsResult`, `AtlassianIssuesResult`, `AtlassianConnectionResult` |
| `electron.types.ts` | `ElectronAPI` interface (for `window.electronAPI` in preload) |
| `file.types.ts` | `TreeEntry`, `Tab`, `FolderResult`, `FileResult`, `SaveResult` |
| `git.types.ts` | `GitChange`, `GitFileChange`, `DiffResult`, `GitBranchInfo`, `GitOpResult` |
| `github.types.ts` | `GitHubWorkflow`, `GitHubWorkflowRun`, `GitHubJob`, `GitHubIssue`, `GitHubRepoInfo`, result types |
| `history.types.ts` | `Conversation`, `WorkspaceHistory`, `AppHistory` |
| `npm.types.ts` | `NpmProject` |
| `prompts.types.ts` | `PromptSettings`, `DEFAULT_PROMPTS` |
| `session.types.ts` | `ActiveSession` — tracks running AI sessions that persist across workspace switches and chat creation |
| `supabase.types.ts` | `SupabaseConfig`, `SupabaseUser`, `SupabaseBucket`, `SqlQueryResult`, result types |
| `ui.types.ts` | `SidePanel` (union of all sidebar panel names) |

## Agent Types (`agent.types.ts`)

The agent type system defines the data model for the visual agent builder, execution traces, and per-agent parameterization:

| Type | Description |
|------|-------------|
| `AgentConfig` | Full agent definition: nodes, edges, tools, and optional `parameters` override |
| `AgentNode` | A single pipeline phase node with prompt key, tools, enabled flag, position |
| `AgentEdge` | Connection between two nodes (source → target) |
| `AgentTool` | A tool available to a node (e.g. filesystem, git, search, terminal) |
| `AgentParameters` | All numeric limits and prompt templates that can be overridden per-agent |
| `DEFAULT_AGENT_PARAMETERS` | Sensible defaults matching the original hardcoded behavior |
| `AgentTrace` | A timestamped execution trace for one agent run |
| `TraceStep` | A single step within a trace (prompt, tool-call, parse, internal, etc.) |
| `PhaseCategory` | Union of pipeline phase categories (`'entry'`, `'research'`, `'planning'`, etc.) |

### `AgentParameters` fields

**Numeric limits:**
`maxResearchFiles`, `minResearchFiles`, `maxMergedContextFiles`, `maxTextSearchResults`, `maxTextSearchDisplay`, `maxSearchDiscoveredFiles`, `maxSearchQueries`, `maxFilePatterns`, `maxVerificationAttempts`, `maxActionPlanFiles`, `chatHistoryDepth`, `maxFileListDisplay`

**Prompt templates (with `{{placeholder}}` interpolation):**
`systemContextPrompt`, `researchAgentPrompt`, `searchDecisionPrompt`, `checkAgentPrompt`, `actionPlanPrompt`, `fileChangeCreatePrompt`, `fileChangeUpdatePrompt`, `verificationPrompt`

## Usage

```typescript
// Import specific types
import type { AISettings, ChatMessage } from '../types/ai.types';
import type { AgentConfig, AgentParameters } from '../types/agent.types';

// Or import everything via barrel
import type { AISettings, TreeEntry, GitChange, AgentConfig } from '../types';
```

## Relationship to backend types

The types here define the **shapes** that flow between the renderer and the backend. The `BackendAPI` interface (`backend/types.ts`) uses these types for its method signatures. The Electron preload bridge (`preload.js`) and the HTTP adapter (`backend/http-adapter.ts`) both produce/consume these same types.
