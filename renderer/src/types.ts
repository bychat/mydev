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

export type SidePanel = 'explorer' | 'search' | 'source-control';

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

export interface ElectronAPI {
  selectFolder: () => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
  gitStatus: (folderPath: string) => Promise<GitChange[]>;
  gitStatusSplit: (folderPath: string) => Promise<GitFileChange[]>;
  gitDiff: (folderPath: string, filePath: string) => Promise<DiffResult>;
  gitStage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitUnstage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitStageAll: (folderPath: string) => Promise<SaveResult>;
  gitUnstageAll: (folderPath: string) => Promise<SaveResult>;
  gitCommit: (folderPath: string, message: string) => Promise<SaveResult>;
  aiCheckOllama: () => Promise<boolean>;
  aiListModels: (baseUrl: string, apiKey: string) => Promise<string[]>;
  aiChat: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  aiLoadSettings: () => Promise<AISettings>;
  aiSaveSettings: (settings: AISettings) => Promise<{ success: boolean }>;
  // Terminal
  terminalCreate: (cwd: string) => Promise<{ id: string; shell: string }>;
  terminalInput: (id: string, data: string) => void;
  terminalResize: (id: string, cols: number, rows: number) => void;
  terminalKill: (id: string) => Promise<void>;
  onTerminalData: (cb: (id: string, data: string) => void) => () => void;
  onTerminalExit: (cb: (id: string) => void) => () => void;
  onToggleTerminal: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
