import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';
import type { TreeEntry } from '../types';

function isIgnored(itemPath: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some(p => itemPath === p || itemPath.startsWith(p + '/'));
}

function FileTreeItem({ item, depth }: { item: TreeEntry; depth: number }) {
  const { openFile, activeTabPath, gitIgnoredPaths } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const pad = { paddingLeft: `${12 + depth * 16}px` };
  const ignored = isIgnored(item.path, gitIgnoredPaths);

  if (item.type === 'folder') {
    return (
      <>
        <div className={`tree-item folder${ignored ? ' ignored' : ''}`} style={pad} onClick={() => setExpanded(p => !p)}>
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
      className={`tree-item file${activeTabPath === item.path ? ' active' : ''}${ignored ? ' ignored' : ''}`}
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
