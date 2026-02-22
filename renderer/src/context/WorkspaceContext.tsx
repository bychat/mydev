import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TreeEntry, Tab, GitChange, SidePanel } from '../types';

interface WorkspaceContextValue {
  folderPath: string | null;
  folderName: string;
  tree: TreeEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  openTabs: Tab[];
  activeTabPath: string | null;
  activePanel: SidePanel;
  gitChanges: GitChange[];
  gitIgnoredPaths: string[];
  setActivePanel: (p: SidePanel) => void;
  importFolder: () => Promise<void>;
  openFile: (name: string, filePath: string, readOnly?: boolean) => Promise<void>;
  closeTab: (filePath: string) => void;
  updateTabContent: (filePath: string, content: string) => void;
  setActiveTabPath: (path: string | null) => void;
  saveFile: (filePath: string) => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  openDiff: (filePath: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [hasGit, setHasGit] = useState(false);
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>('explorer');
  const [gitChanges, setGitChanges] = useState<GitChange[]>([]);
  const [gitIgnoredPaths, setGitIgnoredPaths] = useState<string[]>([]);

  const refreshGitStatus = useCallback(async () => {
    if (!folderPath) return;
    const changes = await window.electronAPI.gitStatus(folderPath);
    setGitChanges(changes);
  }, [folderPath]);

  const importFolder = useCallback(async () => {
    const result = await window.electronAPI.selectFolder();
    if (!result) return;
    setFolderPath(result.folderPath);
    setFolderName(result.folderPath.split('/').pop() ?? result.folderPath.split('\\').pop() ?? '');
    setTree(result.tree);
    setHasGit(result.hasGit);
    setHasPackageJson(result.hasPackageJson);
    setPackageName(result.packageName);
    setGitIgnoredPaths(result.gitIgnoredPaths ?? []);
    if (result.hasGit) {
      const changes = await window.electronAPI.gitStatus(result.folderPath);
      setGitChanges(changes);
    }
  }, []);

  const openFile = useCallback(async (name: string, filePath: string, readOnly = false) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) { setActiveTabPath(filePath); return; }
    const result = await window.electronAPI.readFile(filePath);
    if (!result.success || !result.content) return;
    setOpenTabs(prev => [...prev, { name, path: filePath, content: result.content!, modified: false, readOnly }]);
    setActiveTabPath(filePath);
  }, [openTabs]);

  const openDiff = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    const diffKey = `diff:${filePath}`;
    const existing = openTabs.find(t => t.path === diffKey);
    if (existing) { setActiveTabPath(diffKey); return; }
    const diff = await window.electronAPI.gitDiff(folderPath, filePath);
    const name = filePath.split('/').pop() ?? filePath;
    setOpenTabs(prev => [...prev, {
      name: `Δ ${name}`,
      path: diffKey,
      content: JSON.stringify(diff),
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(diffKey);
  }, [folderPath, openTabs]);

  const closeTab = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      if (activeTabPath === filePath) setActiveTabPath(next.length > 0 ? next[next.length - 1].path : null);
      return next;
    });
  }, [activeTabPath]);

  const updateTabContent = useCallback((filePath: string, content: string) => {
    setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, content, modified: true } : t)));
  }, []);

  const saveFile = useCallback(async (filePath: string) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab || tab.readOnly) return;
    const result = await window.electronAPI.saveFile(filePath, tab.content);
    if (result.success) setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, modified: false } : t)));
  }, [openTabs]);

  return (
    <WorkspaceContext.Provider value={{
      folderPath, folderName, tree, hasGit, hasPackageJson, packageName,
      openTabs, activeTabPath, activePanel, gitChanges, gitIgnoredPaths,
      setActivePanel, importFolder, openFile, closeTab,
      updateTabContent, setActiveTabPath, saveFile, refreshGitStatus, openDiff,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
