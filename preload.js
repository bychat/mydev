const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  newWindow: () => ipcRenderer.invoke('new-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  createFile: (filePath, content) => ipcRenderer.invoke('create-file', filePath, content),
  createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),
  deleteFileOrFolder: (targetPath) => ipcRenderer.invoke('delete-file-or-folder', targetPath),
  renameFileOrFolder: (oldPath, newPath) => ipcRenderer.invoke('rename-file-or-folder', oldPath, newPath),
  refreshTree: (folderPath) => ipcRenderer.invoke('refresh-tree', folderPath),
  gitStatus: (folderPath) => ipcRenderer.invoke('git-status', folderPath),
  gitStatusSplit: (folderPath) => ipcRenderer.invoke('git-status-split', folderPath),
  gitDiff: (folderPath, filePath) => ipcRenderer.invoke('git-diff', folderPath, filePath),
  gitStage: (folderPath, filePath) => ipcRenderer.invoke('git-stage', folderPath, filePath),
  gitUnstage: (folderPath, filePath) => ipcRenderer.invoke('git-unstage', folderPath, filePath),
  gitStageAll: (folderPath) => ipcRenderer.invoke('git-stage-all', folderPath),
  gitUnstageAll: (folderPath) => ipcRenderer.invoke('git-unstage-all', folderPath),
  gitDiscard: (folderPath, filePath) => ipcRenderer.invoke('git-discard', folderPath, filePath),
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
  // Prompt Settings
  promptsLoad: () => ipcRenderer.invoke('prompts-load'),
  promptsSave: (prompts) => ipcRenderer.invoke('prompts-save', prompts),
  promptsReset: () => ipcRenderer.invoke('prompts-reset'),
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
  onOpenPrompts: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('open-prompts', listener);
    return () => ipcRenderer.removeListener('open-prompts', listener);
  },
  onOpenDebug: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('open-debug', listener);
    return () => ipcRenderer.removeListener('open-debug', listener);
  },
  onOpenAgents: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('open-agents', listener);
    return () => ipcRenderer.removeListener('open-agents', listener);
  },
  // Chat History
  historyLoad: () => ipcRenderer.invoke('history-load'),
  historyGetRecentWorkspaces: (limit) => ipcRenderer.invoke('history-get-recent-workspaces', limit),
  historyOpenWorkspace: (folderPath) => ipcRenderer.invoke('history-open-workspace', folderPath),
  historyRemoveWorkspace: (folderPath) => ipcRenderer.invoke('history-remove-workspace', folderPath),
  historyCreateConversation: (folderPath, mode) => ipcRenderer.invoke('history-create-conversation', folderPath, mode),
  historyGetConversation: (folderPath, conversationId) => ipcRenderer.invoke('history-get-conversation', folderPath, conversationId),
  historyGetActiveConversation: (folderPath) => ipcRenderer.invoke('history-get-active-conversation', folderPath),
  historyUpdateConversation: (folderPath, conversationId, messages, mode) => ipcRenderer.invoke('history-update-conversation', folderPath, conversationId, messages, mode),
  historyDeleteConversation: (folderPath, conversationId) => ipcRenderer.invoke('history-delete-conversation', folderPath, conversationId),
  historySetActiveConversation: (folderPath, conversationId) => ipcRenderer.invoke('history-set-active-conversation', folderPath, conversationId),
  historyRenameConversation: (folderPath, conversationId, newTitle) => ipcRenderer.invoke('history-rename-conversation', folderPath, conversationId, newTitle),
  historyGetWorkspace: (folderPath) => ipcRenderer.invoke('history-get-workspace', folderPath),
  // Supabase
  detectSupabase: (folderPath) => ipcRenderer.invoke('detect-supabase', folderPath),
  supabaseGetUsers: (projectUrl, serviceRoleKey) => ipcRenderer.invoke('supabase-get-users', projectUrl, serviceRoleKey),
  supabaseGetStorage: (projectUrl, serviceRoleKey) => ipcRenderer.invoke('supabase-get-storage', projectUrl, serviceRoleKey),
  supabaseGetTables: (projectUrl, serviceRoleKey) => ipcRenderer.invoke('supabase-get-tables', projectUrl, serviceRoleKey),
  supabaseExecuteQuery: (projectUrl, serviceRoleKey, query) => ipcRenderer.invoke('supabase-execute-query', projectUrl, serviceRoleKey, query),
  // GitHub Actions
  githubExtractRepoInfo: (remoteUrl) => ipcRenderer.invoke('github-extract-repo-info', remoteUrl),
  githubListWorkflows: (owner, repo) => ipcRenderer.invoke('github-list-workflows', owner, repo),
  githubListWorkflowRuns: (owner, repo, workflowId, perPage) => ipcRenderer.invoke('github-list-workflow-runs', owner, repo, workflowId, perPage),
  githubListRunJobs: (owner, repo, runId) => ipcRenderer.invoke('github-list-run-jobs', owner, repo, runId),
  githubGetRunLogs: (owner, repo, runId) => ipcRenderer.invoke('github-get-run-logs', owner, repo, runId),
  githubGetJobLogs: (owner, repo, jobId) => ipcRenderer.invoke('github-get-job-logs', owner, repo, jobId),
  githubRerunWorkflow: (owner, repo, runId) => ipcRenderer.invoke('github-rerun-workflow', owner, repo, runId),
  // Atlassian/Jira
  atlassianLoadConnections: () => ipcRenderer.invoke('atlassian-load-connections'),
  atlassianSaveConnections: (connections) => ipcRenderer.invoke('atlassian-save-connections', connections),
  atlassianTestConnection: (connection) => ipcRenderer.invoke('atlassian-test-connection', connection),
  atlassianFetchProjects: (connection) => ipcRenderer.invoke('atlassian-fetch-projects', connection),
  atlassianFetchIssues: (connection, projectKey, maxResults) => ipcRenderer.invoke('atlassian-fetch-issues', connection, projectKey, maxResults),
  githubListIssues: (owner, repo, state, perPage) => ipcRenderer.invoke('github-list-issues', owner, repo, state, perPage),
  // Shell
  shellOpenExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  // MCP Servers
  mcpLoadServers: () => ipcRenderer.invoke('mcp-load-servers'),
  mcpSaveServers: (servers) => ipcRenderer.invoke('mcp-save-servers', servers),
  mcpInstallServer: (config) => ipcRenderer.invoke('mcp-install-server', config),
  mcpUninstallServer: (serverId) => ipcRenderer.invoke('mcp-uninstall-server', serverId),
  mcpConnectServer: (serverId) => ipcRenderer.invoke('mcp-connect-server', serverId),
  mcpDisconnectServer: (serverId) => ipcRenderer.invoke('mcp-disconnect-server', serverId),
  mcpCallTool: (serverId, toolName, args) => ipcRenderer.invoke('mcp-call-tool', serverId, toolName, args),
  mcpReadResource: (serverId, uri) => ipcRenderer.invoke('mcp-read-resource', serverId, uri),
  // GitHub Copilot CLI
  ghCliDetect: () => ipcRenderer.invoke('gh-cli-detect'),
  ghCliInstallCopilot: () => ipcRenderer.invoke('gh-cli-install-copilot'),
  ghCopilotChat: (prompt, model) => ipcRenderer.invoke('gh-copilot-chat', prompt, model),
  ghCopilotChatStream: (prompt, model) => ipcRenderer.invoke('gh-copilot-chat-stream', prompt, model),
  onGhCopilotChatChunk: (cb) => {
    const listener = (_event, chunk) => cb(chunk);
    ipcRenderer.on('gh-copilot-chat-chunk', listener);
    return () => ipcRenderer.removeListener('gh-copilot-chat-chunk', listener);
  },
  onGhCopilotChatChunkDone: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('gh-copilot-chat-chunk-done', listener);
    return () => ipcRenderer.removeListener('gh-copilot-chat-chunk-done', listener);
  },
  ghCopilotChatAbort: () => ipcRenderer.invoke('gh-copilot-chat-abort'),
});
