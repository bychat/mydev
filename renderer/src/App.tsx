import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Welcome from './components/Welcome';

function AppLayout() {
  const { openTabs } = useWorkspace();
  return (
    <div className="app-layout">
      <StatusBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">{openTabs.length > 0 ? <Editor /> : <Welcome />}</main>
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
