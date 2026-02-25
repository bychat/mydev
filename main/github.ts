/**
 * GitHub API integration module
 * Handles GitHub Actions workflows, runs, and logs
 */

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled' | 'deleted' | string;
  created_at: string;
  updated_at: string;
  html_url: string;
  badge_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  run_number: number;
  run_attempt: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  jobs_url: string;
  logs_url: string;
  event: string;
  actor: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubJob {
  id: number;
  run_id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  started_at: string | null;
  completed_at: string | null;
  steps: GitHubStep[];
}

export interface GitHubStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface GitHubWorkflowsResult {
  success: boolean;
  workflows: GitHubWorkflow[];
  error?: string;
}

export interface GitHubRunsResult {
  success: boolean;
  runs: GitHubWorkflowRun[];
  total_count: number;
  error?: string;
}

export interface GitHubJobsResult {
  success: boolean;
  jobs: GitHubJob[];
  error?: string;
}

export interface GitHubLogsResult {
  success: boolean;
  logs: string;
  error?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: { id: number; name: string; color: string }[];
  user: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubIssuesResult {
  success: boolean;
  issues: GitHubIssue[];
  error?: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/**
 * Extract GitHub repo info from git remote URL
 */
export function extractRepoInfo(remoteUrl: string): GitHubRepoInfo | null {
  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  
  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  
  return null;
}

/**
 * Get GitHub token from environment or git credential helper
 */
async function getGitHubToken(): Promise<string | null> {
  // Check environment variables
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;
  
  // Try to get from git credential helper
  try {
    const { execSync } = await import('child_process');
    const result = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n',
      encoding: 'utf-8',
      timeout: 5000,
    });
    const passwordMatch = result.match(/password=(.+)/);
    if (passwordMatch) return passwordMatch[1].trim();
  } catch {
    // Ignore errors
  }
  
  return null;
}

/**
 * Make authenticated GitHub API request
 */
async function githubFetch<T>(endpoint: string, token?: string): Promise<{ data: T | null; error?: string }> {
  const authToken = token || await getGitHubToken();
  
  if (!authToken) {
    return { data: null, error: 'GitHub token not found. Set GITHUB_TOKEN environment variable.' };
  }
  
  try {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `GitHub API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Use default error message
      }
      return { data: null, error: errorMessage };
    }
    
    const data = await response.json() as T;
    return { data };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch logs with special handling (returns text/plain)
 */
async function githubFetchLogs(endpoint: string, token?: string): Promise<{ data: string | null; error?: string }> {
  const authToken = token || await getGitHubToken();
  
  if (!authToken) {
    return { data: null, error: 'GitHub token not found. Set GITHUB_TOKEN environment variable.' };
  }
  
  try {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      return { data: null, error: `GitHub API error: ${response.status}` };
    }
    
    // GitHub returns a redirect to the actual log URL
    // The fetch with redirect: 'follow' should handle this
    // But we might get a zip file for run logs
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/zip')) {
      // For zip files, we need to extract the content
      // For now, return a message about downloading
      return { data: '[Logs are in ZIP format. Download to view.]', error: undefined };
    }
    
    const text = await response.text();
    return { data: text };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List workflows for a repository
 */
export async function listWorkflows(owner: string, repo: string): Promise<GitHubWorkflowsResult> {
  const result = await githubFetch<{ workflows: GitHubWorkflow[] }>(
    `/repos/${owner}/${repo}/actions/workflows`
  );
  
  if (result.error || !result.data) {
    return { success: false, workflows: [], error: result.error };
  }
  
  return { success: true, workflows: result.data.workflows || [] };
}

/**
 * List workflow runs
 */
export async function listWorkflowRuns(
  owner: string, 
  repo: string, 
  workflowId?: number,
  perPage: number = 10
): Promise<GitHubRunsResult> {
  const endpoint = workflowId 
    ? `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}`
    : `/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;
    
  const result = await githubFetch<{ workflow_runs: GitHubWorkflowRun[]; total_count: number }>(endpoint);
  
  if (result.error || !result.data) {
    return { success: false, runs: [], total_count: 0, error: result.error };
  }
  
  return { 
    success: true, 
    runs: result.data.workflow_runs || [], 
    total_count: result.data.total_count || 0 
  };
}

/**
 * List jobs for a workflow run
 */
export async function listRunJobs(owner: string, repo: string, runId: number): Promise<GitHubJobsResult> {
  const result = await githubFetch<{ jobs: GitHubJob[] }>(
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
  );
  
  if (result.error || !result.data) {
    return { success: false, jobs: [], error: result.error };
  }
  
  return { success: true, jobs: result.data.jobs || [] };
}

/**
 * Get logs for a workflow run
 */
export async function getRunLogs(owner: string, repo: string, runId: number): Promise<GitHubLogsResult> {
  const result = await githubFetchLogs(`/repos/${owner}/${repo}/actions/runs/${runId}/logs`);
  
  if (result.error || result.data === null) {
    return { success: false, logs: '', error: result.error };
  }
  
  return { success: true, logs: result.data };
}

/**
 * Get logs for a specific job
 */
export async function getJobLogs(owner: string, repo: string, jobId: number): Promise<GitHubLogsResult> {
  const result = await githubFetchLogs(`/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`);
  
  if (result.error || result.data === null) {
    return { success: false, logs: '', error: result.error };
  }
  
  return { success: true, logs: result.data };
}

/**
 * List issues for a repository
 */
export async function listIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  perPage: number = 20
): Promise<GitHubIssuesResult> {
  const result = await githubFetch<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&sort=updated&direction=desc`
  );
  
  if (result.error || !result.data) {
    return { success: false, issues: [], error: result.error };
  }
  
  // Filter out pull requests (GitHub API returns PRs in issues endpoint)
  const issues = result.data.filter((item: any) => !item.pull_request);
  
  return { success: true, issues };
}

/**
 * Re-run a workflow
 */
export async function rerunWorkflow(owner: string, repo: string, runId: number): Promise<{ success: boolean; error?: string }> {
  const token = await getGitHubToken();
  
  if (!token) {
    return { success: false, error: 'GitHub token not found' };
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to rerun: ${response.status} - ${errorText}` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
