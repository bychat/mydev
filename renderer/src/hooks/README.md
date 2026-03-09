# renderer/src/hooks/

Custom React hooks extracted from components for reuse and testability.

## Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAISettings` | `useAISettings.ts` | Loads/saves AI provider settings and model list. Returns `settings`, `models`, `selectedModel`, `ready`, `settingsOpen`, `handleSettingsSaved`. |
| `useAgentConfigs` | `useAgentConfigs.ts` | Agent config CRUD — create, rename, duplicate, delete agent configs. Persisted to disk via the backend. Returns `agents`, `activeAgent`, `activeAgentId`, `setActiveAgentId`, and mutation methods. |
| `useAgentPipeline` | `useAgentPipeline.ts` | Agent pipeline orchestrator — runs the full research → classify → plan → execute → verify loop. Accepts `agentParams: AgentParameters` and threads them through all prompt builders and parsers, replacing all hardcoded limits. |
| `useAgentTrace` | `useAgentTrace.ts` | Execution trace management — `startTrace`, `addStep`, `updateStep`, `completeStep`, `failStep`, `finishTrace`. Produces `AgentTrace` objects for the trace viewer. |
| `useAttachedFiles` | `useAttachedFiles.ts` | Manages files attached to the chat composer — add, remove, drag & drop, file picker. Reads file content via `getBackend().readFile()`. |
| `useChatHistory` | `useChatHistory.ts` | Persists conversation messages to the backend. Handles create, select, delete, rename conversations. Auto-saves with debounce. |
| `useScrollToBottom` | `useScrollToBottom.ts` | Keeps a scrollable container pinned to the bottom (for chat messages). Returns `endRef` and `scrollToBottom()`. |
| `useDebounce` | `useDebounce.ts` | Returns a debounced version of a value. |
| `useKeyboardShortcut` | `useKeyboardShortcut.ts` | Registers a global keyboard shortcut with Cmd/Ctrl support. |
| `useOutsideClick` | `useOutsideClick.ts` | Fires a callback when a click occurs outside a referenced element. |

## Agent Pipeline (`useAgentPipeline`)

The agent pipeline hook is the core of the AI agent system. It accepts an `AgentParameters` object (from the active agent config) and uses it to control:

- **Research phase** — `maxResearchFiles`, `minResearchFiles` limit how many files the research agent picks
- **Search phase** — `maxSearchQueries`, `maxTextSearchResults`, `maxSearchDiscoveredFiles` control text search behavior
- **Planning phase** — `maxActionPlanFiles` limits the action plan size
- **Execution phase** — uses `fileChangeCreatePrompt` / `fileChangeUpdatePrompt` templates
- **Verification phase** — `maxVerificationAttempts` controls retry loops
- **All prompts** — template strings are interpolated with `{{placeholder}}` values

When parameters are not provided, `DEFAULT_AGENT_PARAMETERS` is used (backwards-compatible).

## Barrel export

`index.ts` re-exports all hooks for clean imports:

```typescript
import { useAISettings, useChatHistory, useScrollToBottom } from '../hooks';
```

## Backend access

Hooks that need backend access use either:
- `useBackend()` — when inside the React tree (e.g. `useChatHistory`)
- `getBackend()` — when the hook might be called before context is available (e.g. `useAISettings`, `useAttachedFiles`)
