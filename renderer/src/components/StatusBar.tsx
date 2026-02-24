import { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import SettingsModal from './SettingsModal';
import { GitIcon, NpmIcon, BackIcon } from './icons';

export default function StatusBar() {
  const {
    hasGit, hasPackageJson, packageName, folderPath, folderName,
    gitBranchInfo, gitPush, gitPull, gitCheckout, closeWorkspace,
  } = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  // Close branch menu on outside click
  useEffect(() => {
    if (!branchMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [branchMenuOpen]);

  // Auto-clear op message
  useEffect(() => {
    if (!opMsg) return;
    const t = setTimeout(() => setOpMsg(null), 4000);
    return () => clearTimeout(t);
  }, [opMsg]);

  const handlePush = async () => {
    setPushing(true);
    const r = await gitPush();
    setPushing(false);
    setOpMsg(r.success ? '✓ Pushed' : `✗ ${r.error ?? 'Push failed'}`);
  };

  const handlePull = async () => {
    setPulling(true);
    const r = await gitPull();
    setPulling(false);
    setOpMsg(r.success ? '✓ Pulled' : `✗ ${r.error ?? 'Pull failed'}`);
  };

  const handleCheckout = async (branch: string) => {
    setBranchMenuOpen(false);
    const r = await gitCheckout(branch);
    if (!r.success) setOpMsg(`✗ ${r.error ?? 'Checkout failed'}`);
  };

  const bi = gitBranchInfo;

  return (
    <div className="status-bar">
      <div className="status-left">
        {folderPath ? (
          <>
            <button 
              className="back-btn" 
              onClick={closeWorkspace}
              title="Close project and go back"
            >
              <BackIcon />
            </button>
            <span className="app-name">{folderName}</span>
          </>
        ) : (
          <span className="app-name">mydev.bychat.io</span>
        )}
        {hasGit && <span className="badge git"><GitIcon size={13} /> Git</span>}
        {hasPackageJson && <span className="badge npm"><NpmIcon size={13} /> {packageName ?? 'npm'}</span>}
      </div>
      <div className="status-right">
        {/* Branch info */}
        {hasGit && bi && (
          <>
            {/* Branch selector */}
            <div className="sb-branch-wrap" ref={branchRef}>
              <button className="sb-branch-btn" onClick={() => setBranchMenuOpen(v => !v)} title="Switch branch">
                <span className="sb-branch-icon">⑂</span>
                <span className="sb-branch-name">{bi.current || 'HEAD'}</span>
              </button>
              {branchMenuOpen && (
                <div className="sb-branch-menu">
                  <div className="sb-branch-menu-hdr">Switch Branch</div>
                  {bi.branches.map(b => (
                    <button
                      key={b}
                      className={`sb-branch-menu-item${b === bi.current ? ' active' : ''}`}
                      onClick={() => handleCheckout(b)}
                    >
                      {b === bi.current && <span className="sb-check">✓</span>}
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ahead / Behind */}
            {bi.hasRemote && (bi.ahead > 0 || bi.behind > 0) && (
              <span className="sb-sync-counts" title={`${bi.ahead}↑ ${bi.behind}↓`}>
                {bi.behind > 0 && <span className="sb-count">↓{bi.behind}</span>}
                {bi.ahead > 0 && <span className="sb-count">↑{bi.ahead}</span>}
              </span>
            )}

            {/* Pull */}
            {bi.hasRemote && (
              <button
                className="sb-action-btn"
                onClick={handlePull}
                disabled={pulling}
                title="Pull"
              >
                {pulling ? '⏳' : '↓'}
              </button>
            )}

            {/* Push */}
            {bi.hasRemote && (
              <button
                className="sb-action-btn"
                onClick={handlePush}
                disabled={pushing}
                title="Push"
              >
                {pushing ? '⏳' : '↑'}
              </button>
            )}
          </>
        )}

        {/* Op feedback */}
        {opMsg && <span className={`sb-op-msg${opMsg.startsWith('✗') ? ' error' : ''}`}>{opMsg}</span>}

        {folderPath && <span className="status-path">{folderPath}</span>}
        <button className="status-settings-btn" onClick={() => setSettingsOpen(true)} title="AI Settings">⚙️</button>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => setSettingsOpen(false)} />
    </div>
  );
}
