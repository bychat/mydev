# cli/

Command-line interface for bychat. No Electron required — runs in any Node.js ≥ 18 environment and shares the same AI settings, prompts, and models configured in the desktop app.

## Usage

```bash
# Via npm scripts (recommended during development)
npm run ask   -- "explain the auth flow"
npm run agent -- "add input validation to the signup form"
npm run chat  -- "what is the difference between REST and GraphQL"

# Via globally-installed binary
bychat ask "explain the auth flow"
bychat agent "add dark mode support"
bychat agent -w ./other-project "refactor the utils folder"
echo "summarize this project" | bychat agent
```

## Commands

| Command | Description |
|---------|-------------|
| **ask** | Answers questions about the codebase with full workspace context (default) |
| **agent** | Multi-step agent: research → plan → SEARCH/REPLACE edits → verify |
| **chat** | General conversation — no workspace scanning |

## How It Works

### Ask mode
1. Scans the workspace directory tree
2. Builds a system prompt with file listing + relevant file contents
3. Streams the AI response to stdout

### Agent mode
1. **Research** — asks the AI which files are relevant
2. **Check** — determines if file changes are needed
3. **Plan** — creates a list of files to create/update/delete
4. **Edit** — generates SEARCH/REPLACE blocks for each file
5. **Verify** — confirms the changes satisfy the request
6. Steps 3–5 repeat up to 3 times if verification fails

All steps use the shared prompt builders from `core/chat.ts`.

## Options

| Flag | Description |
|------|-------------|
| `-w, --workspace <path>` | Workspace directory (default: `cwd`) |
| `--model <name>` | Model override (or `BYCHAT_MODEL` env var) |
| `--base-url <url>` | API base URL (or `OPENAI_BASE_URL`) |
| `--api-key <key>` | API key (or `OPENAI_API_KEY`) |
| `-s, --system <prompt>` | Custom system prompt |
| `--no-stream` | Wait for full response |
| `--list-models` | List models and exit |
| `-o, --output <file>` | Write response to a file |
| `--verbose` | Show model, timing, debug info |

## Configuration

The CLI reads settings from the **same** data directory as the desktop app (`core/dataDir.ts`):

| File | What it configures |
|------|--------------------|
| `ai-settings.json` | Provider, base URL, API key, model |
| `prompt-settings.json` | System prompt, agent prompts |

Configure once in the desktop UI → use everywhere (desktop, web, CLI).

Override at runtime via environment variables: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `BYCHAT_MODEL`.

## Global Install

```bash
npm run build:cli
npm link
bychat ask "explain the auth flow"
```

## Files

| File | Description |
|------|-------------|
| `index.ts` | CLI entrypoint — arg parsing, mode dispatch, streaming output |
| `tsconfig.json` | TypeScript config (compiles to `dist-cli/`) |
