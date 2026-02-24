import { ipcMain, dialog, BrowserWindow, shell, type BrowserWindow as BW } from 'electron';
import { readDirectoryTree, getGitChangedFiles, getGitChangedFilesSplit, getGitDiff, getGitIgnoredPaths, gitStageFile, gitUnstageFile, gitStageAll, gitUnstageAll, gitDiscardFile, gitCommit, gitGetBranchInfo, gitListBranches, gitCheckout, gitCreateBranch, gitPull, gitPush } from './fileSystem';
import { checkOllama, listModels, chatComplete, chatCompleteStream, loadSettings, saveSettings, type AISettings } from './ai';
import { loadPrompts, savePrompts, resetPrompts, type PromptSettings } from './prompts';
import { logRequest, logResult, logStreamingProgress, registerDebugIpc } from './debugWindow';
import { detectSupabaseConfig, fetchSupabaseUsers, fetchSupabaseStorage, type SupabaseConfig, type SupabaseUsersResult, type SupabaseStorageResult } from './supabase';
import {
  loadAppHistory,
  saveAppHistory,
  getOrCreateWorkspace,
  getRecentWorkspaces,
  removeWorkspace,
  createConversation,
  getConversation,
  getActiveConversation,
  updateConversation,
  deleteConversation,
  setActiveConversation,
  renameConversation,
  type AppHistory,
  type WorkspaceHistory,
  type Conversation,
  type ChatMessage as HistoryChatMessage,
} from './chatHistory';
import * as path from 'path';
import * as fs from 'fs';

// Check if we should use dev server or built files
const rendererDistPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
const useDevServer = process.env.VITE_DEV_SERVER === 'true' || 
  (!require('electron').app.isPackaged && !fs.existsSync(rendererDistPath));

/** Active AI chat AbortController — allows the renderer to cancel an in-flight request */
let activeChatController: AbortController | null = null;

