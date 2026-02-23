import { useWorkspace } from '../context/WorkspaceContext';
import type { SidePanel } from '../types';

const panels: { id: SidePanel; icon: string; label: string; gitOnly?: boolean; npmOnly?: boolean }[] = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'source-control', icon: '🔀', label: 'Source Control', gitOnly: true },
  { id: 'npm', icon: '📦', label: 'NPM Scripts', npmOnly: true },
];

export default function ActivityBar() {
  const { activePanel, setActivePanel, hasGit, npmProjects, gitChanges } = useWorkspace();

  return (
    <div className="activity-bar">
      {panels.map(p => {
        if (p.gitOnly && !hasGit) return null;
        if (p.npmOnly && npmProjects.length === 0) return null;
        return (
          <button
            key={p.id}
            className={`ab-btn${activePanel === p.id ? ' active' : ''}`}
            onClick={() => setActivePanel(p.id)}
            title={p.label}
          >
            <span>{p.icon}</span>
            {p.id === 'source-control' && gitChanges.length > 0 && (
              <span className="ab-badge">{gitChanges.length}</span>
            )}
            {p.id === 'npm' && npmProjects.length > 0 && (
              <span className="ab-badge">{npmProjects.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
