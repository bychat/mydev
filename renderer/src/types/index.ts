/**
 * Central type exports
 * Re-exports all types from domain-specific files for backward compatibility
 */

// File types
export type {
  TreeEntry,
  FolderResult,
  FileResult,
  SaveResult,
  Tab,
} from './file.types';

// Git types
export type {
  GitChange,
  GitFileChange,
  DiffResult,
  GitBranchInfo,
  GitOpResult,
} from './git.types';

// NPM types
export type { NpmProject } from './npm.types';

// AI and Chat types
export type {
  AISettings,
  ChatMessage,
  AIChatResult,
  FileActionPlan,
  FileActionStatus,
  FileActionProgress,
} from './ai.types';

// History types
export type {
  Conversation,
  WorkspaceHistory,
  AppHistory,
} from './history.types';

// Prompt types
export type { PromptSettings } from './prompts.types';
export { DEFAULT_PROMPTS } from './prompts.types';

// Supabase types
export type { SupabaseConfig } from './supabase.types';

// GitHub types
export type { 
  GitHubRepoInfo,
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubJob,
  GitHubStep,
  GitHubWorkflowsResult,
  GitHubRunsResult,
  GitHubJobsResult,
  GitHubLogsResult,
} from './github.types';

// UI types
export type { SidePanel, ChatMode } from './ui.types';

// Electron API types
export type { ElectronAPI } from './electron.types';
