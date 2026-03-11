/**
 * Orchestrator REST Routes — Agent Profiles & Workflows
 *
 * Cloud-mode equivalent of `main/ipc/orchestrator.ipc.ts`.
 * Exposes the same operations over HTTP REST.
 */
import { Router } from 'express';
import type { AgentProfile, Workflow } from '../../core/orchestrator';
import { getStorage } from '../../core/storage';
import { ok, fail } from '../helpers';

const router = Router();
const storage = getStorage();

// ─── Agent Profiles ─────────────────────────────────────────────────────────

router.get('/profiles', async (_req, res) => {
  try {
    const profiles = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    ok(res, profiles);
  } catch (err) { fail(res, err); }
});

router.post('/profiles', async (req, res) => {
  try {
    const profile: AgentProfile = req.body;
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const idx = all.findIndex(p => p.id === profile.id);
    if (idx >= 0) { all[idx] = profile; } else { all.push(profile); }
    await storage.writeJSON('agent-profiles', all);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.delete('/profiles/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const filtered = all.filter(p => p.id !== req.params.id);
    if (filtered.length === all.length) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    await storage.writeJSON('agent-profiles', filtered);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

// ─── Workflows ──────────────────────────────────────────────────────────────

router.get('/workflows', async (_req, res) => {
  try {
    const workflows = await storage.readJSON<Workflow[]>('workflows', []);
    ok(res, workflows);
  } catch (err) { fail(res, err); }
});

router.get('/workflows/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const workflow = all.find(w => w.id === req.params.id);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    ok(res, workflow);
  } catch (err) { fail(res, err); }
});

router.post('/workflows', async (req, res) => {
  try {
    const workflow: Workflow = req.body;
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const idx = all.findIndex(w => w.id === workflow.id);
    if (idx >= 0) { all[idx] = workflow; } else { all.push(workflow); }
    await storage.writeJSON('workflows', all);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.delete('/workflows/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const filtered = all.filter(w => w.id !== req.params.id);
    if (filtered.length === all.length) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    await storage.writeJSON('workflows', filtered);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

export default router;
