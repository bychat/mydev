import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';

function FileTreeItem({ item, depth }) {
  const { openFile, activeTabPath } = useWorkspace();
  const [expanded, setExpanded] = useState(false);

  if (item.type === 'folder') {
    return (
      <>
        <div
          className="tree-item tree-item--folder"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setExpanded(prev => !prev)}
        >
          <span className="tree-arrow">{expanded ? '▼' : '▶'}</span>
          <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
          <span className="tree-label">{item.name}</span>
        </div>
        {expanded && item.children && (
          <div className="tree-children">
            {item.children.map(child => (
              <FileTreeItem key={child.path} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </>
    );
  }

  const isActive = activeTabPath === item.path;

  return (
    <div
      className={`tree-item tree-item--file${isActive ? ' active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => openFile(item.name, item.path)}
    >
      <span className="tree-arrow-spacer" />
      <span className="tree-icon">{getFileIcon(item.name)}</span>
      <span className="tree-label">{item.name}</span>
    </div>
  );
}

export default function FileTree({ items, depth }) {
  if (!items || items.length === 0) return null;

  return items.map(item => (
    <FileTreeItem key={item.path} item={item} depth={depth} />
  ));
}
