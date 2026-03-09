import { useWorkspace } from '../context/WorkspaceContext';
import FileTree from './FileTree';
import SearchPanel from './SearchPanel';
import SourceControlPanel from './SourceControlPanel';
import NpmPanel from './NpmPanel';
import SupabasePanel from './SupabasePanel';
import DatabasePanel from './DatabasePanel';
import GitHubActionsTab from './GitHubActionsTab';
import AtlassianPanel from './AtlassianPanel';
import McpServersPanel from './McpServersPanel';
import CliProvidersPanel from './CliProvidersPanel';
import CredentialsPanel from './CredentialsPanel';
import ExplorerGitControls from './ExplorerGitControls';
import { ChevronLeftIcon } from './icons';

interface SidebarProps {
  onCollapse?: () => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const { importFolder, folderName, folderPath, tree, activePanel } = useWorkspace();

  if (activePanel === 'search') return <aside className="sidebar"><SearchPanel /></aside>;
  if (activePanel === 'source-control') return <aside className="sidebar"><SourceControlPanel /></aside>;
  if (activePanel === 'npm') return <aside className="sidebar"><NpmPanel /></aside>;
  if (activePanel === 'supabase') return <aside className="sidebar"><SupabasePanel /></aside>;
  if (activePanel === 'database') return <aside className="sidebar"><DatabasePanel /></aside>;
  if (activePanel === 'github') return <aside className="sidebar"><GitHubActionsTab /></aside>;
  if (activePanel === 'atlassian') return <aside className="sidebar"><AtlassianPanel /></aside>;
  if (activePanel === 'mcp') return <aside className="sidebar"><McpServersPanel /></aside>;
  if (activePanel === 'copilot') return <CliProvidersPanel />;
  if (activePanel === 'credentials') return <aside className="sidebar"><CredentialsPanel /></aside>;

  return (
    <aside className="sidebar">
      <div className="sidebar-hdr">
        <h2>📁 Explorer</h2>
        {onCollapse && (
          <button className="panel-collapse-btn" onClick={onCollapse} title="Collapse sidebar">
            <ChevronLeftIcon />
          </button>
        )}
      </div>
      <div className="sidebar-actions">
        <button className="btn-import" onClick={importFolder}>📂 Import Folder</button>
      </div>
      {folderName && <div className="folder-name">📂 {folderName}</div>}
      <ExplorerGitControls />
      <div className="file-tree">
        <FileTree items={tree} depth={0} folderPath={folderPath || undefined} />
      </div>
    </aside>
  );
}
