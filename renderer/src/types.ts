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
}

export interface ElectronAPI {
  selectFolder: () => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
