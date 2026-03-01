/**
 * Integration IPC handlers — NPM, Supabase, GitHub, Atlassian, Shell
 */
import { ipcMain, shell } from 'electron';
import { findNpmProjects } from '../workspace';
import {
  detectSupabaseConfig,
  fetchSupabaseUsers,
  fetchSupabaseStorage,
  fetchSupabaseTables,
  executeSupabaseQuery,
} from '../supabase';
import {
  extractRepoInfo,
  listWorkflows,
  listWorkflowRuns,
  listRunJobs,
  getRunLogs,
  getJobLogs,
  rerunWorkflow,
  listIssues,
  type GitHubIssueFilterState,
} from '../github';
import {
  testConnection,
  fetchProjects,
  fetchProjectIssues,
  type AtlassianConnection,
} from '../atlassian';
import { loadAtlassianConnections, saveAtlassianConnections } from '../storage';

export function registerIntegrationsIpc(): void {
  // ── NPM ──
  ipcMain.handle('get-all-npm-projects', async (_event, folderPath: string, gitIgnoredPaths: string[]) => {
    return findNpmProjects(folderPath, gitIgnoredPaths);
  });

  // ── Supabase ──
  ipcMain.handle('detect-supabase', async (_event, folderPath: string) => detectSupabaseConfig(folderPath));
  ipcMain.handle('supabase-get-users', async (_event, url: string, key: string) => fetchSupabaseUsers(url, key));
  ipcMain.handle('supabase-get-storage', async (_event, url: string, key: string) => fetchSupabaseStorage(url, key));
  ipcMain.handle('supabase-get-tables', async (_event, url: string, key: string) => fetchSupabaseTables(url, key));
  ipcMain.handle('supabase-execute-query', async (_event, url: string, key: string, query: string) => executeSupabaseQuery(url, key, query));

  // ── Shell ──
  ipcMain.handle('shell-open-external', async (_event, url: string) => shell.openExternal(url));

  // ── GitHub ──
  ipcMain.handle('github-extract-repo-info', async (_event, remoteUrl: string) => extractRepoInfo(remoteUrl));
  ipcMain.handle('github-list-workflows', async (_event, owner: string, repo: string) => listWorkflows(owner, repo));
  ipcMain.handle('github-list-workflow-runs', async (_event, owner: string, repo: string, workflowId?: number, perPage?: number) => listWorkflowRuns(owner, repo, workflowId, perPage));
  ipcMain.handle('github-list-run-jobs', async (_event, owner: string, repo: string, runId: number) => listRunJobs(owner, repo, runId));
  ipcMain.handle('github-get-run-logs', async (_event, owner: string, repo: string, runId: number) => getRunLogs(owner, repo, runId));
  ipcMain.handle('github-get-job-logs', async (_event, owner: string, repo: string, jobId: number) => getJobLogs(owner, repo, jobId));
  ipcMain.handle('github-rerun-workflow', async (_event, owner: string, repo: string, runId: number) => rerunWorkflow(owner, repo, runId));
  ipcMain.handle('github-list-issues', async (_event, owner: string, repo: string, state?: GitHubIssueFilterState, perPage?: number) => listIssues(owner, repo, state, perPage));

  // ── Atlassian/Jira ──
  ipcMain.handle('atlassian-load-connections', async () => loadAtlassianConnections());
  ipcMain.handle('atlassian-save-connections', async (_event, connections: AtlassianConnection[]) => {
    saveAtlassianConnections(connections);
    return { success: true };
  });
  ipcMain.handle('atlassian-test-connection', async (_event, connection: AtlassianConnection) => testConnection(connection));
  ipcMain.handle('atlassian-fetch-projects', async (_event, connection: AtlassianConnection) => fetchProjects(connection));
  ipcMain.handle('atlassian-fetch-issues', async (_event, connection: AtlassianConnection, projectKey: string, maxResults?: number) => fetchProjectIssues(connection, projectKey, maxResults));
}
