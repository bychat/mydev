const { ipcMain, dialog } = require('electron');
const { readDirectoryTree } = require('./fileSystem');
const path = require('path');
const fs = require('fs');

function registerIpcHandlers() {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Import a Project',
    });
    if (result.canceled) return null;

    const folderPath = result.filePaths[0];
    const tree = readDirectoryTree(folderPath);
    const hasGit = fs.existsSync(path.join(folderPath, '.git'));
    const hasPackageJson = fs.existsSync(path.join(folderPath, 'package.json'));

    let packageName = null;
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8'));
        packageName = pkg.name || null;
      } catch (_) {}
    }

    return { folderPath, tree, hasGit, hasPackageJson, packageName };
  });

  ipcMain.handle('read-file', async (_event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-file', async (_event, filePath, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerIpcHandlers };
