import { useWorkspace } from '../context/WorkspaceContext';
import type { SidePanel } from '../types';

const panels: { id: SidePanel; icon: string; label: string; gitOnly?: boolean }[] = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'source-control', icon: '🔀', label: 'Source Control', gitOnly: true },
];

export default function ActivityBar() {
  const { activePanel, setActivePanel, hasGit, gitChanges } = useWorkspace();

  return (
    <div className="activity-bar">
      {panels.map(p => {
        if (p.gitOnly && !hasGit) return null;
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
          </button>
        );
      })}
    </div>
  );
}
