import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TreeEntry, Tab, GitChange, GitFileChange, GitBranchInfo, SidePanel } from '../types';

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
  gitSplitChanges: GitFileChange[];
  gitBranchInfo: GitBranchInfo | null;
  gitIgnoredPaths: string[];
  setActivePanel: (p: SidePanel) => void;
  importFolder: () => Promise<void>;
  openFile: (name: string, filePath: string, readOnly?: boolean) => Promise<void>;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeAllTabs: () => void;
  closeTabsToTheRight: (filePath: string) => void;
  updateTabContent: (filePath: string, content: string) => void;
  setActiveTabPath: (path: string | null) => void;
  saveFile: (filePath: string) => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  openDiff: (filePath: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  gitCommit: (message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: () => Promise<{ success: boolean; error?: string }>;
  gitPull: () => Promise<{ success: boolean; error?: string }>;
  gitCheckout: (branch: string) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (branchName: string) => Promise<{ success: boolean; error?: string }>;
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
  const [gitSplitChanges, setGitSplitChanges] = useState<GitFileChange[]>([]);
  const [gitBranch, setGitBranch] = useState<GitBranchInfo | null>(null);
  const [gitIgnoredPaths, setGitIgnoredPaths] = useState<string[]>([]);

  const refreshGitStatus = useCallback(async () => {
    if (!folderPath) return;
    const changes = await window.electronAPI.gitStatus(folderPath);
    setGitChanges(changes);
    const split = await window.electronAPI.gitStatusSplit(folderPath);
    setGitSplitChanges(split);
    const branch = await window.electronAPI.gitBranchInfo(folderPath);
    setGitBranch(branch);
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

    // Auto-open README or first root file
    const rootFiles = result.tree.filter(e => e.type === 'file');
    const readme = rootFiles.find(f => f.name.toLowerCase().startsWith('readme'));
    const toOpen = readme ?? rootFiles[0];
    if (toOpen) {
      const res = await window.electronAPI.readFile(toOpen.path);
      if (res.success && res.content) {
        setOpenTabs([{ name: toOpen.name, path: toOpen.path, content: res.content, modified: false }]);
        setActiveTabPath(toOpen.path);
      }
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

  const closeOtherTabs = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const kept = prev.filter(t => t.path === filePath);
      setActiveTabPath(kept.length > 0 ? kept[0].path : null);
      return kept;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabPath(null);
  }, []);

  const closeTabsToTheRight = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath);
      if (idx === -1) return prev;
      const kept = prev.slice(0, idx + 1);
      if (activeTabPath && !kept.some(t => t.path === activeTabPath)) {
        setActiveTabPath(kept[kept.length - 1]?.path ?? null);
      }
      return kept;
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

  const stageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await window.electronAPI.gitStage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await window.electronAPI.gitUnstage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const stageAll = useCallback(async () => {
    if (!folderPath) return;
    await window.electronAPI.gitStageAll(folderPath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageAll = useCallback(async () => {
    if (!folderPath) return;
    await window.electronAPI.gitUnstageAll(folderPath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const commitChanges = useCallback(async (message: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await window.electronAPI.gitCommit(folderPath, message);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const pushChanges = useCallback(async () => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await window.electronAPI.gitPush(folderPath);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const pullChanges = useCallback(async () => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await window.electronAPI.gitPull(folderPath);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const checkoutBranch = useCallback(async (branch: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await window.electronAPI.gitCheckout(folderPath, branch);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const createBranch = useCallback(async (branchName: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await window.electronAPI.gitCreateBranch(folderPath, branchName);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  return (
    <WorkspaceContext.Provider value={{
      folderPath, folderName, tree, hasGit, hasPackageJson, packageName,
      openTabs, activeTabPath, activePanel, gitChanges, gitSplitChanges, gitBranchInfo: gitBranch, gitIgnoredPaths,
      setActivePanel, importFolder, openFile, closeTab, closeOtherTabs, closeAllTabs, closeTabsToTheRight,
      updateTabContent, setActiveTabPath, saveFile, refreshGitStatus, openDiff,
      stageFile, unstageFile, stageAll, unstageAll, gitCommit: commitChanges,
      gitPush: pushChanges, gitPull: pullChanges, gitCheckout: checkoutBranch,
      gitCreateBranch: createBranch,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
