# bychat — Roadmap & What's Needed to Ship

> Last updated: March 2026

This document outlines what needs to happen to make bychat production-ready across all three runtimes (Desktop, Web/Cloud, CLI).

---

## 🟢 Done (solid foundation)

- [x] Electron desktop app with full IPC bridge
- [x] React frontend with VS Code-style IDE layout
- [x] Backend abstraction layer (Electron IPC ↔ HTTP auto-detect)
- [x] AI chat with streaming (OpenAI-compatible + Ollama)
- [x] Multi-step AI agent (research → plan → SEARCH/REPLACE → verify)
- [x] Connector plugin system (GitHub, Jira, Supabase)
- [x] Integrated terminal (node-pty)
- [x] Git operations (stage, commit, diff, branch, push, pull)
- [x] File explorer with create/rename/delete
- [x] Chat history & conversation persistence
- [x] Customizable agent prompts
- [x] CLI with ask, agent, and chat modes
- [x] Express + WebSocket cloud server
- [x] Docker support for CLI
- [x] Cross-platform builds (macOS, Windows, Linux)
- [x] Comprehensive README documentation (15+ files)
- [x] **Visual agent builder** — node-based pipeline editor with per-node tools, custom prompts, and edges
- [x] **Execution trace viewer** — timestamped step-by-step trace with input/output, token counts, and status
- [x] **Per-agent parameterization** — all hardcoded numbers and prompt templates editable per-agent via ⚙ Parameters modal
- [x] **Agent config CRUD** — create, rename, duplicate, delete agent configs (persisted to disk)
- [x] **Parameterizable prompt builders** — `core/chat.ts` prompt builders accept `PromptParameters` and interpolate templates

---

## 🔴 Critical — Must Have Before v1.0

### 1. Testing

| Item | Details |
|------|---------|
| **Unit tests** | No test framework configured yet. Add Vitest (already using Vite) for `core/`, `connectors/`, `main/`, and renderer utils. |
| **Component tests** | Use React Testing Library for critical components (`ChatPanel`, `FileTree`, `Editor`, `SourceControlPanel`). |
| **Integration tests** | Expand `test-server.sh` into a proper test suite (e.g. Vitest or Jest with Supertest for server routes). |
| **E2E tests** | Add Playwright or Spectron tests for the Electron app — at minimum: open folder, edit file, git commit, AI chat flow. |
| **CI pipeline** | Set up GitHub Actions to run lint + tests on every PR. |

### 2. Authentication & Security (Cloud Mode)

| Item | Details |
|------|---------|
| **Auth middleware** | JWT or OAuth2 authentication for the Express server. Currently the API is completely open. |
| **API key management** | Encrypt stored API keys at rest (AI provider keys, connector tokens). Currently stored as plain JSON. |
| **CORS lockdown** | Production CORS configuration (currently permissive). |
| **Rate limiting** | Per-user / per-IP rate limiting on AI and connector endpoints. |
| **Input validation** | Add Zod or Joi schema validation on all REST endpoints — no request body is validated today. |
| **CSP headers** | Content Security Policy headers for the Electron renderer and web mode. |

### 3. Error Handling & Resilience

| Item | Details |
|------|---------|
| **Global error boundaries** | Add React error boundaries around major panels so a crash in one panel doesn't take down the whole app. |
| **AI failure recovery** | Graceful handling of API timeouts, rate limits (429), invalid keys, and network failures during agent loops. |
| **Retry logic** | Exponential backoff for connector API calls (GitHub, Jira, Supabase). |
| **Offline mode** | Desktop app should work gracefully without internet — disable AI/connector features, keep local file/git operations. |

### 4. Code Quality & Linting

| Item | Details |
|------|---------|
| **ESLint** | Add ESLint config with TypeScript and React rules. |
| **Prettier** | Add Prettier for consistent formatting. |
| **Pre-commit hooks** | Husky + lint-staged for automated checks. |
| **Strict TypeScript** | Enable `strict: true` across all tsconfig files. Audit and fix `any` usage. |

---

## 🟡 Important — Should Have for v1.0

### 5. Performance

| Item | Details |
|------|---------|
| **Large workspace handling** | File tree loading is synchronous and recursive. Add lazy loading / virtual scrolling for workspaces with 10k+ files. |
| **AI streaming memory** | Long agent sessions can accumulate large message arrays. Add message windowing or summarization. |
| **Bundle size** | Audit the Vite build — tree-shake unused icons, lazy-load heavy panels (SQL results, diff viewer). |
| **Electron startup time** | Profile and optimize cold start. Defer connector registration and chat history loading. |

### 6. User Experience

| Item | Details |
|------|---------|
| **Keyboard shortcuts** | Comprehensive keyboard shortcut system (Cmd+P for file search, Cmd+Shift+P for command palette, etc.). |
| **Command palette** | VS Code-style command palette for quick access to all actions. |
| **Theming** | Dark/light theme toggle. Currently hardcoded dark theme. |
| **Responsive layout** | Panel resizing, collapsible sidebar, mobile-friendly web mode. |
| **Drag & drop** | Drag files between explorer and editor, drag tabs to reorder. |
| **Multi-cursor / multi-tab** | Better editor experience — syntax highlighting, bracket matching, minimap. Consider integrating Monaco Editor. |
| **Notifications** | Toast notification system for success/error messages instead of silent failures. |
| **Onboarding** | First-run wizard: select AI provider, enter API key, choose default model. |