export function registerIpcHandlers(getWindow: () => BW | null): void {
  // New Window handler
  ipcMain.handle('new-window', async () => {
    const newWin = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (useDevServer) {
      newWin.loadURL('http://localhost:5173');
    } else {
      newWin.loadFile(path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html'));
    }

    return true;
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Import a Project' });
    if (result.canceled) return null;

    const folderPath = result.filePaths[0];
    const tree = readDirectoryTree(folderPath);
    const hasGit = fs.existsSync(path.join(folderPath, '.git'));
    const hasPackageJson = fs.existsSync(path.join(folderPath, 'package.json'));

    let packageName: string | null = null;
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8'));
        packageName = pkg.name ?? null;
      } catch { /* ignore */ }
    }

    const gitIgnoredPaths = hasGit ? getGitIgnoredPaths(folderPath) : [];

    return { folderPath, tree, hasGit, hasPackageJson, packageName, gitIgnoredPaths };
  });

  // Open a folder by path (for recent workspaces)
  ipcMain.handle('open-folder', async (_event, folderPath: string) => {
    if (!fs.existsSync(folderPath)) {
      return null;
    }

    const tree = readDirectoryTree(folderPath);
    const hasGit = fs.existsSync(path.join(folderPath, '.git'));
    const hasPackageJson = fs.existsSync(path.join(folderPath, 'package.json'));

    let packageName: string | null = null;
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8'));
        packageName = pkg.name ?? null;
      } catch { /* ignore */ }
    }

    const gitIgnoredPaths = hasGit ? getGitIgnoredPaths(folderPath) : [];

    return { folderPath, tree, hasGit, hasPackageJson, packageName, gitIgnoredPaths };
  });

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      return { success: true, content: fs.readFileSync(filePath, 'utf-8') };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('save-file', async (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('git-status', async (_event, folderPath: string) => {
    return getGitChangedFiles(folderPath);
  });

  ipcMain.handle('git-status-split', async (_event, folderPath: string) => {
    return getGitChangedFilesSplit(folderPath);
  });

  ipcMain.handle('git-diff', async (_event, folderPath: string, filePath: string) => {
    return getGitDiff(folderPath, filePath);
  });

  ipcMain.handle('git-stage', async (_event, folderPath: string, filePath: string) => {
    try {
      gitStageFile(folderPath, filePath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('git-unstage', async (_event, folderPath: string, filePath: string) => {
    try {
      gitUnstageFile(folderPath, filePath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('git-stage-all', async (_event, folderPath: string) => {
    try {
      gitStageAll(folderPath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('git-unstage-all', async (_event, folderPath: string) => {
    try {
      gitUnstageAll(folderPath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('git-discard', async (_event, folderPath: string, filePath: string) => {
    return gitDiscardFile(folderPath, filePath);
  });

  ipcMain.handle('git-commit', async (_event, folderPath: string, message: string) => {
    return gitCommit(folderPath, message);
  });

  ipcMain.handle('git-branch-info', async (_event, folderPath: string) => {
    return gitGetBranchInfo(folderPath);
  });

  ipcMain.handle('git-list-branches', async (_event, folderPath: string) => {
    return gitListBranches(folderPath);
  });

  ipcMain.handle('git-checkout', async (_event, folderPath: string, branch: string) => {
    return gitCheckout(folderPath, branch);
  });

  ipcMain.handle('git-create-branch', async (_event, folderPath: string, branch: string) => {
    return gitCreateBranch(folderPath, branch);
  });

  ipcMain.handle('git-pull', async (_event, folderPath: string) => {
    return gitPull(folderPath);
  });

  ipcMain.handle('git-push', async (_event, folderPath: string) => {
    return gitPush(folderPath);
  });

  // ── NPM Scripts ──
  // Find all package.json files recursively, excluding gitignored paths
  ipcMain.handle('get-all-npm-projects', async (_event, folderPath: string, gitIgnoredPaths: string[]) => {
    const projects: { name: string; relativePath: string; absolutePath: string; scripts: Record<string, string> }[] = [];
    
    const ignoredSet = new Set(gitIgnoredPaths.map(p => path.resolve(folderPath, p)));
    
    function isIgnored(filePath: string): boolean {
      // Check if the file or any parent is in the ignored set
      let current = filePath;
      while (current !== folderPath && current !== path.dirname(current)) {
        if (ignoredSet.has(current)) return true;
        current = path.dirname(current);
      }
      return false;
    }
    
    function walkDir(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip common directories that shouldn't be searched
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
            if (isIgnored(fullPath)) continue;
            walkDir(fullPath);
          } else if (entry.name === 'package.json') {
            if (isIgnored(fullPath)) continue;
            try {
              const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
              const scripts = pkg.scripts ?? {};
              if (Object.keys(scripts).length > 0) {
                const relativePath = path.relative(folderPath, path.dirname(fullPath)) || '.';
                projects.push({
                  name: pkg.name || relativePath,
                  relativePath,
                  absolutePath: path.dirname(fullPath),
                  scripts,
                });
              }
            } catch { /* ignore invalid package.json */ }
          }
        }
      } catch { /* ignore unreadable directories */ }
    }
    
    walkDir(folderPath);
    return projects;
  });

  // ── AI Handlers ──
  ipcMain.handle('ai-check-ollama', async () => {
    return checkOllama();
  });

  ipcMain.handle('ai-list-models', async (_event, baseUrl: string, apiKey: string) => {
    return listModels(baseUrl, apiKey);
  });

  ipcMain.handle('ai-chat', async (_event, baseUrl: string, apiKey: string, model: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    // Create an AbortController so the renderer can cancel the request
    const controller = new AbortController();
    activeChatController = controller;

    // Log request to debug window
    const debugId = logRequest(baseUrl, model, messages);
    const startTime = Date.now();

    try {
      const reply = await chatComplete(baseUrl, apiKey, model, messages, controller.signal);
      logResult(debugId, 'success', reply, undefined, Date.now() - startTime);
      return { success: true, reply };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        logResult(debugId, 'aborted', undefined, 'Aborted by user', Date.now() - startTime);
        return { success: false, error: 'aborted' };
      }
      const errMsg = (err as Error).message;
      logResult(debugId, 'error', undefined, errMsg, Date.now() - startTime);
      return { success: false, error: errMsg };
    } finally {
      if (activeChatController === controller) activeChatController = null;
    }
  });

  // ── Streaming AI Chat ──
  ipcMain.handle('ai-chat-stream', async (_event, baseUrl: string, apiKey: string, model: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    const controller = new AbortController();
    activeChatController = controller;

    const debugId = logRequest(baseUrl, model, messages);
    const startTime = Date.now();
    const win = getWindow();
    
    // Track accumulated response for live debug logging
    let accumulatedResponse = '';

    try {
      const fullReply = await chatCompleteStream(
        baseUrl, apiKey, model, messages,
        (chunk: string) => {
          // Accumulate response and update debug window with progress
          accumulatedResponse += chunk;
          logStreamingProgress(debugId, accumulatedResponse);
          
          // Send each chunk to the renderer as an event
          if (win && !win.isDestroyed()) {
            win.webContents.send('ai-chat-chunk', chunk);
          }
        },
        controller.signal,
      );

      // Signal stream end
      if (win && !win.isDestroyed()) {
        win.webContents.send('ai-chat-chunk-done');
      }

      logResult(debugId, 'success', fullReply, undefined, Date.now() - startTime);
      return { success: true, reply: fullReply };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai-chat-chunk-done');
        }
        logResult(debugId, 'aborted', accumulatedResponse || undefined, 'Aborted by user', Date.now() - startTime);
        return { success: false, error: 'aborted' };
      }
      const errMsg = (err as Error).message;
      logResult(debugId, 'error', undefined, errMsg, Date.now() - startTime);
      return { success: false, error: errMsg };
    } finally {
      if (activeChatController === controller) activeChatController = null;
    }
  });

  ipcMain.handle('ai-chat-abort', async () => {
    if (activeChatController) {
      activeChatController.abort();
      activeChatController = null;
    }
    return { success: true };
  });

  ipcMain.handle('ai-load-settings', async () => {
    return loadSettings();
  });

  ipcMain.handle('ai-save-settings', async (_event, settings: AISettings) => {
    saveSettings(settings);
    return { success: true };
  });

  // ── Prompt Settings ──

  ipcMain.handle('prompts-load', async () => {
    return loadPrompts();
  });

  ipcMain.handle('prompts-save', async (_event, prompts: PromptSettings) => {
    savePrompts(prompts);
    return { success: true };
  });

  ipcMain.handle('prompts-reset', async () => {
    return resetPrompts();
  });

  // ── Chat History ──
  
  // Get all history (workspaces + conversations)
  ipcMain.handle('history-load', async () => {
    return loadAppHistory();
  });

  // Get recent workspaces
  ipcMain.handle('history-get-recent-workspaces', async (_event, limit?: number) => {
    const history = loadAppHistory();
    return getRecentWorkspaces(history, limit);
  });

  // Open/register a workspace (creates if doesn't exist)
  ipcMain.handle('history-open-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    const workspace = getOrCreateWorkspace(history, folderPath);
    saveAppHistory(history);
    return workspace;
  });

  // Remove a workspace from history
  ipcMain.handle('history-remove-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    removeWorkspace(history, folderPath);
    saveAppHistory(history);
    return { success: true };
  });

  // Create a new conversation in a workspace
  ipcMain.handle('history-create-conversation', async (_event, folderPath: string, mode: 'Agent' | 'Chat' | 'Edit') => {
    const history = loadAppHistory();
    const workspace = getOrCreateWorkspace(history, folderPath);
    const conversation = createConversation(workspace, mode);
    saveAppHistory(history);
    return conversation;
  });

  // Get a specific conversation
  ipcMain.handle('history-get-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    return getConversation(workspace, conversationId);
  });

  // Get active conversation for a workspace
  ipcMain.handle('history-get-active-conversation', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    return getActiveConversation(workspace);
  });

  // Update a conversation's messages
  ipcMain.handle('history-update-conversation', async (
    _event,
    folderPath: string,
    conversationId: string,
    messages: HistoryChatMessage[],
    mode?: 'Agent' | 'Chat' | 'Edit'
  ) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    const conv = updateConversation(workspace, conversationId, messages, mode);
    saveAppHistory(history);
    return conv;
  });

  // Delete a conversation
  ipcMain.handle('history-delete-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    deleteConversation(workspace, conversationId);
    saveAppHistory(history);
    return { success: true };
  });

  // Set active conversation
  ipcMain.handle('history-set-active-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    setActiveConversation(workspace, conversationId);
    saveAppHistory(history);
    return { success: true };
  });

  // Rename a conversation
  ipcMain.handle('history-rename-conversation', async (_event, folderPath: string, conversationId: string, newTitle: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    renameConversation(workspace, conversationId, newTitle);
    saveAppHistory(history);
    return { success: true };
  });

  // Get workspace data (conversations list)
  ipcMain.handle('history-get-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    return history.workspaces.find(w => w.folderPath === folderPath) ?? null;
  });

  // ── Supabase Detection ──
  ipcMain.handle('detect-supabase', async (_event, folderPath: string) => {
    return detectSupabaseConfig(folderPath);
  });

  // ── Supabase Users ──
  ipcMain.handle('supabase-get-users', async (_event, projectUrl: string, serviceRoleKey: string) => {
    return fetchSupabaseUsers(projectUrl, serviceRoleKey);
  });

  // ── Supabase Storage ──
  ipcMain.handle('supabase-get-storage', async (_event, projectUrl: string, serviceRoleKey: string) => {
    return fetchSupabaseStorage(projectUrl, serviceRoleKey);
  });

  // ── Shell ──
  ipcMain.handle('shell-open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // ── Debug Window ──
  registerDebugIpc();
}
