import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import '../styles/editor.css';

export default function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTabPath, closeTab } = useWorkspace();

  return (
    <div className="editor-tabs">
      {openTabs.map(tab => (
        <div
          key={tab.path}
          className={`editor-tab${tab.path === activeTabPath ? ' active' : ''}`}
          onClick={() => setActiveTabPath(tab.path)}
        >
          <span className="editor-tab-label">
            {tab.modified && '● '}{tab.name}
          </span>
          <span
            className="editor-tab-close"
            onClick={e => { e.stopPropagation(); closeTab(tab.path); }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}
