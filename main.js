const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function readDirectoryTree(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const tree = [];

  // Sort: folders first, then files, alphabetical within each group
  const sorted = entries
    .filter(e => !e.name.startsWith('.')) // skip hidden files
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'folder',
        children: readDirectoryTree(fullPath),
      });
    } else {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
      });
    }
  }
  return tree;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Import a Project',
    });
    if (result.canceled) return null;
    const folderPath = result.filePaths[0];
    const tree = readDirectoryTree(folderPath);

    // Detect project indicators
    const hasGit = fs.existsSync(path.join(folderPath, '.git'));
    const hasPackageJson = fs.existsSync(path.join(folderPath, 'package.json'));

    // Read package.json for project name if available
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
