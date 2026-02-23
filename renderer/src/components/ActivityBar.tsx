import { useWorkspace } from '../context/WorkspaceContext';
import type { SidePanel } from '../types';

// SVG Icons
const GitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0L5.632 1.925l1.221 1.221a1.2 1.2 0 0 1 1.532 1.532l1.176 1.176a1.2 1.2 0 0 1 1.295 2.015 1.2 1.2 0 0 1-2.015-1.295L7.432 5.888v3.055a1.2 1.2 0 1 1-1.766-1.053V5.888a1.2 1.2 0 0 1-.665-1.608L4.432 3.104.302 7.234a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457z"/>
  </svg>
);

const NpmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 0v16h16V0H0zm13 13h-2V8h-2v5H5V3h8v10z"/>
  </svg>
);

const panels: { id: SidePanel; icon: string; label: string; gitOnly?: boolean; npmOnly?: boolean }[] = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'source-control', icon: '', label: 'Source Control', gitOnly: true },
  { id: 'npm', icon: '', label: 'NPM Scripts', npmOnly: true },
];

export default function ActivityBar() {
  const { activePanel, setActivePanel, hasGit, npmProjects, gitChanges } = useWorkspace();

  return (
    <div className="activity-bar">
      {panels.map(p => {
        if (p.gitOnly && !hasGit) return null;
        if (p.npmOnly && npmProjects.length === 0) return null;
        
        let iconElement;
        if (p.id === 'source-control') {
          iconElement = <GitIcon />;
        } else if (p.id === 'npm') {
          iconElement = <NpmIcon />;
        } else {
          iconElement = <span>{p.icon}</span>;
        }
        
        return (
          <button
            key={p.id}
            className={`ab-btn${activePanel === p.id ? ' active' : ''}`}
            onClick={() => setActivePanel(p.id)}
            title={p.label}
          >
            {iconElement}
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
