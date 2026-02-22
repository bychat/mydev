import { ipcMain, dialog } from 'electron';
import { readDirectoryTree, getGitChangedFiles, getGitDiff, getGitIgnoredPaths } from './fileSystem';
import { checkOllama, listModels, chatComplete, loadSettings, saveSettings, type AISettings } from './ai';
import * as path from 'path';
import * as fs from 'fs';

export function registerIpcHandlers(): void {
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

  ipcMain.handle('git-diff', async (_event, folderPath: string, filePath: string) => {
    return getGitDiff(folderPath, filePath);
  });

  // ── AI Handlers ──
  ipcMain.handle('ai-check-ollama', async () => {
    return checkOllama();
  });

  ipcMain.handle('ai-list-models', async (_event, baseUrl: string, apiKey: string) => {
    return listModels(baseUrl, apiKey);
  });

  ipcMain.handle('ai-chat', async (_event, baseUrl: string, apiKey: string, model: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    try {
      const reply = await chatComplete(baseUrl, apiKey, model, messages);
      return { success: true, reply };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('ai-load-settings', async () => {
    return loadSettings();
  });

  ipcMain.handle('ai-save-settings', async (_event, settings: AISettings) => {
    saveSettings(settings);
    return { success: true };
  });
}
