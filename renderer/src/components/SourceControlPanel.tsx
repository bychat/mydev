import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: '#e5c07b' },
  A: { label: 'A', color: '#50fa7b' },
  D: { label: 'D', color: '#e05555' },
  '??': { label: 'U', color: '#50fa7b' },
  R: { label: 'R', color: '#7c8cf8' },
  C: { label: 'C', color: '#7c8cf8' },
  T: { label: 'T', color: '#7c8cf8' },
};

export default function SourceControlPanel() {
  const {
    gitSplitChanges, folderPath, refreshGitStatus, openDiff,
    stageFile, unstageFile, stageAll, unstageAll, gitCommit,
  } = useWorkspace();

  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [unstagedCollapsed, setUnstagedCollapsed] = useState(false);

  useEffect(() => { refreshGitStatus(); }, [refreshGitStatus]);

  const staged = useMemo(() => gitSplitChanges.filter(c => c.staged), [gitSplitChanges]);
  const unstaged = useMemo(() => gitSplitChanges.filter(c => !c.staged), [gitSplitChanges]);

  const handleCommit = async () => {
    if (!commitMsg.trim() || staged.length === 0) return;
    setCommitting(true);
    setError(null);
    const result = await gitCommit(commitMsg.trim());
    setCommitting(false);
    if (result.success) {
      setCommitMsg('');
    } else {
      setError(result.error ?? 'Commit failed');
    }
  };

  const handleClick = (filePath: string) => {
    if (!folderPath) return;
    const full = filePath.startsWith('/') ? filePath : `${folderPath}/${filePath}`;
    openDiff(full);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="sc-panel">
      <div className="sidebar-hdr"><h2>🔀 Source Control</h2></div>

      {/* Commit area */}
      <div className="sc-commit-area">
        <div className="sc-commit-input-wrap">
          <textarea
            className="sc-commit-input"
            placeholder="Commit message"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        <button
          className="sc-commit-btn"
          disabled={!commitMsg.trim() || staged.length === 0 || committing}
          onClick={handleCommit}
          title={staged.length === 0 ? 'Stage files before committing' : 'Commit staged changes (⌘Enter)'}
        >
          {committing ? '⏳ Committing…' : '✓ Commit'}
        </button>
        {error && <div className="sc-commit-error">{error}</div>}
      </div>

      <div className="sc-actions">
        <button className="btn-import" onClick={refreshGitStatus}>🔄 Refresh</button>
      </div>

      {staged.length === 0 && unstaged.length === 0 ? (
        <div className="sc-empty">No changes detected</div>
      ) : (
        <div className="file-tree">
          {/* Staged changes */}
          <div className="sc-section-hdr sc-section-clickable" onClick={() => setStagedCollapsed(v => !v)}>
            <span className="sc-section-arrow">{stagedCollapsed ? '▸' : '▾'}</span>
            <span>Staged Changes ({staged.length})</span>
            {staged.length > 0 && (
              <button
                className="sc-section-action"
                onClick={e => { e.stopPropagation(); unstageAll(); }}
                title="Unstage All"
              >−</button>
            )}
          </div>
          {!stagedCollapsed && staged.map(c => {
            const name = c.file.split('/').pop() ?? c.file;
            const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#bbb' };
            return (
              <div key={`staged-${c.file}`} className="tree-item file sc-item" onClick={() => handleClick(c.file)}>
                <span className="tree-icon">{getFileIcon(name)}</span>
                <span className="tree-label sc-file">{c.file}</span>
                <span className="sc-status" style={{ color: s.color }}>{s.label}</span>
                <button
                  className="sc-item-action"
                  onClick={e => { e.stopPropagation(); unstageFile(c.file); }}
                  title="Unstage"
                >−</button>
              </div>
            );
          })}

          {/* Unstaged changes */}
          <div className="sc-section-hdr sc-section-clickable" onClick={() => setUnstagedCollapsed(v => !v)}>
            <span className="sc-section-arrow">{unstagedCollapsed ? '▸' : '▾'}</span>
            <span>Changes ({unstaged.length})</span>
            {unstaged.length > 0 && (
              <button
                className="sc-section-action"
                onClick={e => { e.stopPropagation(); stageAll(); }}
                title="Stage All"
              >+</button>
            )}
          </div>
          {!unstagedCollapsed && unstaged.map(c => {
            const name = c.file.split('/').pop() ?? c.file;
            const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#bbb' };
            return (
              <div key={`unstaged-${c.file}`} className="tree-item file sc-item" onClick={() => handleClick(c.file)}>
                <span className="tree-icon">{getFileIcon(name)}</span>
                <span className="tree-label sc-file">{c.file}</span>
                <span className="sc-status" style={{ color: s.color }}>{s.label}</span>
                <button
                  className="sc-item-action"
                  onClick={e => { e.stopPropagation(); stageFile(c.file); }}
                  title="Stage"
                >+</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
