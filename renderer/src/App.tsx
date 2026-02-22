import { useState, useEffect, useCallback } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import StatusBar from './components/StatusBar';
import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Welcome from './components/Welcome';
import TerminalPanel from './components/TerminalPanel';

function AppLayout() {
  const { openTabs, folderPath } = useWorkspace();
  const [terminalVisible, setTerminalVisible] = useState(false);

  const toggleTerminal = useCallback(() => {
    if (folderPath) setTerminalVisible(prev => !prev);
  }, [folderPath]);

  // Listen for menu-triggered toggle
  useEffect(() => {
    const cleanup = window.electronAPI.onToggleTerminal(toggleTerminal);
    return cleanup;
  }, [toggleTerminal]);

  // Keyboard shortcut: Ctrl/Cmd + `
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal]);

  // No folder loaded → full-screen welcome
  if (!folderPath) {
    return (
      <div className="app-layout">
        <StatusBar />
        <main className="main-content"><Welcome /></main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <StatusBar />
      <div className="app-body">
        <ActivityBar />
        <Sidebar />
        <div className="main-area">
          <main className="main-content">{openTabs.length > 0 ? <Editor /> : <div className="empty-editor" />}</main>
          <TerminalPanel visible={terminalVisible} onClose={() => setTerminalVisible(false)} />
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  );
}
