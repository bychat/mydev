import { ipcMain, dialog, type BrowserWindow } from 'electron';
import { readDirectoryTree, getGitChangedFiles, getGitChangedFilesSplit, getGitDiff, getGitIgnoredPaths, gitStageFile, gitUnstageFile, gitStageAll, gitUnstageAll, gitCommit, gitGetBranchInfo, gitListBranches, gitCheckout, gitCreateBranch, gitPull, gitPush } from './fileSystem';
import { checkOllama, listModels, chatComplete, chatCompleteStream, loadSettings, saveSettings, type AISettings } from './ai';
import { logRequest, logResult, registerDebugIpc } from './debugWindow';
import * as path from 'path';
import * as fs from 'fs';

/** Active AI chat AbortController — allows the renderer to cancel an in-flight request */
let activeChatController: AbortController | null = null;

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
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

    try {
      const fullReply = await chatCompleteStream(
        baseUrl, apiKey, model, messages,
        (chunk: string) => {
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

  // ── Debug Window ──
  registerDebugIpc();
}
