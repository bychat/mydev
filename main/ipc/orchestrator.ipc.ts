/**
 * Orchestrator IPC Handlers
 *
 * Bridges the Orchestrator (agent profiles, workflows) to Electron IPC
 * so the renderer can manage workflows and agent profiles.
 *
 * Also bridges the Event Bus and Execution Run system for real-time
 * step-by-step observability in the UI.
 *
 * Desktop (Electron) only. Cloud mode uses REST endpoints in server/.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { AgentProfile, Workflow } from '../../core/orchestrator';
import { getStorage } from '../../core/storage';
import { getEventBus, type BusEvent } from '../../core/event-bus';
import type { ExecutionRun } from '../../core/execution-run';

export function registerOrchestratorIpc(): void {
  const storage = getStorage();
  const bus = getEventBus();

  // ── Forward event-bus events to all renderer windows ──
  bus.onAll((event: BusEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('orchestrator-event', event);
      }
    }
  });

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

  // ── Execution Runs ──

  ipcMain.handle('orchestrator-list-runs', async () => {
    return storage.readJSON<ExecutionRun[]>('execution-runs', []);
  });

  ipcMain.handle('orchestrator-get-run', async (_event, runId: string) => {
    const all = await storage.readJSON<ExecutionRun[]>('execution-runs', []);
    return all.find(r => r.id === runId) ?? null;
  });

  ipcMain.handle('orchestrator-get-run-events', async (_event, correlationId: string) => {
    return bus.getRunEvents(correlationId);
  });

  ipcMain.handle('orchestrator-get-event-history', async (_event, filter?: Record<string, string>) => {
    return bus.getHistory(filter);
  });

  // ── Visual Workflow Editor (persist editor-specific workflow data) ──

  ipcMain.handle('orchestrator-save-editor-workflow', async (_event, editorData: unknown) => {
    const all = await storage.readJSON<unknown[]>('editor-workflows', []);
    const data = editorData as { id: string };
    const idx = all.findIndex((w: any) => w.id === data.id);
    if (idx >= 0) {
      all[idx] = editorData;
    } else {
      all.push(editorData);
    }
    await storage.writeJSON('editor-workflows', all);
    return { success: true };
  });

  ipcMain.handle('orchestrator-list-editor-workflows', async () => {
    return storage.readJSON<unknown[]>('editor-workflows', []);
  });

  ipcMain.handle('orchestrator-delete-editor-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<unknown[]>('editor-workflows', []);
    const filtered = all.filter((w: any) => w.id !== workflowId);
    await storage.writeJSON('editor-workflows', filtered);
    return { success: true };
  });

  // ── Execute Workflow (start a tracked run) ──

  ipcMain.handle('orchestrator-execute-workflow', async (_event, workflowData: { id: string; name: string; nodes: unknown[]; edges: unknown[] }) => {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const correlationId = runId;

    // Emit workflow-started event
    bus.emit('workflow', 'started', {
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      totalSteps: (workflowData.nodes as any[]).length,
    }, { source: workflowData.id, correlationId });

    const steps: any[] = [];
    const nodes = workflowData.nodes as any[];

    // Simulate step-by-step execution (each node runs sequentially)
    for (const node of nodes) {
      const stepStart = Date.now();

      bus.emit('step', 'started', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: node.data?.nodeType || 'unknown',
        dependsOn: [],
      }, { source: workflowData.id, correlationId });

      // Small delay to simulate work
      await new Promise(resolve => setTimeout(resolve, 200));

      const stepDuration = Date.now() - stepStart;

      bus.emit('step', 'completed', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: node.data?.nodeType || 'unknown',
        status: 'completed',
        durationMs: stepDuration,
        artifactCount: 0,
      }, { source: workflowData.id, correlationId });

      steps.push({
        nodeId: node.id,
        label: node.data?.label || node.id,
        status: 'completed',
        durationMs: stepDuration,
      });
    }

    // Emit workflow-completed event
    bus.emit('workflow', 'completed', {
      workflowId: workflowData.id,
      status: 'completed',
      durationMs: steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0),
      stepsCompleted: steps.length,
      stepsFailed: 0,
    }, { source: workflowData.id, correlationId });

    // Persist the run
    const run = {
      id: runId,
      workflowId: workflowData.id,
      status: 'completed',
      startedAt: new Date(Date.now() - steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0)).toISOString(),
      finishedAt: new Date().toISOString(),
      steps,
    };

    const allRuns = await storage.readJSON<unknown[]>('execution-runs', []);
    allRuns.push(run);
    // Keep last 200 runs
    if (allRuns.length > 200) allRuns.splice(0, allRuns.length - 200);
    await storage.writeJSON('execution-runs', allRuns);

    return { success: true, run };
  });

  // ── Save Run (manual save from renderer) ──

  ipcMain.handle('orchestrator-save-run', async (_event, run: unknown) => {
    const allRuns = await storage.readJSON<unknown[]>('execution-runs', []);
    const data = run as { id: string };
    const idx = allRuns.findIndex((r: any) => r.id === data.id);
    if (idx >= 0) {
      allRuns[idx] = run;
    } else {
      allRuns.push(run);
    }
    if (allRuns.length > 200) allRuns.splice(0, allRuns.length - 200);
    await storage.writeJSON('execution-runs', allRuns);
    return { success: true };
  });
}
