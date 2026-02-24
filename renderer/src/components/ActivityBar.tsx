import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
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
} from './icons';

const panels: { id: SidePanel; icon: 'explorer' | 'search' | 'source-control' | 'npm' | 'supabase'; label: string; gitOnly?: boolean; npmOnly?: boolean }[] = [
  { id: 'explorer', icon: 'explorer', label: 'Explorer' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'source-control', icon: 'source-control', label: 'Source Control', gitOnly: true },
  { id: 'npm', icon: 'npm', label: 'NPM Scripts', npmOnly: true },
  { id: 'supabase', icon: 'supabase', label: 'Supabase' },
];

interface ActivityBarProps {
  onToggleTerminal?: () => void;
  terminalVisible?: boolean;
}

export default function ActivityBar({ onToggleTerminal, terminalVisible }: ActivityBarProps) {
  const { activePanel, setActivePanel, hasGit, npmProjects, gitSplitChanges } = useWorkspace();
  const [promptSettingsOpen, setPromptSettingsOpen] = useState(false);

  // Listen for menu-triggered open prompts
  useEffect(() => {
    const cleanup = window.electronAPI.onOpenPrompts(() => {
      setPromptSettingsOpen(true);
    });
    return cleanup;
  }, []);

  // Listen for menu-triggered open debug
  useEffect(() => {
    const cleanup = window.electronAPI.onOpenDebug(async () => {
      try {
        await window.electronAPI.debugOpen();
      } catch (err) {
        console.error('Failed to open debug window:', err);
      }
    });
    return cleanup;
  }, []);

  const handleNewWindow = async () => {
    try {
      await window.electronAPI.newWindow();
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
