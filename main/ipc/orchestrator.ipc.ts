/**
 * Orchestrator IPC Handlers
 *
 * Bridges the Orchestrator (agent profiles, workflows) to Electron IPC
 * so the renderer can manage workflows and agent profiles.
 *
 * Desktop (Electron) only. Cloud mode uses REST endpoints in server/.
 */

import { ipcMain } from 'electron';
import type { AgentProfile, Workflow } from '../../core/orchestrator';
import { getStorage } from '../../core/storage';

export function registerOrchestratorIpc(): void {
  const storage = getStorage();

  // ── Agent Profiles ──

  ipcMain.handle('orchestrator-list-profiles', async () => {
    return storage.readJSON<AgentProfile[]>('agent-profiles', []);
  });

  ipcMain.handle('orchestrator-save-profile', async (_event, profile: AgentProfile) => {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const idx = all.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      all[idx] = profile;
    } else {
      all.push(profile);
    }
    await storage.writeJSON('agent-profiles', all);
    return { success: true };
  });

  ipcMain.handle('orchestrator-delete-profile', async (_event, profileId: string) => {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const filtered = all.filter(p => p.id !== profileId);
    if (filtered.length === all.length) return { success: false, error: 'Profile not found' };
    await storage.writeJSON('agent-profiles', filtered);
    return { success: true };
  });

  // ── Workflows ──

  ipcMain.handle('orchestrator-list-workflows', async () => {
    return storage.readJSON<Workflow[]>('workflows', []);
  });

  ipcMain.handle('orchestrator-save-workflow', async (_event, workflow: Workflow) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const idx = all.findIndex(w => w.id === workflow.id);
    if (idx >= 0) {
      all[idx] = workflow;
    } else {
      all.push(workflow);
    }
    await storage.writeJSON('workflows', all);
    return { success: true };
  });

  ipcMain.handle('orchestrator-delete-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const filtered = all.filter(w => w.id !== workflowId);
    if (filtered.length === all.length) return { success: false, error: 'Workflow not found' };
    await storage.writeJSON('workflows', filtered);
    return { success: true };
  });

  ipcMain.handle('orchestrator-get-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    return all.find(w => w.id === workflowId) ?? null;
  });
}
