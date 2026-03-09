# renderer/src/utils/

Pure utility functions used across the renderer. No side effects, no backend calls — just data transformations.

## Files

| File | Description | Key exports |
|------|-------------|-------------|
| `chatPrompts.ts` | Prompt builder wrappers for the chat agent pipeline. Accepts `AgentParameters` and threads them to `core/chat.ts`. | `buildSystemContext`, `buildResearchPrompt`, `buildActionPlanPrompt`, `buildFileChangePrompt`, `buildVerifyPrompt`, `buildCheckAgentPrompt`, `buildSearchDecisionPrompt` |
| `searchReplace.ts` | SEARCH/REPLACE block parsing and application | `parseSearchReplaceBlocks`, `applySearchReplaceBlocks`, `stripMarkdownFences` |
| `diffUtils.ts` | Diff computation and formatting | `computeLineDiff`, `parseDiffString` |
| `fileIcons.ts` | Maps file extensions to emoji/icon strings | `getFileIcon('app.tsx')` → `'⚛️'` |
| `fileUtils.ts` | File path helpers | `getExtension`, `getFileName`, `isImageFile`, `isBinaryFile` |
| `arrayUtils.ts` | Generic array helpers | `groupBy`, `unique`, `sortBy` |

## Barrel export

`index.ts` re-exports key utilities:

```typescript
import { getFileIcon, computeLineDiff, stripMarkdownFences } from '../utils';
```

## Note on `chatPrompts.ts` vs `core/chat.ts`

`core/chat.ts` contains the **shared** prompt builders used by all three runtimes (desktop, CLI, server). `chatPrompts.ts` wraps those with renderer-specific logic (e.g. attaching open tab context, workspace file paths) and threads `AgentParameters` through for per-agent customization.

**Parameter flow:**
```
ChatPanel → useAgentPipeline(agentParams)
  → chatPrompts.buildResearchPrompt(..., params)
    → core/chat.ts buildResearchPrompt(..., promptParams)
      → interpolates {{placeholders}} from template
```

If you're adding a new prompt that needs to work in the CLI too, put it in `core/chat.ts` and accept a `PromptParameters` argument.
