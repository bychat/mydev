import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { SidePanel } from '../types';
import PromptSettingsModal from './PromptSettingsModal';
import {
  GitIcon,
  NpmIcon,
  TerminalIcon,
  PromptsIcon,
  NewWindowIcon,
  ExplorerIcon,
  SearchIcon,
  SupabaseIcon,
  DatabaseIcon,
} from './icons';

// GitHub Icon component
const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Atlassian Icon component
const AtlassianIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.12 11.084c-.294-.375-.75-.349-1.001.074L.609 21.137c-.252.424-.053.768.44.768h6.96c.246 0 .56-.2.69-.442.892-1.632.628-5.145-1.579-10.379zM11.614 1.088c-2.886 5.14-2.479 9.122-.496 12.735.193.353.514.546.83.546H18.3c.493 0 .695-.346.44-.769L12.615 1.161c-.25-.422-.703-.447-1.001-.073z"/>
  </svg>
);

const panels: { id: SidePanel; icon: 'explorer' | 'search' | 'source-control' | 'npm' | 'supabase' | 'database' | 'github' | 'atlassian'; label: string; gitOnly?: boolean; npmOnly?: boolean }[] = [
  { id: 'explorer', icon: 'explorer', label: 'Explorer' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'source-control', icon: 'source-control', label: 'Source Control', gitOnly: true },
  { id: 'npm', icon: 'npm', label: 'NPM Scripts', npmOnly: true },
  { id: 'supabase', icon: 'supabase', label: 'Supabase' },
  { id: 'database', icon: 'database', label: 'Database' },
  { id: 'github', icon: 'github', label: 'GitHub Actions', gitOnly: true },
  { id: 'atlassian', icon: 'atlassian', label: 'Atlassian' },
];

interface ActivityBarProps {
  onToggleTerminal?: () => void;
  terminalVisible?: boolean;
}

export default function ActivityBar({ onToggleTerminal, terminalVisible }: ActivityBarProps) {
  const { activePanel, setActivePanel, hasGit, npmProjects, gitSplitChanges, openAgentsTab } = useWorkspace();
  const backend = useBackend();
  const [promptSettingsOpen, setPromptSettingsOpen] = useState(false);

  // Listen for menu-triggered open prompts
  useEffect(() => {
    const cleanup = backend.onOpenPrompts(() => {
      setPromptSettingsOpen(true);
    });
    return cleanup;
  }, []);

  // Listen for menu-triggered open debug
  useEffect(() => {
    const cleanup = backend.onOpenDebug(async () => {
      try {
        await backend.debugOpen();
      } catch (err) {
        console.error('Failed to open debug window:', err);
      }
    });
    return cleanup;
  }, []);

  // Listen for menu-triggered open agents
  useEffect(() => {
    const cleanup = backend.onOpenAgents(() => {
      openAgentsTab();
    });
    return cleanup;
  }, [openAgentsTab]);

  const handleNewWindow = async () => {
    try {
      await backend.newWindow();
    } catch (err) {
      console.error('Failed to open new window:', err);
    }
  };

  const getIconElement = (iconType: string) => {
    switch (iconType) {
      case 'explorer':
        return <ExplorerIcon />;
      case 'search':
        return <SearchIcon />;
      case 'source-control':
        return <GitIcon />;
      case 'npm':
        return <NpmIcon />;
      case 'supabase':
        return <SupabaseIcon />;
      case 'database':
        return <DatabaseIcon />;
      case 'github':
        return <GitHubIcon />;
      case 'atlassian':
        return <AtlassianIcon />;
      default:
        return null;
    }
  };

  return (
    <div className="activity-bar">
      {/* Main panel buttons */}
      <div className="ab-main">
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
              {getIconElement(p.icon)}
              {p.id === 'source-control' && gitSplitChanges.length > 0 && (
                <span className="ab-badge">{gitSplitChanges.length}</span>
              )}
              {p.id === 'npm' && npmProjects.length > 0 && (
                <span className="ab-badge">{npmProjects.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom section: Terminal, Agent Prompts, New Window */}
      <div className="ab-footer">
        {/* Terminal toggle */}
        {onToggleTerminal && (
          <button
            className={`ab-btn${terminalVisible ? ' active' : ''}`}
            onClick={onToggleTerminal}
            title="Terminal"
          >
            <TerminalIcon />
          </button>
        )}

        {/* Agent Prompts */}
        <button
          className="ab-btn"
          onClick={() => setPromptSettingsOpen(true)}
          title="Agent Prompts"
        >
          <PromptsIcon />
        </button>

        {/* New Window */}
        <button
          className="ab-btn"
          onClick={handleNewWindow}
          title="New Window"
        >
          <NewWindowIcon />
        </button>
      </div>

      <PromptSettingsModal 
        isOpen={promptSettingsOpen} 
        onClose={() => setPromptSettingsOpen(false)} 
      />
    </div>
  );
}
