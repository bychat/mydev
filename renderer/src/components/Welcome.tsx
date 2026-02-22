import { useWorkspace } from '../context/WorkspaceContext';

export default function Welcome() {
  const { importFolder } = useWorkspace();

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>mydev.bychat.io</h1>
        <p>Import a folder to get started</p>
        <button className="btn-primary" onClick={importFolder}>📂 Import a Project</button>
      </div>
    </div>
  );
}
