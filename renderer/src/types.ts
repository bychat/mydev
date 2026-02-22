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

export interface ElectronAPI {
  selectFolder: () => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
  gitStatus: (folderPath: string) => Promise<GitChange[]>;
  gitDiff: (folderPath: string, filePath: string) => Promise<DiffResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
