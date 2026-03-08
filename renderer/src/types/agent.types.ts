/**
 * Agent Builder & Execution types
 *
 * Defines the data model for custom agent pipelines: phases, nodes,
 * tool selectors, and execution traces for full observability.
 */

// ── Phase & Node Definitions ──

export type PhaseCategory =
  | 'entry'
  | 'classification'
  | 'research'
  | 'planning'
  | 'execution'
  | 'verification'
  | 'output';

/** A single tool that can be enabled/disabled per node */
export interface AgentTool {
  id: string;
  label: string;
  /** Icon emoji or short identifier */
  icon: string;
  /** Which sidebar integration this maps to (if any) */
  integration?: 'filesystem' | 'git' | 'github' | 'atlassian' | 'supabase' | 'mcp' | 'search' | 'terminal' | 'npm';
  /** Whether this tool is enabled for this node */
  enabled: boolean;
}

/** A single node in an agent pipeline phase */
export interface AgentNode {
  id: string;
  label: string;
  description: string;
  category: PhaseCategory;
  icon: string;
  /** Key into prompt settings (if this node uses an LLM call) */
  promptKey?: string;
  /** Custom prompt override (if set, overrides the promptKey default) */
  customPrompt?: string;
  inputs?: string[];
  outputs?: string[];
  /** Tools available to this node */
  tools?: AgentTool[];
  /** Whether this node is enabled (can be toggled off) */
  enabled: boolean;
  /** Position on the visual canvas */
  position: { x: number; y: number };
}

/** An edge between two nodes */
export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

/** A complete agent pipeline configuration */
export interface AgentConfig {
  /** Unique agent ID */
  id: string;
  /** User-chosen name */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** Nodes in the pipeline */
  nodes: AgentNode[];
  /** Edges connecting nodes */
  edges: AgentEdge[];
  /** When this agent was created */
  createdAt: string;
  /** When this agent was last modified */
  updatedAt: string;
  /** Whether this is the built-in default (non-deletable) */
  isDefault?: boolean;
}

// ── Execution Trace Types ──

export type TraceStepStatus = 'running' | 'success' | 'error' | 'skipped';

/** A single trace entry — one LLM call or tool invocation */
export interface TraceStep {
  /** Unique step ID */
  id: string;
  /** Which node produced this step */
  nodeId: string;
  /** Node label for display */
  nodeLabel: string;
  /** Phase category for color coding */
  category: PhaseCategory;
  /** What kind of call this was */
  type: 'llm-call' | 'tool-call' | 'file-read' | 'file-write' | 'file-search' | 'text-search' | 'integration-call';
  /** Human-readable summary */
  summary: string;
  /** Input sent (prompt, tool args, etc.) */
  input?: unknown;
  /** Output received */
  output?: unknown;
  /** If it's a file-search, the files the model chose */
  chosenFiles?: string[];
  /** Why the model stopped (stop reason, token limit, etc.) */
  stopReason?: string;
  /** Token usage */
  tokens?: { prompt: number; completion: number; total: number };
  /** Duration in ms */
  durationMs?: number;
  /** Status */
  status: TraceStepStatus;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: string;
}

/** Full execution trace for one agent run */
export interface AgentTrace {
  /** Trace ID (matches the conversation message) */
  id: string;
  /** Agent config ID used */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** User's original request */
  userRequest: string;
  /** Ordered list of steps */
  steps: TraceStep[];
  /** Overall status */
  status: 'running' | 'success' | 'error';
  /** Total duration */
  totalDurationMs?: number;
  /** Started at */
  startedAt: string;
  /** Finished at */
  finishedAt?: string;
}

// ── All available tools (registry) ──

export const ALL_AGENT_TOOLS: AgentTool[] = [
  // ── Filesystem ──
  { id: 'file-read',       label: 'Read Files',          icon: '📖', integration: 'filesystem', enabled: true },
  { id: 'file-write',      label: 'Write Files',         icon: '💾', integration: 'filesystem', enabled: true },
  { id: 'file-search',     label: 'File Search',         icon: '🔍', integration: 'search',     enabled: true },
  { id: 'text-search',     label: 'Text Search (Grep)',   icon: '🔎', integration: 'search',     enabled: true },
  { id: 'file-tree',       label: 'Workspace Tree',      icon: '🌳', integration: 'filesystem', enabled: true },
  { id: 'file-create',     label: 'Create File/Folder',  icon: '📄', integration: 'filesystem', enabled: false },
  { id: 'file-delete',     label: 'Delete File/Folder',  icon: '🗑️', integration: 'filesystem', enabled: false },
  { id: 'file-rename',     label: 'Rename/Move',         icon: '✏️', integration: 'filesystem', enabled: false },
  // ── Git ──
  { id: 'git-status',      label: 'Git Status',          icon: '📊', integration: 'git',        enabled: false },
  { id: 'git-diff',        label: 'Git Diff',            icon: '📝', integration: 'git',        enabled: false },
  { id: 'git-stage',       label: 'Git Stage/Unstage',   icon: '📌', integration: 'git',        enabled: false },
  { id: 'git-commit',      label: 'Git Commit',          icon: '✅', integration: 'git',        enabled: false },
  { id: 'git-branch',      label: 'Git Branch Ops',      icon: '🌿', integration: 'git',        enabled: false },
  { id: 'git-push-pull',   label: 'Git Push/Pull',       icon: '🔄', integration: 'git',        enabled: false },
  // ── GitHub ──
  { id: 'github-issues',   label: 'GitHub Issues',       icon: '🐛', integration: 'github',     enabled: false },
  { id: 'github-actions',  label: 'GitHub Actions',      icon: '⚡', integration: 'github',     enabled: false },
  { id: 'github-workflows',label: 'GitHub Workflows',    icon: '🔁', integration: 'github',     enabled: false },
  { id: 'github-prs',      label: 'GitHub Pull Requests',icon: '🔀', integration: 'github',     enabled: false },
  // ── Atlassian / Jira ──
  { id: 'atlassian-issues', label: 'Jira Issues',        icon: '🔵', integration: 'atlassian',  enabled: false },
  { id: 'atlassian-projects',label: 'Jira Projects',     icon: '📁', integration: 'atlassian',  enabled: false },
  // ── Supabase ──
  { id: 'supabase-query',  label: 'Supabase SQL Query',  icon: '🗄️', integration: 'supabase',   enabled: false },
  { id: 'supabase-tables', label: 'Supabase Tables',     icon: '📋', integration: 'supabase',   enabled: false },
  { id: 'supabase-users',  label: 'Supabase Users',      icon: '👥', integration: 'supabase',   enabled: false },
  { id: 'supabase-storage',label: 'Supabase Storage',    icon: '📦', integration: 'supabase',   enabled: false },
  // ── MCP Servers ──
  { id: 'mcp-tools',       label: 'MCP Tool Call',       icon: '🔌', integration: 'mcp',        enabled: false },
  { id: 'mcp-resources',   label: 'MCP Resources',       icon: '📚', integration: 'mcp',        enabled: false },
  // ── Terminal & NPM ──
  { id: 'terminal',        label: 'Terminal Command',     icon: '🖥️', integration: 'terminal',   enabled: false },
  { id: 'npm-scripts',     label: 'NPM Scripts',         icon: '📦', integration: 'npm',        enabled: false },
  { id: 'npm-install',     label: 'NPM Install',         icon: '�', integration: 'npm',        enabled: false },
];
