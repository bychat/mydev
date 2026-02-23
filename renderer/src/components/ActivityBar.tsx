import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { SidePanel } from '../types';
import PromptSettingsModal from './PromptSettingsModal';

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

const TerminalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2zm0 1h12v8H2V4zm2.5 1.5L3 7l1.5 1.5.7-.7L4.4 7l.8-.8-.7-.7zM6 8v1h4V8H6z"/>
  </svg>
);

const PromptsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 14V2h12v12H2zM4 4h8v1H4V4zm0 2h8v1H4V6zm0 2h6v1H4V8z"/>
  </svg>
);

const NewWindowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 3v10h10V3H3zm9 9H4V4h8v8zM1 1v12h1V2h11V1H1z"/>
  </svg>
);

const ExplorerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.5 1H7l1 2h6.5l.5.5v10l-.5.5h-13l-.5-.5v-12l.5-.5zM2 3v9h12V4H7.69l-1-2H2z"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M15.25 14.19l-4.22-4.22a5.5 5.5 0 1 0-1.06 1.06l4.22 4.22a.75.75 0 1 0 1.06-1.06zM2 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0z"/>
  </svg>
);

const panels: { id: SidePanel; icon: 'explorer' | 'search' | 'source-control' | 'npm'; label: string; gitOnly?: boolean; npmOnly?: boolean }[] = [
  { id: 'explorer', icon: 'explorer', label: 'Explorer' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'source-control', icon: 'source-control', label: 'Source Control', gitOnly: true },
  { id: 'npm', icon: 'npm', label: 'NPM Scripts', npmOnly: true },
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
