/**
 * McpServersPanel — Sidebar panel for downloading & managing MCP servers.
 *
 * Users can browse a built-in catalog, install servers (npm), connect/disconnect,
 * and view tools + resources exposed by each server.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import type { McpServerConfig, McpRegistryEntry } from '../types/mcp.types';
import { RefreshIcon, PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

// ── Built-in catalog of popular MCP servers ──────────────────────────────────

const CATALOG: McpRegistryEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    npmPackage: '@modelcontextprotocol/server-filesystem',
    description: 'Read, write, and search files on the local filesystem.',
    category: 'Utilities',
    icon: '📁',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    npmPackage: '@modelcontextprotocol/server-brave-search',
    description: 'Web search via the Brave Search API.',
    category: 'Search',
    icon: '🔍',
  },
  {
    id: 'github',
    name: 'GitHub',
    npmPackage: '@modelcontextprotocol/server-github',
    description: 'Interact with GitHub repos, issues, PRs and more.',
    category: 'Developer',
    icon: '🐙',
  },
  {
    id: 'memory',
    name: 'Memory',
    npmPackage: '@modelcontextprotocol/server-memory',
    description: 'Persistent key-value memory for AI agents.',
    category: 'Utilities',
    icon: '🧠',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    npmPackage: '@modelcontextprotocol/server-postgres',
    description: 'Query and manage PostgreSQL databases.',
    category: 'Database',
    icon: '🐘',
  },
  {
    id: 'slack',
    name: 'Slack',
    npmPackage: '@modelcontextprotocol/server-slack',
    description: 'Read and send messages in Slack workspaces.',
    category: 'Communication',
    icon: '💬',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    npmPackage: '@modelcontextprotocol/server-fetch',
    description: 'Fetch URLs and extract content from web pages.',
    category: 'Utilities',
    icon: '🌐',
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    npmPackage: '@modelcontextprotocol/server-puppeteer',
    description: 'Browser automation with headless Chrome.',
    category: 'Browser',
    icon: '🎭',
  },
];

// ── Status badge helper ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: McpServerConfig['status'] }) {
  const colors: Record<string, string> = {
    connected: '#22c55e',
    installed: '#3b82f6',
    installing: '#f59e0b',
    connecting: '#f59e0b',
    error: '#ef4444',
    stopped: '#94a3b8',
    'not-installed': '#d1d5db',
  };
  const labels: Record<string, string> = {
    connected: 'Connected',
    installed: 'Installed',
    installing: 'Installing…',
    connecting: 'Connecting…',
    error: 'Error',
    stopped: 'Stopped',
    'not-installed': 'Not installed',
  };
  return (
    <span className="mcp-status" title={labels[status] || status}>
      <span className="mcp-status-dot" style={{ background: colors[status] || '#d1d5db' }} />
      <span className="mcp-status-label">{labels[status] || status}</span>
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function McpServersPanel() {
  const backend = useBackend();
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPkg, setCustomPkg] = useState('');
  const [customName, setCustomName] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Load servers on mount ──
  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await backend.mcpLoadServers();
      setServers(result.servers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => { loadServers(); }, [loadServers]);

  // ── Helpers ──

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const addFromCatalog = async (entry: McpRegistryEntry) => {
    // Don't add duplicates
    if (servers.some(s => s.id === entry.id)) return;

    const config: McpServerConfig = {
      id: entry.id,
      name: entry.name,
      npmPackage: entry.npmPackage,
      status: 'not-installed',
      addedAt: new Date().toISOString(),
    };

    setServers(prev => [...prev, config]);
    setBusy(entry.id, true);
    setError(null);

    try {
      const result = await backend.mcpInstallServer(config);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === entry.id ? result.server : s));
      } else {
        setServers(prev => prev.map(s => s.id === entry.id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Install failed');
      }
    } catch (err: any) {
      setServers(prev => prev.map(s => s.id === entry.id ? { ...s, status: 'error', lastError: err.message } : s));
      setError(err.message);
    } finally {
      setBusy(entry.id, false);
    }
  };

  const addCustomServer = async () => {
    if (!customPkg.trim()) return;
    const id = customPkg.replace(/[@/]/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (servers.some(s => s.id === id)) { setError('Server already added'); return; }

    const config: McpServerConfig = {
      id,
      name: customName.trim() || customPkg.split('/').pop() || customPkg,
      npmPackage: customPkg.trim(),
      status: 'not-installed',
      addedAt: new Date().toISOString(),
    };

    setServers(prev => [...prev, config]);
    setShowCustom(false);
    setCustomPkg('');
    setCustomName('');
    setBusy(id, true);
    setError(null);

    try {
      const result = await backend.mcpInstallServer(config);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === id ? result.server : s));
      } else {
        setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Install failed');
      }
    } catch (err: any) {
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: err.message } : s));
      setError(err.message);
    } finally {
      setBusy(id, false);
    }
  };

  const connectServer = async (id: string) => {
    setBusy(id, true);
    setError(null);
    setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'connecting' } : s));

    try {
      const result = await backend.mcpConnectServer(id);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === id ? result.server! : s));
      } else {
        setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Connect failed');
      }
    } catch (err: any) {
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: err.message } : s));
      setError(err.message);
    } finally {
      setBusy(id, false);
    }
  };

  const disconnectServer = async (id: string) => {
    setBusy(id, true);
    try {
      await backend.mcpDisconnectServer(id);
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'stopped', tools: undefined, resources: undefined } : s));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(id, false);
    }
  };

  const removeServer = async (id: string) => {
    setBusy(id, true);
    try {
      await backend.mcpUninstallServer(id);
      setServers(prev => prev.filter(s => s.id !== id));
      if (expandedServer === id) setExpandedServer(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(id, false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedServer(prev => prev === id ? null : id);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mcp-panel">
      {/* Header */}
      <div className="mcp-panel-header">
        <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" style={{ color: '#7c3aed' }}>
          <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v2A1.5 1.5 0 0 0 2.5 7h3A1.5 1.5 0 0 0 7 5.5v-2A1.5 1.5 0 0 0 5.5 2h-3zM2 3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
          <path d="M10.5 2A1.5 1.5 0 0 0 9 3.5v2A1.5 1.5 0 0 0 10.5 7h3A1.5 1.5 0 0 0 15 5.5v-2A1.5 1.5 0 0 0 13.5 2h-3zM10 3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
          <path d="M2.5 9A1.5 1.5 0 0 0 1 10.5v2A1.5 1.5 0 0 0 2.5 14h3A1.5 1.5 0 0 0 7 12.5v-2A1.5 1.5 0 0 0 5.5 9h-3zM2 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
          <path d="M7 4.5h2v1H7zM4 7v2h1V7zM12 7v2h1V7zM7 11.5h2v1H7z"/>
          <path d="M10.5 9A1.5 1.5 0 0 0 9 10.5v2a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 13.5 9h-3zm-.5 1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
        </svg>
        <h2>MCP Servers</h2>
        <div className="mcp-header-actions">
          <button className="mcp-icon-btn" onClick={loadServers} disabled={loading} title="Refresh">
            <RefreshIcon className={loading ? 'spinning' : ''} />
          </button>
          <button className="mcp-icon-btn" onClick={() => { setShowCatalog(!showCatalog); setShowCustom(false); }} title="Add server">
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mcp-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Catalog dropdown */}
      {showCatalog && (
        <div className="mcp-catalog">
          <div className="mcp-catalog-header">
            <span className="mcp-catalog-title">📦 Server Catalog</span>
            <button className="mcp-text-btn" onClick={() => { setShowCustom(!showCustom); }}>
              Custom npm…
            </button>
          </div>

          {showCustom && (
            <div className="mcp-custom-form">
              <input
                className="mcp-input"
                placeholder="npm package (e.g. @org/server-name)"
                value={customPkg}
                onChange={e => setCustomPkg(e.target.value)}
              />
              <input
                className="mcp-input"
                placeholder="Display name (optional)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
              <div className="mcp-custom-form-actions">
                <button className="mcp-btn mcp-btn-primary" onClick={addCustomServer} disabled={!customPkg.trim()}>
                  Install
                </button>
                <button className="mcp-btn" onClick={() => setShowCustom(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="mcp-catalog-list">
            {CATALOG.map(entry => {
              const alreadyAdded = servers.some(s => s.id === entry.id);
              return (
                <div key={entry.id} className="mcp-catalog-item">
                  <div className="mcp-catalog-item-info">
                    <span className="mcp-catalog-icon">{entry.icon}</span>
                    <div>
                      <div className="mcp-catalog-item-name">{entry.name}</div>
                      <div className="mcp-catalog-item-desc">{entry.description}</div>
                    </div>
                  </div>
                  <button
                    className="mcp-btn mcp-btn-sm"
                    onClick={() => addFromCatalog(entry)}
                    disabled={alreadyAdded || busyIds.has(entry.id)}
                  >
                    {alreadyAdded ? '✓ Added' : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Installed servers list */}
      <div className="mcp-server-list">
        {servers.length === 0 && !loading && (
          <div className="mcp-empty">
            <p>No MCP servers configured.</p>
            <p className="mcp-hint">Click <strong>+</strong> above to browse the catalog or add a custom server.</p>
          </div>
        )}

        {servers.map(server => {
          const busy = busyIds.has(server.id);
          const expanded = expandedServer === server.id;
          const canConnect = server.status === 'installed' || server.status === 'stopped' || server.status === 'error';
          const canDisconnect = server.status === 'connected';

          return (
            <div key={server.id} className={`mcp-server-card${expanded ? ' expanded' : ''}`}>
              {/* Server header row */}
              <div className="mcp-server-row" onClick={() => toggleExpand(server.id)}>
                <span className="mcp-server-expand">
                  {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </span>
                <div className="mcp-server-info">
                  <span className="mcp-server-name">{server.name}</span>
                  <StatusDot status={server.status} />
                </div>
                <div className="mcp-server-actions" onClick={e => e.stopPropagation()}>
                  {canConnect && (
                    <button
                      className="mcp-btn mcp-btn-sm mcp-btn-connect"
                      onClick={() => connectServer(server.id)}
                      disabled={busy}
                      title="Connect"
                    >
                      {busy ? '…' : '▶'}
                    </button>
                  )}
                  {canDisconnect && (
                    <button
                      className="mcp-btn mcp-btn-sm mcp-btn-disconnect"
                      onClick={() => disconnectServer(server.id)}
                      disabled={busy}
                      title="Disconnect"
                    >
                      ■
                    </button>
                  )}
                  <button
                    className="mcp-icon-btn mcp-icon-btn-danger"
                    onClick={() => removeServer(server.id)}
                    disabled={busy}
                    title="Remove"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded && (
                <div className="mcp-server-details">
                  <div className="mcp-detail-row">
                    <span className="mcp-detail-label">Package:</span>
                    <span className="mcp-detail-value">{server.npmPackage}</span>
                  </div>

                  {server.lastError && (
                    <div className="mcp-detail-row mcp-detail-error">
                      <span className="mcp-detail-label">Error:</span>
                      <span className="mcp-detail-value">{server.lastError}</span>
                    </div>
                  )}

                  {/* Tools */}
                  {server.tools && server.tools.length > 0 && (
                    <div className="mcp-detail-section">
                      <div className="mcp-detail-section-title">🔧 Tools ({server.tools.length})</div>
                      {server.tools.map(tool => (
                        <div key={tool.name} className="mcp-tool-item">
                          <span className="mcp-tool-name">{tool.name}</span>
                          {tool.description && <span className="mcp-tool-desc">{tool.description}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resources */}
                  {server.resources && server.resources.length > 0 && (
                    <div className="mcp-detail-section">
                      <div className="mcp-detail-section-title">📄 Resources ({server.resources.length})</div>
                      {server.resources.map(res => (
                        <div key={res.uri} className="mcp-tool-item">
                          <span className="mcp-tool-name">{res.name}</span>
                          {res.description && <span className="mcp-tool-desc">{res.description}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {server.status === 'connected' && (!server.tools || server.tools.length === 0) && (!server.resources || server.resources.length === 0) && (
                    <div className="mcp-detail-empty">No tools or resources exposed by this server.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
