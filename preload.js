const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  gitStatus: (folderPath) => ipcRenderer.invoke('git-status', folderPath),
  gitStatusSplit: (folderPath) => ipcRenderer.invoke('git-status-split', folderPath),
  gitDiff: (folderPath, filePath) => ipcRenderer.invoke('git-diff', folderPath, filePath),
  gitStage: (folderPath, filePath) => ipcRenderer.invoke('git-stage', folderPath, filePath),
  gitUnstage: (folderPath, filePath) => ipcRenderer.invoke('git-unstage', folderPath, filePath),
  gitStageAll: (folderPath) => ipcRenderer.invoke('git-stage-all', folderPath),
  gitUnstageAll: (folderPath) => ipcRenderer.invoke('git-unstage-all', folderPath),
  gitCommit: (folderPath, message) => ipcRenderer.invoke('git-commit', folderPath, message),
  gitBranchInfo: (folderPath) => ipcRenderer.invoke('git-branch-info', folderPath),
  gitListBranches: (folderPath) => ipcRenderer.invoke('git-list-branches', folderPath),
  gitCheckout: (folderPath, branch) => ipcRenderer.invoke('git-checkout', folderPath, branch),
  gitCreateBranch: (folderPath, branch) => ipcRenderer.invoke('git-create-branch', folderPath, branch),
  gitPull: (folderPath) => ipcRenderer.invoke('git-pull', folderPath),
  gitPush: (folderPath) => ipcRenderer.invoke('git-push', folderPath),
  getAllNpmProjects: (folderPath, gitIgnoredPaths) => ipcRenderer.invoke('get-all-npm-projects', folderPath, gitIgnoredPaths),
  aiCheckOllama: () => ipcRenderer.invoke('ai-check-ollama'),
  aiListModels: (baseUrl, apiKey) => ipcRenderer.invoke('ai-list-models', baseUrl, apiKey),
  aiChat: (baseUrl, apiKey, model, messages) => ipcRenderer.invoke('ai-chat', baseUrl, apiKey, model, messages),
  aiChatStream: (baseUrl, apiKey, model, messages) => ipcRenderer.invoke('ai-chat-stream', baseUrl, apiKey, model, messages),
  onAiChatChunk: (cb) => {
    const listener = (_event, chunk) => cb(chunk);
    ipcRenderer.on('ai-chat-chunk', listener);
    return () => ipcRenderer.removeListener('ai-chat-chunk', listener);
  },
  onAiChatChunkDone: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('ai-chat-chunk-done', listener);
    return () => ipcRenderer.removeListener('ai-chat-chunk-done', listener);
  },
  aiChatAbort: () => ipcRenderer.invoke('ai-chat-abort'),
  aiLoadSettings: () => ipcRenderer.invoke('ai-load-settings'),
  aiSaveSettings: (settings) => ipcRenderer.invoke('ai-save-settings', settings),
  // Debug
  debugOpen: () => ipcRenderer.invoke('debug-open'),
  debugClear: () => ipcRenderer.invoke('debug-clear'),
  // Terminal
  terminalCreate: (cwd) => ipcRenderer.invoke('terminal-create', cwd),
  terminalInput: (id, data) => ipcRenderer.send('terminal-input', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.send('terminal-resize', id, cols, rows),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', id),
  onTerminalData: (cb) => {
    const listener = (_event, id, data) => cb(id, data);
    ipcRenderer.on('terminal-data', listener);
    return () => ipcRenderer.removeListener('terminal-data', listener);
  },
  onTerminalExit: (cb) => {
    const listener = (_event, id) => cb(id);
    ipcRenderer.on('terminal-exit', listener);
    return () => ipcRenderer.removeListener('terminal-exit', listener);
  },
  onToggleTerminal: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('toggle-terminal', listener);
    return () => ipcRenderer.removeListener('toggle-terminal', listener);
  },
});