### 7. AI Features

| Item | Details |
|------|---------|
| **Context window management** | Token counting and smart truncation. Large codebases can blow past context limits. |
| **Multi-model support** | Let users pick different models for different tasks (fast model for chat, strong model for agent). |
| **RAG / embeddings** | Vector-based code search for better context retrieval on large repos. |
| **Tool calling** | Support OpenAI function/tool calling for structured agent actions. |
| **Image support** | Multi-modal input — paste screenshots for UI bug reports. |
| **Agent memory** | Persistent memory across conversations (project conventions, user preferences). |
| ~~**Agent builder**~~ | ✅ Done — visual node editor, per-agent parameters, trace viewer. |
| **Agent node reordering** | Drag-and-drop reordering of pipeline phases in the visual editor. |
| **Agent export/import** | Share agent configs as JSON files between users or teams. |

### 8. Connector Ecosystem

| Item | Details |
|------|---------|
| **More connectors** | Linear, Slack, Notion, GitLab, Bitbucket, PagerDuty, Datadog, Vercel, AWS. |
| **Connector marketplace** | Let users install third-party connectors (npm packages or local files). |
| **Webhook support** | Connectors should be able to receive webhooks (e.g. GitHub push events, Jira issue updates). |
| **OAuth flows** | Proper OAuth2 flows for connectors instead of manual API key entry. |
| **Connector health checks** | Periodic background connection testing with status indicators. |

---

## 🔵 Nice to Have — Post v1.0

### 9. Collaboration

| Item | Details |
|------|---------|
| **Multi-user** | Shared workspaces with real-time cursor presence (CRDT or OT). |
| **Team chat** | Shared AI conversations visible to the whole team. |
| **Code review** | Built-in PR review with AI-powered suggestions. |
| **Audit log** | Enterprise audit trail for all AI interactions and file changes. |

### 10. Platform & Distribution

| Item | Details |
|------|---------|
| **Auto-updates** | Electron auto-updater (electron-updater) with release channels (stable, beta). |
| **Code signing** | macOS notarization, Windows Authenticode signing. |
| **Snap / Flatpak** | Linux package manager distribution. |
| **Homebrew formula** | `brew install bychat` for the CLI. |
| **npm publish** | Publish CLI to npm registry. |
| **VS Code extension** | Lightweight extension that integrates bychat AI into VS Code directly. |

### 11. Monitoring & Observability

| Item | Details |
|------|---------|
| **Logging** | Structured logging (pino/winston) for the server with log levels. |
| **Error tracking** | Sentry or similar for crash reporting in desktop + server. |
| **Analytics** | Opt-in usage analytics (feature usage, AI model popularity). |
| **Health dashboard** | Admin dashboard for cloud deployment showing connected users, AI usage, connector status. |

### 12. Documentation Improvements

| Item | Details |
|------|---------|
| **API docs site** | Auto-generated OpenAPI / Swagger docs from route definitions. |
| **Developer guide** | Step-by-step guide for new contributors (setup, architecture deep-dive, PR process). |
| **Connector authoring guide** | Expanded guide with real-world examples, testing patterns, and best practices. |
| **Video walkthroughs** | Short videos showing key workflows (agent mode, connector setup, cloud deployment). |
| **Changelog** | Maintain a `CHANGELOG.md` with semantic versioning. |

---

## 📅 Suggested Milestone Plan

### Milestone 0.5 — Agent Extensibility ✅
> _Completed_

- [x] Visual agent builder (node-based pipeline editor)
- [x] Per-agent parameters (all numeric limits + prompt templates editable)
- [x] Execution trace viewer (timestamped steps, input/output, status)
- [x] Agent config CRUD (create, rename, duplicate, delete, persist to disk)
- [x] Parameterizable prompt builders in `core/chat.ts`
- [x] Parameters editor modal with reset-to-default and diff-only persistence

### Milestone 1 — Stability (v0.9)
> _~4 weeks_

- [ ] Add Vitest + basic unit tests for `core/` and `connectors/`
- [ ] ESLint + Prettier + Husky setup
- [ ] React error boundaries
- [ ] Input validation on all REST endpoints (Zod)
- [ ] AI error recovery (timeouts, rate limits)
- [ ] Global toast notification system
- [ ] `CHANGELOG.md`

### Milestone 2 — Security (v0.95)
> _~3 weeks_

- [ ] JWT auth for cloud mode
- [ ] Encrypted credential storage
- [ ] CORS + CSP headers
- [ ] Rate limiting
- [ ] Component tests for critical UI flows

### Milestone 3 — Polish (v1.0-rc)
> _~4 weeks_

- [ ] Keyboard shortcuts + command palette
- [ ] Dark / light theme toggle
- [ ] Onboarding wizard
- [ ] Token counting + context management
- [ ] Large workspace lazy loading
- [ ] E2E tests (Playwright)
- [ ] CI pipeline (GitHub Actions)

### Milestone 4 — Launch (v1.0)
> _~2 weeks_

- [ ] Auto-updater
- [ ] Code signing (macOS + Windows)
- [ ] npm publish for CLI
- [ ] OpenAPI docs
- [ ] Landing page + announcement

---

## 🤝 Contributing

If you'd like to pick up any of these items, please:
1. Check if there's an existing issue for it
2. Open a new issue if not, referencing this roadmap
3. Submit a PR against `main`

---

_This roadmap is a living document. Priorities may shift based on user feedback and community contributions._
