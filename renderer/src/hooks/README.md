# renderer/src/hooks/

Custom React hooks extracted from components for reuse and testability.

## Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAISettings` | `useAISettings.ts` | Loads/saves AI provider settings and model list. Returns `settings`, `models`, `selectedModel`, `ready`, `settingsOpen`, `handleSettingsSaved`. |
| `useAttachedFiles` | `useAttachedFiles.ts` | Manages files attached to the chat composer — add, remove, drag & drop, file picker. Reads file content via `getBackend().readFile()`. |
| `useChatHistory` | `useChatHistory.ts` | Persists conversation messages to the backend. Handles create, select, delete, rename conversations. Auto-saves with debounce. |
| `useScrollToBottom` | `useScrollToBottom.ts` | Keeps a scrollable container pinned to the bottom (for chat messages). Returns `endRef` and `scrollToBottom()`. |
| `useDebounce` | `useDebounce.ts` | Returns a debounced version of a value. |
| `useKeyboardShortcut` | `useKeyboardShortcut.ts` | Registers a global keyboard shortcut with Cmd/Ctrl support. |
| `useOutsideClick` | `useOutsideClick.ts` | Fires a callback when a click occurs outside a referenced element. |

## Barrel export

`index.ts` re-exports all hooks for clean imports:

```typescript
import { useAISettings, useChatHistory, useScrollToBottom } from '../hooks';
```

## Backend access

Hooks that need backend access use either:
- `useBackend()` — when inside the React tree (e.g. `useChatHistory`)
- `getBackend()` — when the hook might be called before context is available (e.g. `useAISettings`, `useAttachedFiles`)
