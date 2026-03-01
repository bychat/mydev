# connectors/

Connector plugins — each file implements the `Connector<TConfig>` interface from `core/connector.ts` and is automatically registered on startup.

## Built-in Connectors

| File | Connector | Category | What it does |
|------|-----------|----------|--------------|
| `github.connector.ts` | GitHub | source-control | Workflows, workflow runs, jobs, logs, issues, rerun |
| `atlassian.connector.ts` | Atlassian / Jira | project-management | Projects, issues, sprints |
| `supabase.connector.ts` | Supabase | database | Users, storage buckets, tables, SQL query execution |

## Adding a New Connector

1. Copy `_template.connector.ts` → `your-service.connector.ts`
2. Implement `metadata`, `configFields`, `actions`, `testConnection()`, `executeAction()`
3. Register it in `index.ts`

The connector instantly becomes available in both desktop (IPC) and web (REST API) modes with zero additional wiring.

See the root [README → Connector Plugin System](../README.md#connector-plugin-system) for a full walkthrough.

## Registration

`index.ts` exports `registerBuiltInConnectors()` which pushes every connector into the global `ConnectorRegistry`. Called once at startup by:
- `main/index.ts` (Electron)
- `server/index.ts` (Express)

## REST API (web mode)

When running as a web server, connectors are accessible at:

```
GET  /api/connectors                         → list all
GET  /api/connectors/:id                     → get details
POST /api/connectors/:id/test                → test connection
POST /api/connectors/:id/config              → save config
GET  /api/connectors/:id/config              → load config
POST /api/connectors/:id/actions/:actionId   → execute action
```
