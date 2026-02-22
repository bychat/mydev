import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import FileTree from './FileTree';
import '../styles/sidebar.css';

export default function Sidebar() {
  const { importFolder, folderName, tree } = useWorkspace();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>📁 Explorer</h2>
      </div>
      <div className="sidebar-actions">
        <button className="btn-import" onClick={importFolder}>
          📂 Import Folder
        </button>
      </div>
      {folderName && <div className="folder-name">📂 {folderName}</div>}
      <div className="file-tree">
        <FileTree items={tree} depth={0} />
      </div>
    </aside>
  );
}
