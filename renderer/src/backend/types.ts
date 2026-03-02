/**
 * Backend API Interface
 *
 * This is the **single** interface that all renderer code programs against.
 * In Electron mode the implementation delegates to `window.electronAPI` (IPC).
 * In Web/Cloud mode the implementation talks to the Express REST server.
 *
 * Every component/hook uses `useBackend()` to obtain an instance — never
 * `window.electronAPI` directly.
 */

import type { FolderResult, FileResult, SaveResult, TreeEntry } from '../types/file.types';
import type { GitChange, GitFileChange, DiffResult, GitBranchInfo, GitOpResult } from '../types/git.types';
import type { NpmProject } from '../types/npm.types';
import type { AISettings, ChatMessage, AIChatResult } from '../types/ai.types';
import type { Conversation, WorkspaceHistory, AppHistory } from '../types/history.types';
import type { PromptSettings } from '../types/prompts.types';
import type {
  SupabaseConfig,
  SupabaseUsersResult,
  SupabaseStorageResult,
  SupabaseTablesResult,
  SqlQueryResult,
} from '../types/supabase.types';
import type {
  AtlassianConnection,
  AtlassianProjectsResult,
  AtlassianIssuesResult,
  AtlassianConnectionResult,
} from '../types/atlassian.types';
import type {
  GitHubRepoInfo,
  GitHubWorkflowsResult,
  GitHubRunsResult,
  GitHubJobsResult,
  GitHubLogsResult,
  GitHubIssuesResult,
  GitHubIssueFilterState,
} from '../types/github.types';
import type { SearchOptions, SearchResult } from '../types/search.types';

// ─── Runtime mode ───────────────────────────────────────────────────────────

export type BackendMode = 'electron' | 'web';

// ─── Event subscription helpers ─────────────────────────────────────────────

/** A function that unsubscribes the listener when called. */
export type Unsubscribe = () => void;

// ─── BackendAPI ─────────────────────────────────────────────────────────────

export interface BackendAPI {
  /** Which transport is active. */
  readonly mode: BackendMode;

  // ── Window management ──
  newWindow(): Promise<boolean>;
  selectFolder(): Promise<FolderResult | null>;
  openFolder(folderPath: string): Promise<FolderResult | null>;

  // ── File system ──
  readFile(filePath: string): Promise<FileResult>;
  saveFile(filePath: string, content: string): Promise<SaveResult>;
  createFile(filePath: string, content?: string): Promise<SaveResult>;
  createFolder(folderPath: string): Promise<SaveResult>;
  deleteFileOrFolder(targetPath: string): Promise<SaveResult>;
  renameFileOrFolder(oldPath: string, newPath: string): Promise<SaveResult>;
  refreshTree(folderPath: string): Promise<TreeEntry[]>;

  // ── Git ──
  gitStatus(folderPath: string): Promise<GitChange[]>;
  gitStatusSplit(folderPath: string): Promise<GitFileChange[]>;
  gitDiff(folderPath: string, filePath: string): Promise<DiffResult>;
  gitStage(folderPath: string, filePath: string): Promise<SaveResult>;
  gitUnstage(folderPath: string, filePath: string): Promise<SaveResult>;
  gitStageAll(folderPath: string): Promise<SaveResult>;
  gitUnstageAll(folderPath: string): Promise<SaveResult>;
  gitDiscard(folderPath: string, filePath: string): Promise<SaveResult>;
  gitCommit(folderPath: string, message: string): Promise<SaveResult>;
  gitBranchInfo(folderPath: string): Promise<GitBranchInfo>;
  gitListBranches(folderPath: string): Promise<string[]>;
  gitCheckout(folderPath: string, branch: string): Promise<SaveResult>;
  gitCreateBranch(folderPath: string, branch: string): Promise<SaveResult>;
  gitPull(folderPath: string): Promise<GitOpResult>;
  gitPush(folderPath: string): Promise<GitOpResult>;

  // ── NPM ──
  getAllNpmProjects(folderPath: string, gitIgnoredPaths: string[]): Promise<NpmProject[]>;

