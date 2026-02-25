/**
 * GitHubActionsTab - Displays GitHub Actions workflows and runs
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { 
  GitHubWorkflow, 
  GitHubWorkflowRun, 
  GitHubJob 
} from '../types/github.types';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  RefreshIcon,
  PlayIcon 
} from './icons';

// GitHub Icon component
const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Status badge component
function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  const getStatusColor = () => {
    if (status === 'completed') {
      switch (conclusion) {
        case 'success': return 'gh-status-success';
        case 'failure': return 'gh-status-failure';
        case 'cancelled': return 'gh-status-cancelled';
        case 'skipped': return 'gh-status-skipped';
        default: return 'gh-status-neutral';
      }
    }
    if (status === 'in_progress') return 'gh-status-running';
    if (status === 'queued') return 'gh-status-queued';
    return 'gh-status-neutral';
  };

  const getStatusText = () => {
    if (status === 'completed') return conclusion || 'completed';
    return status.replace('_', ' ');
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      switch (conclusion) {
        case 'success': return '✓';
        case 'failure': return '✕';
        case 'cancelled': return '⊘';
        case 'skipped': return '⊘';
        default: return '○';
      }
    }
    if (status === 'in_progress') return '●';
    if (status === 'queued') return '○';
    return '○';
  };

  return (
    <span className={`gh-status-badge ${getStatusColor()}`}>
      <span className="gh-status-icon">{getStatusIcon()}</span>
      <span className="gh-status-text">{getStatusText()}</span>
    </span>
  );
}

// Format date helper
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

// Format logs as context for AI
function formatLogsAsContext(jobName: string, logs: string): string {
  return `# GitHub Actions Job Logs: ${jobName}\n\n\`\`\`\n${logs}\n\`\`\``;
}

export default function GitHubActionsTab() {
  const { setTabData, openTabs, setActiveTabPath, folderPath } = useWorkspace();
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);
  const [workflows, setWorkflows] = useState<GitHubWorkflow[]>([]);
  const [runs, setRuns] = useState<GitHubWorkflowRun[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<GitHubWorkflow | null>(null);
  const [selectedRun, setSelectedRun] = useState<GitHubWorkflowRun | null>(null);
  const [jobs, setJobs] = useState<GitHubJob[]>([]);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract repo info from git remote
  useEffect(() => {
    const detectRepo = async () => {
      if (!folderPath) return;
      
      try {
        // Read git config to get remote URL
        const result = await window.electronAPI.readFile(`${folderPath}/.git/config`);
        if (result.success && result.content) {
          const remoteMatch = result.content.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
          if (remoteMatch) {
            const info = await window.electronAPI.githubExtractRepoInfo(remoteMatch[1].trim());
            if (info) {
              setRepoInfo(info);
              return;
            }
          }
        }
      } catch {
        // Ignore errors
      }
      
      setError('Could not detect GitHub repository. Make sure this is a GitHub project.');
      setLoading(false);
    };
    
    detectRepo();
  }, [folderPath]);

  // Load workflows when repo info is available
  useEffect(() => {
    if (!repoInfo) return;
    
    const loadWorkflows = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await window.electronAPI.githubListWorkflows(repoInfo.owner, repoInfo.repo);
        
        if (result.success) {
          setWorkflows(result.workflows);
          // Also load recent runs
          const runsResult = await window.electronAPI.githubListWorkflowRuns(repoInfo.owner, repoInfo.repo, undefined, 10);
          if (runsResult.success) {
            setRuns(runsResult.runs);
          }
        } else {
          setError(result.error || 'Failed to load workflows');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkflows();
  }, [repoInfo]);

  // Load runs for selected workflow
  const loadWorkflowRuns = async (workflow: GitHubWorkflow) => {
    if (!repoInfo) return;
    
    setSelectedWorkflow(workflow);
    setSelectedRun(null);
    setJobs([]);
    setLoadingRuns(true);
    
    try {
      const result = await window.electronAPI.githubListWorkflowRuns(
        repoInfo.owner, 
        repoInfo.repo, 
        workflow.id,
        20
      );
      
      if (result.success) {
        setRuns(result.runs);
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  // Load jobs for selected run
  const loadRunJobs = async (run: GitHubWorkflowRun) => {
    if (!repoInfo) return;
    
    setSelectedRun(run);
    setLoadingJobs(true);
    
    try {
      const result = await window.electronAPI.githubListRunJobs(repoInfo.owner, repoInfo.repo, run.id);
      
      if (result.success) {
        setJobs(result.jobs);
        // Auto-expand all jobs
        setExpandedJobs(new Set(result.jobs.map(j => j.id)));
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // View logs for a job
  const viewJobLogs = async (job: GitHubJob) => {
    if (!repoInfo) return;
    
    setLoadingLogs(job.id);
    
    try {
      const result = await window.electronAPI.githubGetJobLogs(repoInfo.owner, repoInfo.repo, job.id);
      
      if (result.success) {
        // Open logs in a new tab
        const tabKey = `github-logs:${job.id}`;
        const existing = openTabs.find(t => t.path === tabKey);
        
        if (!existing) {
          // Create the tab by setting its data
          setTabData(tabKey, formatLogsAsContext(job.name, result.logs));
        }
        
        // This will be handled by the workspace context
        // For now, we'll use a workaround - open as a preview tab
        openGitHubLogsTab(job.name, job.id, result.logs);
      } else {
        alert(result.error || 'Failed to fetch logs');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoadingLogs(null);
    }
  };

  // Open GitHub logs tab using workspace context
  const openGitHubLogsTab = (jobName: string, jobId: number, logs: string) => {
    const tabKey = `github-logs:${jobId}`;
    
    // Use setTabData to create/update the tab content
    // The tab opening needs to be handled by workspace context
    // For now we'll trigger a custom event or use existing mechanism
    
    // Create a custom way to open the tab
    const event = new CustomEvent('open-github-logs-tab', {
      detail: { jobName, jobId, logs }
    });
    window.dispatchEvent(event);
  };

  // Rerun workflow
  const rerunWorkflow = async (run: GitHubWorkflowRun) => {
    if (!repoInfo) return;
    
    try {
      const result = await window.electronAPI.githubRerunWorkflow(repoInfo.owner, repoInfo.repo, run.id);
      
      if (result.success) {
        // Refresh runs
        if (selectedWorkflow) {
          loadWorkflowRuns(selectedWorkflow);
        }
      } else {
        alert(result.error || 'Failed to rerun workflow');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rerun');
    }
  };

  // Refresh all data
  const refresh = async () => {
    if (!repoInfo) return;
    
    setLoading(true);
    
    try {
      const result = await window.electronAPI.githubListWorkflows(repoInfo.owner, repoInfo.repo);
      if (result.success) {
        setWorkflows(result.workflows);
      }
      
      const runsResult = await window.electronAPI.githubListWorkflowRuns(
        repoInfo.owner, 
        repoInfo.repo, 
        selectedWorkflow?.id,
        20
      );
      if (runsResult.success) {
        setRuns(runsResult.runs);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleJob = (jobId: number) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  return (
    <div className="gh-actions-tab">
      <div className="gh-actions-header">
        <div className="gh-actions-title">
          <GitHubIcon size={20} />
          <h2>GitHub Actions</h2>
          {repoInfo && (
            <span className="gh-repo-name">{repoInfo.owner}/{repoInfo.repo}</span>
          )}
        </div>
        <button 
          className="gh-refresh-btn" 
          onClick={refresh} 
          disabled={loading}
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {loading && !workflows.length && (
        <div className="gh-loading">
          <div className="sb-spinner"></div>
          <span>Loading workflows...</span>
        </div>
      )}

      {error && (
        <div className="gh-error">
          <span className="gh-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && workflows.length === 0 && (
        <div className="gh-empty">
          <span>📭</span>
          <p>No workflows found</p>
          <p className="gh-empty-hint">Add workflow files to .github/workflows/</p>
        </div>
      )}

      {/* Main content area with workflows and runs */}
      {!error && (workflows.length > 0 || runs.length > 0) && (
        <div className="gh-content">
          {/* Workflows list */}
          <div className="gh-section">
            <div className="gh-section-header">
              <span>Workflows</span>
              <span className="gh-section-count">{workflows.length}</span>
            </div>
            <div className="gh-workflows-list">
              {workflows.map(workflow => (
                <button
                  key={workflow.id}
                  className={`gh-workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''}`}
                  onClick={() => loadWorkflowRuns(workflow)}
                >
                  <span className="gh-workflow-name">{workflow.name}</span>
                  <span className={`gh-workflow-state ${workflow.state}`}>
                    {workflow.state === 'active' ? '●' : '○'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Runs list */}
          <div className="gh-section">
            <div className="gh-section-header">
              <span>{selectedWorkflow ? `${selectedWorkflow.name} Runs` : 'Recent Runs'}</span>
              {loadingRuns && <RefreshIcon size={12} className="spinning" />}
            </div>
            <div className="gh-runs-list">
              {runs.map(run => (
                <button
                  key={run.id}
                  className={`gh-run-item ${selectedRun?.id === run.id ? 'active' : ''}`}
                  onClick={() => loadRunJobs(run)}
                >
                  <div className="gh-run-info">
                    <StatusBadge status={run.status} conclusion={run.conclusion} />
                    <span className="gh-run-name">{run.name}</span>
                  </div>
                  <div className="gh-run-meta">
                    <span className="gh-run-branch">{run.head_branch}</span>
                    <span className="gh-run-time">{formatDate(run.created_at)}</span>
                  </div>
                  <div className="gh-run-actions">
                    <button 
                      className="gh-run-action-btn"
                      onClick={(e) => { e.stopPropagation(); rerunWorkflow(run); }}
                      title="Re-run"
                    >
                      <PlayIcon size={10} />
                    </button>
                  </div>
                </button>
              ))}
              {runs.length === 0 && !loadingRuns && (
                <div className="gh-empty-small">No runs found</div>
              )}
            </div>
          </div>

          {/* Jobs and Steps */}
          {selectedRun && (
            <div className="gh-section gh-jobs-section">
              <div className="gh-section-header">
                <span>Jobs</span>
                {loadingJobs && <RefreshIcon size={12} className="spinning" />}
              </div>
              <div className="gh-jobs-list">
                {jobs.map(job => (
                  <div key={job.id} className="gh-job-item">
                    <button 
                      className="gh-job-header"
                      onClick={() => toggleJob(job.id)}
                    >
                      <span className="gh-job-chevron">
                        {expandedJobs.has(job.id) ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                      </span>
                      <StatusBadge status={job.status} conclusion={job.conclusion} />
                      <span className="gh-job-name">{job.name}</span>
                      <button
                        className="gh-logs-btn"
                        onClick={(e) => { e.stopPropagation(); viewJobLogs(job); }}
                        disabled={loadingLogs === job.id}
                        title="View logs"
                      >
                        {loadingLogs === job.id ? '...' : '📋'}
                      </button>
                    </button>
                    
                    {expandedJobs.has(job.id) && job.steps && (
                      <div className="gh-steps-list">
                        {job.steps.map(step => (
                          <div key={step.number} className="gh-step-item">
                            <StatusBadge status={step.status} conclusion={step.conclusion} />
                            <span className="gh-step-name">{step.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {jobs.length === 0 && !loadingJobs && (
                  <div className="gh-empty-small">No jobs found</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
