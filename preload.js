const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  gitStatus: (folderPath) => ipcRenderer.invoke('git-status', folderPath),
  gitDiff: (folderPath, filePath) => ipcRenderer.invoke('git-diff', folderPath, filePath),
  aiCheckOllama: () => ipcRenderer.invoke('ai-check-ollama'),
  aiListModels: (baseUrl, apiKey) => ipcRenderer.invoke('ai-list-models', baseUrl, apiKey),
  aiChat: (baseUrl, apiKey, model, messages) => ipcRenderer.invoke('ai-chat', baseUrl, apiKey, model, messages),
  aiLoadSettings: () => ipcRenderer.invoke('ai-load-settings'),
  aiSaveSettings: (settings) => ipcRenderer.invoke('ai-save-settings', settings),
});