  // ── AI ──
  aiCheckOllama(): Promise<boolean>;
  aiListModels(baseUrl: string, apiKey: string): Promise<string[]>;
  aiChat(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]): Promise<AIChatResult>;
  aiChatStream(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]): Promise<AIChatResult>;
  onAiChatChunk(cb: (chunk: string) => void): Unsubscribe;
  onAiChatChunkDone(cb: () => void): Unsubscribe;
  aiChatAbort(): Promise<{ success: boolean }>;
  aiLoadSettings(): Promise<AISettings>;
  aiSaveSettings(settings: AISettings): Promise<{ success: boolean }>;

  // ── Prompt settings ──
  promptsLoad(): Promise<PromptSettings>;
  promptsSave(prompts: PromptSettings): Promise<{ success: boolean }>;
  promptsReset(): Promise<PromptSettings>;

  // ── Debug ──
  debugOpen(): Promise<{ success: boolean }>;
  debugClear(): Promise<{ success: boolean }>;

  // ── Terminal ──
  terminalCreate(cwd: string): Promise<{ id: string; shell: string }>;
  terminalInput(id: string, data: string): void;
  terminalResize(id: string, cols: number, rows: number): void;
  terminalKill(id: string): Promise<void>;
  onTerminalData(cb: (id: string, data: string) => void): Unsubscribe;
  onTerminalExit(cb: (id: string) => void): Unsubscribe;

  // ── Menu / window events (Electron-only, stubs in web mode) ──
  onToggleTerminal(cb: () => void): Unsubscribe;
  onOpenPrompts(cb: () => void): Unsubscribe;
  onOpenDebug(cb: () => void): Unsubscribe;
  onOpenAgents(cb: () => void): Unsubscribe;

  // ── Chat history ──
  historyLoad(): Promise<AppHistory>;
  historyGetRecentWorkspaces(limit?: number): Promise<WorkspaceHistory[]>;
  historyOpenWorkspace(folderPath: string): Promise<WorkspaceHistory>;
  historyRemoveWorkspace(folderPath: string): Promise<{ success: boolean }>;
  historyCreateConversation(folderPath: string, mode: 'Agent' | 'Chat' | 'Edit'): Promise<Conversation>;
  historyGetConversation(folderPath: string, conversationId: string): Promise<Conversation | null>;
  historyGetActiveConversation(folderPath: string): Promise<Conversation | null>;
  historyUpdateConversation(
    folderPath: string,
    conversationId: string,
    messages: ChatMessage[],
    mode?: 'Agent' | 'Chat' | 'Edit',
  ): Promise<Conversation | null>;
  historyDeleteConversation(folderPath: string, conversationId: string): Promise<{ success: boolean; error?: string }>;
  historySetActiveConversation(folderPath: string, conversationId: string): Promise<{ success: boolean; error?: string }>;
  historyRenameConversation(
    folderPath: string,
    conversationId: string,
    newTitle: string,
  ): Promise<{ success: boolean; error?: string }>;
  historyGetWorkspace(folderPath: string): Promise<WorkspaceHistory | null>;

  // ── Supabase ──
  detectSupabase(folderPath: string): Promise<SupabaseConfig>;
  supabaseGetUsers(projectUrl: string, serviceRoleKey: string): Promise<SupabaseUsersResult>;
  supabaseGetStorage(projectUrl: string, serviceRoleKey: string): Promise<SupabaseStorageResult>;
  supabaseGetTables(projectUrl: string, serviceRoleKey: string): Promise<SupabaseTablesResult>;
  supabaseExecuteQuery(projectUrl: string, serviceRoleKey: string, query: string): Promise<SqlQueryResult>;

  // ── GitHub ──
  githubExtractRepoInfo(remoteUrl: string): Promise<GitHubRepoInfo | null>;
  githubListWorkflows(owner: string, repo: string): Promise<GitHubWorkflowsResult>;
  githubListWorkflowRuns(owner: string, repo: string, workflowId?: number, perPage?: number): Promise<GitHubRunsResult>;
  githubListRunJobs(owner: string, repo: string, runId: number): Promise<GitHubJobsResult>;
  githubGetRunLogs(owner: string, repo: string, runId: number): Promise<GitHubLogsResult>;
  githubGetJobLogs(owner: string, repo: string, jobId: number): Promise<GitHubLogsResult>;
  githubRerunWorkflow(owner: string, repo: string, runId: number): Promise<{ success: boolean; error?: string }>;
  githubListIssues(owner: string, repo: string, state?: GitHubIssueFilterState, perPage?: number): Promise<GitHubIssuesResult>;

  // ── Atlassian / Jira ──
  atlassianLoadConnections(): Promise<AtlassianConnection[]>;
  atlassianSaveConnections(connections: AtlassianConnection[]): Promise<{ success: boolean }>;
  atlassianTestConnection(connection: AtlassianConnection): Promise<AtlassianConnectionResult>;
  atlassianFetchProjects(connection: AtlassianConnection): Promise<AtlassianProjectsResult>;
  atlassianFetchIssues(
    connection: AtlassianConnection,
    projectKey: string,
    maxResults?: number,
  ): Promise<AtlassianIssuesResult>;

  // ── Shell ──
  shellOpenExternal(url: string): Promise<void>;

  // ── Search ──
  searchFiles(folderPath: string, options: SearchOptions): Promise<SearchResult>;
}
