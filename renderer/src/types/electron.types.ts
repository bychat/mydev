/**
 * Electron API types
 */

import type { FolderResult, FileResult, SaveResult, TreeEntry, Tab } from './file.types';
import type { GitChange, GitFileChange, DiffResult, GitBranchInfo, GitOpResult } from './git.types';
import type { NpmProject } from './npm.types';
import type { AISettings, ChatMessage, AIChatResult } from './ai.types';
import type { Conversation, WorkspaceHistory, AppHistory } from './history.types';
import type { PromptSettings } from './prompts.types';
import type { SupabaseConfig, SupabaseUsersResult, SupabaseStorageResult, SupabaseTablesResult, SqlQueryResult } from './supabase.types';
import type { AtlassianConnection, AtlassianProjectsResult, AtlassianIssuesResult, AtlassianConnectionResult } from './atlassian.types';
import type { GitHubRepoInfo, GitHubWorkflowsResult, GitHubRunsResult, GitHubJobsResult, GitHubLogsResult, GitHubIssuesResult, GitHubIssueFilterState } from './github.types';

export interface ElectronAPI {
  // Window management
  newWindow: () => Promise<boolean>;
  selectFolder: () => Promise<FolderResult | null>;
  openFolder: (folderPath: string) => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
  // File/folder operations
  createFile: (filePath: string, content?: string) => Promise<SaveResult>;
  createFolder: (folderPath: string) => Promise<SaveResult>;
  deleteFileOrFolder: (targetPath: string) => Promise<SaveResult>;
  renameFileOrFolder: (oldPath: string, newPath: string) => Promise<SaveResult>;
  refreshTree: (folderPath: string) => Promise<TreeEntry[]>;
  gitStatus: (folderPath: string) => Promise<GitChange[]>;
  gitStatusSplit: (folderPath: string) => Promise<GitFileChange[]>;
  gitDiff: (folderPath: string, filePath: string) => Promise<DiffResult>;
  gitStage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitUnstage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitStageAll: (folderPath: string) => Promise<SaveResult>;
  gitUnstageAll: (folderPath: string) => Promise<SaveResult>;
  gitDiscard: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitCommit: (folderPath: string, message: string) => Promise<SaveResult>;
  gitBranchInfo: (folderPath: string) => Promise<GitBranchInfo>;
  gitListBranches: (folderPath: string) => Promise<string[]>;
  gitCheckout: (folderPath: string, branch: string) => Promise<SaveResult>;
  gitCreateBranch: (folderPath: string, branch: string) => Promise<SaveResult>;
  gitPull: (folderPath: string) => Promise<GitOpResult>;
  gitPush: (folderPath: string) => Promise<GitOpResult>;
  getAllNpmProjects: (folderPath: string, gitIgnoredPaths: string[]) => Promise<NpmProject[]>;
  aiCheckOllama: () => Promise<boolean>;
  aiListModels: (baseUrl: string, apiKey: string) => Promise<string[]>;
  aiChat: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  aiChatStream: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  onAiChatChunk: (cb: (chunk: string) => void) => () => void;
  onAiChatChunkDone: (cb: () => void) => () => void;
  aiChatAbort: () => Promise<{ success: boolean }>;
  aiLoadSettings: () => Promise<AISettings>;
  aiSaveSettings: (settings: AISettings) => Promise<{ success: boolean }>;
  // Prompt Settings
  promptsLoad: () => Promise<PromptSettings>;
  promptsSave: (prompts: PromptSettings) => Promise<{ success: boolean }>;
  promptsReset: () => Promise<PromptSettings>;
  // Debug
  debugOpen: () => Promise<{ success: boolean }>;
  debugClear: () => Promise<{ success: boolean }>;
  // Terminal
  terminalCreate: (cwd: string) => Promise<{ id: string; shell: string }>;
  terminalInput: (id: string, data: string) => void;
  terminalResize: (id: string, cols: number, rows: number) => void;
  terminalKill: (id: string) => Promise<void>;
  onTerminalData: (cb: (id: string, data: string) => void) => () => void;
  onTerminalExit: (cb: (id: string) => void) => () => void;
  onToggleTerminal: (cb: () => void) => () => void;
  onOpenPrompts: (cb: () => void) => () => void;
  onOpenDebug: (cb: () => void) => () => void;
  onOpenAgents: (cb: () => void) => () => void;
  // Chat History
  historyLoad: () => Promise<AppHistory>;
  historyGetRecentWorkspaces: (limit?: number) => Promise<WorkspaceHistory[]>;
  historyOpenWorkspace: (folderPath: string) => Promise<WorkspaceHistory>;
  historyRemoveWorkspace: (folderPath: string) => Promise<{ success: boolean }>;
  historyCreateConversation: (folderPath: string, mode: 'Agent' | 'Chat' | 'Edit') => Promise<Conversation>;
  historyGetConversation: (folderPath: string, conversationId: string) => Promise<Conversation | null>;
  historyGetActiveConversation: (folderPath: string) => Promise<Conversation | null>;
  historyUpdateConversation: (folderPath: string, conversationId: string, messages: ChatMessage[], mode?: 'Agent' | 'Chat' | 'Edit') => Promise<Conversation | null>;
  historyDeleteConversation: (folderPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>;
  historySetActiveConversation: (folderPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>;
  historyRenameConversation: (folderPath: string, conversationId: string, newTitle: string) => Promise<{ success: boolean; error?: string }>;
  historyGetWorkspace: (folderPath: string) => Promise<WorkspaceHistory | null>;
  // Supabase
  detectSupabase: (folderPath: string) => Promise<SupabaseConfig>;
  supabaseGetUsers: (projectUrl: string, serviceRoleKey: string) => Promise<SupabaseUsersResult>;
  supabaseGetStorage: (projectUrl: string, serviceRoleKey: string) => Promise<SupabaseStorageResult>;
  supabaseGetTables: (projectUrl: string, serviceRoleKey: string) => Promise<SupabaseTablesResult>;
  supabaseExecuteQuery: (projectUrl: string, serviceRoleKey: string, query: string) => Promise<SqlQueryResult>;
  // GitHub Actions
  githubExtractRepoInfo: (remoteUrl: string) => Promise<GitHubRepoInfo | null>;
  githubListWorkflows: (owner: string, repo: string) => Promise<GitHubWorkflowsResult>;
  githubListWorkflowRuns: (owner: string, repo: string, workflowId?: number, perPage?: number) => Promise<GitHubRunsResult>;
  githubListRunJobs: (owner: string, repo: string, runId: number) => Promise<GitHubJobsResult>;
  githubGetRunLogs: (owner: string, repo: string, runId: number) => Promise<GitHubLogsResult>;
  githubGetJobLogs: (owner: string, repo: string, jobId: number) => Promise<GitHubLogsResult>;
  githubRerunWorkflow: (owner: string, repo: string, runId: number) => Promise<{ success: boolean; error?: string }>;
  // Atlassian/Jira
  atlassianLoadConnections: () => Promise<AtlassianConnection[]>;
  atlassianSaveConnections: (connections: AtlassianConnection[]) => Promise<{ success: boolean }>;
  atlassianTestConnection: (connection: AtlassianConnection) => Promise<AtlassianConnectionResult>;
  atlassianFetchProjects: (connection: AtlassianConnection) => Promise<AtlassianProjectsResult>;
  atlassianFetchIssues: (connection: AtlassianConnection, projectKey: string, maxResults?: number) => Promise<AtlassianIssuesResult>;
  githubListIssues: (owner: string, repo: string, state?: GitHubIssueFilterState, perPage?: number) => Promise<GitHubIssuesResult>;
  // Shell
  shellOpenExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
