import { useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: '#e5c07b' },
  A: { label: 'A', color: '#50fa7b' },
  D: { label: 'D', color: '#e05555' },
  '??': { label: 'U', color: '#50fa7b' },
  R: { label: 'R', color: '#7c8cf8' },
};

export default function SourceControlPanel() {
  const { gitChanges, folderPath, refreshGitStatus, openDiff } = useWorkspace();

  useEffect(() => { refreshGitStatus(); }, [refreshGitStatus]);

  const handleClick = (filePath: string) => {
    if (!folderPath) return;
    const full = filePath.startsWith('/') ? filePath : `${folderPath}/${filePath}`;
    openDiff(full);
  };

  return (
    <div className="sc-panel">
      <div className="sidebar-hdr"><h2>🔀 Source Control</h2></div>
      <div className="sc-actions">
        <button className="btn-import" onClick={refreshGitStatus}>🔄 Refresh</button>
      </div>
      {gitChanges.length === 0 ? (
        <div className="sc-empty">No changes detected</div>
      ) : (
        <div className="file-tree">
          <div className="sc-section-hdr">Changes ({gitChanges.length})</div>
          {gitChanges.map(c => {
            const name = c.file.split('/').pop() ?? c.file;
            const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#bbb' };
            return (
              <div key={c.file} className="tree-item file" onClick={() => handleClick(c.file)}>
                <span className="tree-icon">{getFileIcon(name)}</span>
                <span className="tree-label sc-file">{c.file}</span>
                <span className="sc-status" style={{ color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
