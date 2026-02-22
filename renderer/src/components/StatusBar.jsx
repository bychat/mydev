import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import '../styles/statusbar.css';

export default function StatusBar() {
  const { hasGit, hasPackageJson, packageName, folderPath } = useWorkspace();

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-app-name">mydev.bychat.io</span>
        {hasGit && (
          <span className="status-badge status-badge--git">
            <GitIcon /> Git
          </span>
        )}
        {hasPackageJson && (
          <span className="status-badge status-badge--npm">
            <NpmIcon /> {packageName || 'npm'}
          </span>
        )}
      </div>
      <div className="status-bar-right">
        {folderPath && <span className="status-path">{folderPath}</span>}
      </div>
    </div>
  );
}

function GitIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
      <path d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.548 1.56l1.773 1.774a1.224 1.224 0 1 1-.733.68L8.535 5.91v4.245a1.224 1.224 0 1 1-1.008-.036V5.793a1.224 1.224 0 0 1-.665-1.605L5.042 2.368.302 7.108a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.031 1.031 0 0 0 0-1.457" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
      <path d="M0 0v16h16V0H0zm13 13h-2V5H8v8H3V3h10v10z" />
    </svg>
  );
}
