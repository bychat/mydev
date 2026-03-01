# renderer/

React + Vite frontend. The same codebase runs inside Electron (desktop) **and** in a browser (web mode). Components never call `window.electronAPI` directly — they go through the `useBackend()` hook which auto-selects the right transport.

## Entry points

| File | Description |
|------|-------------|
| `index.html` | HTML shell loaded by Vite / Electron |
| `src/main.tsx` | React root — wraps `<App>` with `<BackendProvider>` |
| `src/App.tsx` | Top-level layout: activity bar, sidebar, editor, chat panel, terminal |

## Key directories

| Directory | Description |
|-----------|-------------|
| [`src/backend/`](src/backend/README.md) | Backend abstraction layer (Electron IPC vs HTTP) |
| [`src/components/`](src/components/README.md) | All UI components |
| [`src/context/`](src/context/README.md) | React context providers |
| [`src/hooks/`](src/hooks/README.md) | Custom React hooks |
| [`src/types/`](src/types/README.md) | TypeScript type definitions |
| [`src/utils/`](src/utils/README.md) | Utility functions |
| `src/styles/` | Additional CSS (ui-components) |

## How the backend abstraction works

```
Component / Hook
  → useBackend()                   // from context/BackendContext.tsx
    → BackendAPI interface         // from backend/types.ts
      ├─ electron-adapter.ts       // window.electronAPI (IPC)
      └─ http-adapter.ts           // fetch() + WebSocket
```

Detection is automatic: if `window.electronAPI` exists → Electron mode, otherwise → web mode.

## Building

```bash
# Development (Vite dev server with HMR)
npm run dev:renderer

# Production build (outputs to renderer/dist/)
npx vite build
```

## Vite config

`vite.config.ts` (at project root) configures:
- React plugin
- `renderer/` as the Vite root
- `@/` alias → `renderer/src/`
- Dev proxy: `/api` → `localhost:3001`, `/ws` → `ws://localhost:3001`
