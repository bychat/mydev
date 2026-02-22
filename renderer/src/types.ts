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
  gitDiff: (folderPath: string, filePath: string) => Promise<DiffResult>;
  aiCheckOllama: () => Promise<boolean>;
  aiListModels: (baseUrl: string, apiKey: string) => Promise<string[]>;
  aiChat: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  aiLoadSettings: () => Promise<AISettings>;
  aiSaveSettings: (settings: AISettings) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
