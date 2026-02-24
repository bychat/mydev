/**
 * SupabasePanel - Shows Supabase project info when detected in workspace
 */
import { useWorkspace } from '../context/WorkspaceContext';
import { SupabaseIcon } from './icons';

export default function SupabasePanel() {
  const { supabaseConfig, folderPath } = useWorkspace();

  if (!supabaseConfig || !supabaseConfig.detected) {
    return (
      <div className="supabase-panel">
        <div className="supabase-panel-header">
          <SupabaseIcon size={20} />
          <h2>Supabase</h2>
        </div>
        <div className="supabase-panel-empty">
          <p>No Supabase configuration detected.</p>
          <p className="supabase-hint">
            Add "supabase" to any .env file in your project to connect.
          </p>
          <div className="supabase-actions" style={{ marginTop: '16px' }}>
            <button 
              className="supabase-action-btn"
              onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/docs')}
              title="Open Supabase Docs"
            >
              <span>📚</span> Documentation
            </button>
            <button 
              className="supabase-action-btn"
              onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/dashboard')}
              title="Open Supabase Dashboard"
            >
              <span>🔗</span> Supabase Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { projectUrl, projectRef, sourceFile } = supabaseConfig;

  // Extract project name from URL if available
  const projectName = projectRef || 'Unknown Project';
  const dashboardUrl = projectRef 
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : null;

  return (
    <div className="supabase-panel">
      <div className="supabase-panel-header">
        <SupabaseIcon size={20} />
        <h2>Supabase</h2>
      </div>
      
      <div className="supabase-panel-content">
        {/* Project Info */}
        <div className="supabase-section">
          <div className="supabase-section-title">Project</div>
          <div className="supabase-project-card">
            <div className="supabase-project-icon">
              <SupabaseIcon size={24} />
            </div>
            <div className="supabase-project-info">
              <span className="supabase-project-name">{projectName}</span>
              {projectUrl && (
                <span className="supabase-project-url">{projectUrl}</span>
              )}
            </div>
          </div>
        </div>

        {/* Source */}
        {sourceFile && (
          <div className="supabase-section">
            <div className="supabase-section-title">Detected From</div>
            <div className="supabase-source-file">
              <code>{sourceFile.replace(folderPath || '', '').replace(/^\//, '')}</code>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="supabase-section">
          <div className="supabase-section-title">Quick Actions</div>
          <div className="supabase-actions">
            {dashboardUrl && (
              <button 
                className="supabase-action-btn"
                onClick={() => window.electronAPI.shellOpenExternal(dashboardUrl)}
                title="Open Supabase Dashboard"
              >
                <span>🔗</span> Open Dashboard
              </button>
            )}
            <button 
              className="supabase-action-btn"
              onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/docs')}
              title="Open Supabase Docs"
            >
              <span>📚</span> Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
