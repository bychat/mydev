import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import '../styles/welcome.css';

export default function Welcome() {
  const { importFolder } = useWorkspace();

  return (
    <div className="welcome-wrapper">
      <div className="welcome-card">
        <h1>mydev.bychat.io</h1>
        <p className="subtitle">Import a folder to get started</p>
        <button className="btn-primary" onClick={importFolder}>
          📂 Import a Project
        </button>
      </div>
    </div>
  );
}
