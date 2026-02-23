import { useWorkspace } from '../context/WorkspaceContext';
import FileTree from './FileTree';
import SearchPanel from './SearchPanel';
import SourceControlPanel from './SourceControlPanel';

interface SidebarProps {
  onCollapse?: () => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const { importFolder, folderName, tree, activePanel } = useWorkspace();

  if (activePanel === 'search') return <aside className="sidebar"><SearchPanel /></aside>;
  if (activePanel === 'source-control') return <aside className="sidebar"><SourceControlPanel /></aside>;

  return (
    <aside className="sidebar">
      <div className="sidebar-hdr">
        <h2>📁 Explorer</h2>
        {onCollapse && (
          <button className="panel-collapse-btn" onClick={onCollapse} title="Collapse sidebar">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M10 3.5a.5.5 0 0 0-.82-.38l-4 3.5a.5.5 0 0 0 0 .76l4 3.5A.5.5 0 0 0 10 10.5v-7z"/></svg>
          </button>
        )}
      </div>
      <div className="sidebar-actions">
        <button className="btn-import" onClick={importFolder}>📂 Import Folder</button>
      </div>
      {folderName && <div className="folder-name">📂 {folderName}</div>}
      <div className="file-tree">
        <FileTree items={tree} depth={0} />
      </div>
    </aside>
  );
}
