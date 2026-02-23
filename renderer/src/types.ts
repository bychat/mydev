export interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeEntry[];
}

export interface FolderResult {
  folderPath: string;
  tree: TreeEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  gitIgnoredPaths: string[];
}

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface Tab {
  name: string;
  path: string;
  content: string;
  modified: boolean;
  readOnly?: boolean;
}

export interface GitChange {
  file: string;
  status: string;
}

export interface GitFileChange {
  file: string;
  status: string;
  staged: boolean;
}

export interface DiffResult {
  oldContent: string;
  newContent: string;
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

export interface GitOpResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface NpmProject {
  name: string;
  relativePath: string;
  absolutePath: string;
  scripts: Record<string, string>;
}

export type SidePanel = 'explorer' | 'search' | 'source-control' | 'npm';

export interface AISettings {
  provider: 'ollama' | 'openai';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIChatResult {
  success: boolean;
  reply?: string;
  error?: string;
}

/** A single planned file action from the check agent */
export interface FileActionPlan {
  file: string;          // relative path
  action: 'create' | 'update' | 'delete';
  description: string;   // what changes to make
}

/** Progress state for a file action */
export type FileActionStatus = 'pending' | 'reading' | 'updating' | 'done' | 'error';

export interface FileActionProgress {
  plan: FileActionPlan;
  status: FileActionStatus;
  diff?: { before: string; after: string };
  error?: string;
}

// ── Chat History Types ──

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  mode: 'Agent' | 'Chat' | 'Edit';
}

export interface WorkspaceHistory {
  folderPath: string;
  folderName: string;
  lastOpened: string;
  conversations: Conversation[];
  activeConversationId: string | null;
}

export interface AppHistory {
  version: number;
  workspaces: WorkspaceHistory[];
  lastWorkspacePath: string | null;
}

export interface ElectronAPI {
  selectFolder: () => Promise<FolderResult | null>;
  openFolder: (folderPath: string) => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
