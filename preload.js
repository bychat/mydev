const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  gitStatus: (folderPath) => ipcRenderer.invoke('git-status', folderPath),
  gitDiff: (folderPath, filePath) => ipcRenderer.invoke('git-diff', folderPath, filePath),
});
