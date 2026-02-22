import { useWorkspace } from '../context/WorkspaceContext';
import FileTree from './FileTree';
import SearchPanel from './SearchPanel';
import SourceControlPanel from './SourceControlPanel';

export default function Sidebar() {
  const { importFolder, folderName, tree, activePanel } = useWorkspace();

  if (activePanel === 'search') return <aside className="sidebar"><SearchPanel /></aside>;
  if (activePanel === 'source-control') return <aside className="sidebar"><SourceControlPanel /></aside>;

  return (
    <aside className="sidebar">
      <div className="sidebar-hdr"><h2>📁 Explorer</h2></div>
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
