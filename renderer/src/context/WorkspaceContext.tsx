import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { TreeEntry, Tab, GitChange, GitFileChange, GitBranchInfo, SidePanel, NpmProject, SupabaseConfig } from '../types';

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
  supabaseConfig: SupabaseConfig | null;
  setActivePanel: (p: SidePanel) => void;
  importFolder: () => Promise<void>;
  closeWorkspace: () => void;
  openFile: (name: string, filePath: string, readOnly?: boolean) => Promise<void>;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeAllTabs: () => void;
  closeTabsToTheRight: (filePath: string) => void;
  updateTabContent: (filePath: string, content: string) => void;
  setTabData: (filePath: string, content: string) => void;
  setActiveTabPath: (path: string | null) => void;
  saveFile: (filePath: string) => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  openDiff: (filePath: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  discardFile: (filePath: string) => Promise<void>;
  gitCommit: (message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: () => Promise<{ success: boolean; error?: string }>;
  gitPull: () => Promise<{ success: boolean; error?: string }>;
  gitCheckout: (branch: string) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (branchName: string) => Promise<{ success: boolean; error?: string }>;
  npmProjects: NpmProject[];
  runNpmScript: (projectPath: string, scriptName: string) => void;
  openSupabaseTab: (tabType: 'users' | 'storage') => void;
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
  const [npmProjects, setNpmProjects] = useState<NpmProject[]>([]);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(null);
  
  // Lock to prevent concurrent git operations
  const gitLockRef = useRef(false);

  const refreshGitStatus = useCallback(async () => {
    if (!folderPath) return;
    // Prevent concurrent refreshes
    if (gitLockRef.current) {
      console.log('[WorkspaceContext] refreshGitStatus skipped (locked)');
      return;
    }
    gitLockRef.current = true;
    console.log('[WorkspaceContext] refreshGitStatus called');
    try {
      const changes = await window.electronAPI.gitStatus(folderPath);
      setGitChanges(changes);
      const split = await window.electronAPI.gitStatusSplit(folderPath);
      console.log('[WorkspaceContext] gitStatusSplit returned:', JSON.stringify(split, null, 2));
      setGitSplitChanges(split);
      const branch = await window.electronAPI.gitBranchInfo(folderPath);
      setGitBranch(branch);
    } finally {
      gitLockRef.current = false;
    }
  }, [folderPath]);

  const importFolder = useCallback(async () => {
    const result = await window.electronAPI.selectFolder();
    if (!result) return;
    await loadWorkspaceResult(result);
  }, []);

  // Close current workspace and go back to welcome screen
  const closeWorkspace = useCallback(() => {
    setFolderPath(null);
    setFolderName('');
    setTree([]);
    setHasGit(false);
    setHasPackageJson(false);
    setPackageName(null);
    setOpenTabs([]);
    setActiveTabPath(null);
    setGitChanges([]);
    setGitSplitChanges([]);
    setGitBranch(null);
    setGitIgnoredPaths([]);
    setNpmProjects([]);
    setSupabaseConfig(null);
  }, []);

  // Helper to load a workspace from a FolderResult
  const loadWorkspaceResult = useCallback(async (result: { folderPath: string; tree: TreeEntry[]; hasGit: boolean; hasPackageJson: boolean; packageName: string | null; gitIgnoredPaths: string[] }) => {
    setFolderPath(result.folderPath);
    setFolderName(result.folderPath.split('/').pop() ?? result.folderPath.split('\\').pop() ?? '');
    setTree(result.tree);
    setHasGit(result.hasGit);
    setHasPackageJson(result.hasPackageJson);
    setPackageName(result.packageName);
    const ignoredPaths = result.gitIgnoredPaths ?? [];
    setGitIgnoredPaths(ignoredPaths);
    if (result.hasGit) {
      const changes = await window.electronAPI.gitStatus(result.folderPath);
      setGitChanges(changes);
    }
    // Load all npm projects from the repo
    const projects = await window.electronAPI.getAllNpmProjects(result.folderPath, ignoredPaths);
    setNpmProjects(projects);

    // Detect Supabase configuration
    const supabase = await window.electronAPI.detectSupabase(result.folderPath);
    setSupabaseConfig(supabase);

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

  // Open workspace by path (for recent workspaces)
  const openWorkspaceByPath = useCallback(async (path: string) => {
    const result = await window.electronAPI.openFolder(path);
    if (!result) return;
    await loadWorkspaceResult(result);
  }, [loadWorkspaceResult]);

  // Listen for open-workspace events from Welcome component
  useEffect(() => {
    const handler = async (e: Event) => {
      const customEvent = e as CustomEvent<{ folderPath: string }>;
      if (customEvent.detail?.folderPath) {
        await openWorkspaceByPath(customEvent.detail.folderPath);
      }
    };
    window.addEventListener('open-workspace', handler);
    return () => window.removeEventListener('open-workspace', handler);
  }, [openWorkspaceByPath]);

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

  // Open special Supabase tabs (users, storage, etc.)
  const openSupabaseTab = useCallback((tabType: 'users' | 'storage') => {
    const tabKey = `supabase:${tabType}`;
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    
    const tabNames: Record<string, string> = {
      users: 'Supabase: Users',
      storage: 'Supabase: Storage',
    };
    
    setOpenTabs(prev => [...prev, {
      name: tabNames[tabType] || tabType,
      path: tabKey,
      content: '', // Content is loaded by the component
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

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

  // Update content for read-only tabs (like Supabase data views) without marking as modified
  const setTabData = useCallback((filePath: string, content: string) => {
    setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, content } : t)));
  }, []);

  const saveFile = useCallback(async (filePath: string) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab || tab.readOnly) return;
    const result = await window.electronAPI.saveFile(filePath, tab.content);
    if (result.success) setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, modified: false } : t)));
  }, [openTabs]);

  const stageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    console.log('[WorkspaceContext] stageFile called:', filePath);
    await window.electronAPI.gitStage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    console.log('[WorkspaceContext] unstageFile called:', filePath);
    await window.electronAPI.gitUnstage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const stageAll = useCallback(async () => {
    if (!folderPath) return;
    console.log('[WorkspaceContext] stageAll called');
    await window.electronAPI.gitStageAll(folderPath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageAll = useCallback(async () => {
    if (!folderPath) return;
    console.log('[WorkspaceContext] unstageAll called');
    await window.electronAPI.gitUnstageAll(folderPath);
    console.log('[WorkspaceContext] unstageAll completed, refreshing status...');
    await refreshGitStatus();
    console.log('[WorkspaceContext] unstageAll refresh done');
  }, [folderPath, refreshGitStatus]);

  const discardFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await window.electronAPI.gitDiscard(folderPath, filePath);
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

  const runNpmScript = useCallback((projectPath: string, scriptName: string) => {
    // Dispatch event to show terminal
    window.dispatchEvent(new CustomEvent('show-terminal'));
    // Dispatch event to run command in terminal panel
    const projectName = projectPath.split('/').pop() || projectPath;
    window.dispatchEvent(new CustomEvent('run-terminal-command', {
      detail: {
        cwd: projectPath,
        command: `npm run ${scriptName}`,
        label: `${projectName}: ${scriptName}`,
      },
    }));
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      folderPath, folderName, tree, hasGit, hasPackageJson, packageName,
      openTabs, activeTabPath, activePanel, gitChanges, gitSplitChanges, gitBranchInfo: gitBranch, gitIgnoredPaths,
      supabaseConfig,
      setActivePanel, importFolder, closeWorkspace, openFile, closeTab, closeOtherTabs, closeAllTabs, closeTabsToTheRight,
      updateTabContent, setTabData, setActiveTabPath, saveFile, refreshGitStatus, openDiff,
      stageFile, unstageFile, stageAll, unstageAll, discardFile, gitCommit: commitChanges,
      gitPush: pushChanges, gitPull: pullChanges, gitCheckout: checkoutBranch,
      gitCreateBranch: createBranch,
      npmProjects, runNpmScript,
      openSupabaseTab,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
