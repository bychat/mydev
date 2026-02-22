import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';
import type { TreeEntry } from '../types';

function FileTreeItem({ item, depth }: { item: TreeEntry; depth: number }) {
  const { openFile, activeTabPath } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const pad = { paddingLeft: `${12 + depth * 16}px` };

  if (item.type === 'folder') {
    return (
      <>
        <div className="tree-item folder" style={pad} onClick={() => setExpanded(p => !p)}>
          <span className="tree-arrow">{expanded ? '▼' : '▶'}</span>
          <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
          <span className="tree-label">{item.name}</span>
        </div>
        {expanded && item.children?.map(c => <FileTreeItem key={c.path} item={c} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div
      className={`tree-item file${activeTabPath === item.path ? ' active' : ''}`}
      style={pad}
      onClick={() => openFile(item.name, item.path)}
    >
      <span className="tree-spacer" />
      <span className="tree-icon">{getFileIcon(item.name)}</span>
      <span className="tree-label">{item.name}</span>
    </div>
  );
}

export default function FileTree({ items, depth }: { items: TreeEntry[]; depth: number }) {
  if (!items?.length) return null;
  return <>{items.map(i => <FileTreeItem key={i.path} item={i} depth={depth} />)}</>;
}
