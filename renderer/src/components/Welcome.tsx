import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { WorkspaceHistory } from '../types';

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Welcome() {
  const { importFolder } = useWorkspace();
  const backend = useBackend();
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const workspaces = await backend.historyGetRecentWorkspaces(8);
        setRecentWorkspaces(workspaces);
      } catch (err) {
        console.error('[Welcome] Failed to load recent workspaces:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openWorkspace = useCallback(async (folderPath: string) => {
    // We need to trigger folder import through the workspace context
    // For now, show a message that they need to use "Import" - we'll enhance this
    try {
      // Register the workspace as opened
      await backend.historyOpenWorkspace(folderPath);
      // Trigger a custom event or use another mechanism
      // For now, we'll need to modify the importFolder to accept a path
      window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath } }));
    } catch (err) {
      console.error('[Welcome] Failed to open workspace:', err);
    }
  }, []);

  const removeWorkspace = useCallback(async (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    try {
      await backend.historyRemoveWorkspace(folderPath);
      setRecentWorkspaces(prev => prev.filter(w => w.folderPath !== folderPath));
    } catch (err) {
      console.error('[Welcome] Failed to remove workspace:', err);
    }
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>mydev.bychat.io</h1>
        <p>Import a folder to get started</p>
        <button className="btn-primary" onClick={importFolder}>📂 Import a Project</button>

        {/* Recent Workspaces */}
        {!loading && recentWorkspaces.length > 0 && (
          <div className="recent-workspaces">
            <h3>Recent Projects</h3>
            <div className="recent-workspaces-list">
              {recentWorkspaces.map(ws => (
                <div
                  key={ws.folderPath}
                  className="recent-workspace-item"
                  onClick={() => openWorkspace(ws.folderPath)}
                >
                  <div className="recent-workspace-icon">📁</div>
                  <div className="recent-workspace-info">
                    <span className="recent-workspace-name">{ws.folderName}</span>
                    <span className="recent-workspace-path">{ws.folderPath}</span>
                    <span className="recent-workspace-meta">
                      {ws.conversations.length} chat{ws.conversations.length !== 1 ? 's' : ''} · {formatRelativeTime(ws.lastOpened)}
                    </span>
                  </div>
                  <button
                    className="recent-workspace-remove"
                    onClick={(e) => removeWorkspace(e, ws.folderPath)}
                    title="Remove from recent"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
