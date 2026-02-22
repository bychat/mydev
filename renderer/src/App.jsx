import React from 'react';
import { WorkspaceProvider } from './context/WorkspaceContext';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Welcome from './components/Welcome';
import { useWorkspace } from './context/WorkspaceContext';
import './styles/layout.css';

function AppLayout() {
  const { openTabs } = useWorkspace();
  const hasOpenFiles = openTabs.length > 0;

  return (
    <div className="app-layout">
      <StatusBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          {hasOpenFiles ? <Editor /> : <Welcome />}
        </main>
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
