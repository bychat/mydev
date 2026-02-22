import React, { createContext, useContext, useState, useCallback } from 'react';

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

export function WorkspaceProvider({ children }) {
  const [folderPath, setFolderPath] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [tree, setTree] = useState([]);
  const [hasGit, setHasGit] = useState(false);
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [packageName, setPackageName] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabPath, setActiveTabPath] = useState(null);

  const importFolder = useCallback(async () => {
    const result = await window.electronAPI.selectFolder();
    if (!result) return;

    setFolderPath(result.folderPath);
    setFolderName(result.folderPath.split('/').pop() || result.folderPath.split('\\').pop());
    setTree(result.tree);
    setHasGit(result.hasGit);
    setHasPackageJson(result.hasPackageJson);
    setPackageName(result.packageName);
  }, []);

  const openFile = useCallback(async (name, filePath) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    const result = await window.electronAPI.readFile(filePath);
    if (!result.success) return;

    setOpenTabs(prev => [...prev, { name, path: filePath, content: result.content, modified: false }]);
    setActiveTabPath(filePath);
  }, [openTabs]);

  const closeTab = useCallback((filePath) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      if (activeTabPath === filePath) {
        setActiveTabPath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  }, [activeTabPath]);

  const updateTabContent = useCallback((filePath, content) => {
    setOpenTabs(prev =>
      prev.map(t => (t.path === filePath ? { ...t, content, modified: true } : t))
    );
  }, []);

  const saveFile = useCallback(async (filePath) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab) return;

    const result = await window.electronAPI.saveFile(filePath, tab.content);
    if (result.success) {
      setOpenTabs(prev =>
        prev.map(t => (t.path === filePath ? { ...t, modified: false } : t))
      );
    }
  }, [openTabs]);

  const value = {
    folderPath, folderName, tree,
    hasGit, hasPackageJson, packageName,
    openTabs, activeTabPath,
    importFolder, openFile, closeTab,
    updateTabContent, setActiveTabPath, saveFile,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
