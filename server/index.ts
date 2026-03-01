/**
 * Enterprise Cloud Server
 * 
 * This is the server-side entrypoint for the cloud/enterprise version.
 * It exposes the same connector operations as the Electron main process,
 * but over HTTP REST endpoints instead of IPC.
 * 
 * Run with: npx tsx server/index.ts
 * 
 * Architecture:
 * ┌─────────────┐     HTTP/WS      ┌──────────────────┐
 * │  React SPA  │ ◄──────────────► │  Express Server   │
 * │  (renderer) │                   │  ┌──────────────┐ │
 * └─────────────┘                   │  │  Connector   │ │
 *                                   │  │  Registry    │ │
 *                                   │  └──────────────┘ │
 *                                   │  ┌──────────────┐ │
 *                                   │  │  Auth / RBAC │ │
 *                                   │  └──────────────┘ │
 *                                   └──────────────────┘
 */

import express from 'express';
import cors from 'cors';
import { getConnectorRegistry } from '../core/connector';
import { registerBuiltInConnectors } from '../connectors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Bootstrap ───

registerBuiltInConnectors();
const registry = getConnectorRegistry();

// ─── Middleware placeholder for enterprise auth ───

// In enterprise mode, you'd add JWT/OAuth middleware here:
// app.use('/api', authMiddleware);

// ─── Connector REST API ───

/**
 * GET /api/connectors
 * List all registered connectors (metadata only).
 */
app.get('/api/connectors', (_req, res) => {
  const connectors = registry.listConnectors();
  res.json({ connectors });
});

/**
 * GET /api/connectors/:id
 * Get full details for a connector (config fields, actions, state).
 */
app.get('/api/connectors/:id', (req, res) => {
  const connector = registry.get(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: `Connector "${req.params.id}" not found` });
  }
  res.json({
    metadata: connector.metadata,
    configFields: connector.configFields,
    actions: connector.actions,
    state: registry.getState(req.params.id),
  });
});

/**
 * POST /api/connectors/:id/test
 * Test a connector's connection with provided config.
 * Body: { config: { ... } }
 */
app.post('/api/connectors/:id/test', async (req, res) => {
  try {
    const result = await registry.testConnection(req.params.id, req.body.config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * POST /api/connectors/:id/config
 * Save connector configuration.
 * Body: { config: { ... } }
 */
app.post('/api/connectors/:id/config', (req, res) => {
  registry.setConfig(req.params.id, req.body.config);
  res.json({ success: true });
});

/**
 * GET /api/connectors/:id/config
 * Load saved connector configuration.
 */
app.get('/api/connectors/:id/config', (req, res) => {
  const config = registry.getConfig(req.params.id);
  res.json({ config: config ?? null });
});

/**
 * POST /api/connectors/:id/actions/:actionId
 * Execute a connector action.
 * Body: { params: { ... } }
 */
app.post('/api/connectors/:id/actions/:actionId', async (req, res) => {
  try {
    const result = await registry.executeAction(
      req.params.id,
      req.params.actionId,
      req.body.params,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── Health Check ───

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'cloud',
    connectors: registry.listConnectors().length,
    uptime: process.uptime(),
  });
});

// ─── AI Proxy (enterprise: centralized AI gateway) ───

app.post('/api/ai/chat', async (req, res) => {
  // In enterprise mode, this would route through your AI gateway
  // with usage metering, rate limiting, and model access controls.
  // For now, proxy to the configured AI provider.
  const { baseUrl, apiKey, model, messages } = req.body;
  
  try {
    const { chatComplete } = await import('../main/ai');
    const reply = await chatComplete(baseUrl, apiKey, model, messages);
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── Start Server ───

app.listen(PORT, () => {
  console.log(`\n🚀 mydev Enterprise Server running on http://localhost:${PORT}`);
  console.log(`   ${registry.listConnectors().length} connectors registered`);
  console.log(`   API: http://localhost:${PORT}/api/connectors\n`);
});

export default app;
