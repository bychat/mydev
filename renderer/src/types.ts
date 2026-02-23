export interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeEntry[];
}

export interface FolderResult {
  folderPath: string;
  tree: TreeEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  gitIgnoredPaths: string[];
}

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface Tab {
  name: string;
  path: string;
  content: string;
  modified: boolean;
  readOnly?: boolean;
}

export interface GitChange {
  file: string;
  status: string;
}

export interface GitFileChange {
  file: string;
  status: string;
  staged: boolean;
}

export interface DiffResult {
  oldContent: string;
  newContent: string;
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

export interface GitOpResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface NpmProject {
  name: string;
  relativePath: string;
  absolutePath: string;
  scripts: Record<string, string>;
}

export type SidePanel = 'explorer' | 'search' | 'source-control' | 'npm';

export interface AISettings {
  provider: 'ollama' | 'openai';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Original display text (for user messages, this is the text without embedded file context) */
  displayText?: string;
}

export interface AIChatResult {
  success: boolean;
  reply?: string;
  error?: string;
}

/** A single planned file action from the check agent */
export interface FileActionPlan {
  file: string;          // relative path
  action: 'create' | 'update' | 'delete';
  description: string;   // what changes to make
}

/** Progress state for a file action */
export type FileActionStatus = 'pending' | 'reading' | 'updating' | 'done' | 'error';

export interface FileActionProgress {
  plan: FileActionPlan;
  status: FileActionStatus;
  diff?: { before: string; after: string };
  error?: string;
}

// ── Chat History Types ──

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  mode: 'Agent' | 'Chat' | 'Edit';
}

export interface WorkspaceHistory {
  folderPath: string;
  folderName: string;
  lastOpened: string;
  conversations: Conversation[];
  activeConversationId: string | null;
}

export interface AppHistory {
  version: number;
  workspaces: WorkspaceHistory[];
  lastWorkspacePath: string | null;
}

// ── Prompt Settings Types ──

export interface PromptSettings {
  systemPrompt: string;
  researchAgentPrompt: string;
  checkAgentPrompt: string;
  actionPlannerPrompt: string;
  codeEditorPrompt: string;
  verificationPrompt: string;
  commitMessagePrompt: string;
}

export const DEFAULT_PROMPTS: PromptSettings = {
  systemPrompt: `You are an expert coding assistant inside the "mydev.bychat.io" desktop IDE.

Use this workspace context to give precise, file-aware answers. When referencing files, use the exact relative paths listed above.`,

  researchAgentPrompt: `You are a code research agent. Your job is to decide which files from the workspace are most relevant to the user's question.

Based on the user's question, choose between 4 and 9 files that are most relevant to answering it.
Return ONLY a valid JSON array of relative file paths. No explanation, no markdown fences, just the JSON array.
Example: ["src/index.ts", "package.json", "README.md", "src/utils/helper.ts"]`,

  checkAgentPrompt: `You are a triage agent inside a coding IDE. Your ONLY job is to decide whether the user's latest message requires creating, modifying, or deleting files in the workspace.

Reply with ONLY a valid JSON object — no markdown fences, no explanation:
{ "needsFileChanges": true | false }

Examples that need file changes: "add a dark mode toggle", "fix the bug in auth.ts", "create a new component", "refactor the utils", "update the README".
Examples that do NOT need file changes: "explain how X works", "what does this function do", "summarize the project", "how do I run this".`,

  actionPlannerPrompt: `You are a code planning agent. The user wants to make changes to their codebase.

Based on the conversation and the user's latest request, determine which files need to be created, updated, or deleted.
Return ONLY a valid JSON array of action objects. No explanation, no markdown fences.
Each object: { "file": "<relative path>", "action": "create"|"update"|"delete", "description": "<brief description of what to change>" }

Example: [{"file":"src/utils/auth.ts","action":"update","description":"Add password validation function"},{"file":"src/components/Login.tsx","action":"create","description":"Create login form component"}]

Keep the list focused — only include files that truly need changes. Max 10 files.`,

  codeEditorPrompt: `You are a precise code editor. You must apply targeted changes to the file using SEARCH/REPLACE blocks.

Return ONLY one or more SEARCH/REPLACE blocks. Each block looks like:

<<<<<<< SEARCH
exact lines from the current file to find
=======
replacement lines
>>>>>>> REPLACE

Rules:
- The SEARCH section must match the current file EXACTLY (including whitespace).
- Include 2-3 lines of unchanged context around each change for precision.
- Use multiple blocks for multiple changes.
- Do NOT return the whole file. Only return SEARCH/REPLACE blocks.
- No markdown fences around the blocks, no explanation text.`,

  verificationPrompt: `You are a verification agent. The following file changes were just applied to fulfill the user's request.

Evaluate whether these changes fully satisfy the user's request.
Reply with ONLY a valid JSON object:
{ "satisfied": true | false, "reason": "<brief explanation>", "missingChanges": [] }

If not satisfied, list the missing changes as objects: { "file": "path", "action": "create|update|delete", "description": "what's missing" }`,

  commitMessagePrompt: `You are a helpful assistant that writes concise, conventional git commit messages.
Follow the Conventional Commits format: type(scope): description
Keep it under 72 characters for the subject line. If needed, add a blank line then a short body (2-3 bullet points max).
Return ONLY the commit message text, nothing else — no markdown fences, no explanation.`,
};

export interface ElectronAPI {
  // Window management
  newWindow: () => Promise<boolean>;
  selectFolder: () => Promise<FolderResult | null>;
  openFolder: (folderPath: string) => Promise<FolderResult | null>;
  readFile: (filePath: string) => Promise<FileResult>;
  saveFile: (filePath: string, content: string) => Promise<SaveResult>;
  gitStatus: (folderPath: string) => Promise<GitChange[]>;
  gitStatusSplit: (folderPath: string) => Promise<GitFileChange[]>;
  gitDiff: (folderPath: string, filePath: string) => Promise<DiffResult>;
  gitStage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitUnstage: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitStageAll: (folderPath: string) => Promise<SaveResult>;
  gitUnstageAll: (folderPath: string) => Promise<SaveResult>;
  gitDiscard: (folderPath: string, filePath: string) => Promise<SaveResult>;
  gitCommit: (folderPath: string, message: string) => Promise<SaveResult>;
  gitBranchInfo: (folderPath: string) => Promise<GitBranchInfo>;
  gitListBranches: (folderPath: string) => Promise<string[]>;
  gitCheckout: (folderPath: string, branch: string) => Promise<SaveResult>;
  gitCreateBranch: (folderPath: string, branch: string) => Promise<SaveResult>;
  gitPull: (folderPath: string) => Promise<GitOpResult>;
  gitPush: (folderPath: string) => Promise<GitOpResult>;
  getAllNpmProjects: (folderPath: string, gitIgnoredPaths: string[]) => Promise<NpmProject[]>;
  aiCheckOllama: () => Promise<boolean>;
  aiListModels: (baseUrl: string, apiKey: string) => Promise<string[]>;
  aiChat: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  aiChatStream: (baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
  onAiChatChunk: (cb: (chunk: string) => void) => () => void;
  onAiChatChunkDone: (cb: () => void) => () => void;
  aiChatAbort: () => Promise<{ success: boolean }>;
  aiLoadSettings: () => Promise<AISettings>;
  aiSaveSettings: (settings: AISettings) => Promise<{ success: boolean }>;
  // Prompt Settings
  promptsLoad: () => Promise<PromptSettings>;
  promptsSave: (prompts: PromptSettings) => Promise<{ success: boolean }>;
  promptsReset: () => Promise<PromptSettings>;
  // Debug
  debugOpen: () => Promise<{ success: boolean }>;
  debugClear: () => Promise<{ success: boolean }>;
  // Terminal
  terminalCreate: (cwd: string) => Promise<{ id: string; shell: string }>;
  terminalInput: (id: string, data: string) => void;
  terminalResize: (id: string, cols: number, rows: number) => void;
  terminalKill: (id: string) => Promise<void>;
  onTerminalData: (cb: (id: string, data: string) => void) => () => void;
  onTerminalExit: (cb: (id: string) => void) => () => void;
  onToggleTerminal: (cb: () => void) => () => void;
  onOpenPrompts: (cb: () => void) => () => void;
  onOpenDebug: (cb: () => void) => () => void;
  // Chat History
  historyLoad: () => Promise<AppHistory>;
  historyGetRecentWorkspaces: (limit?: number) => Promise<WorkspaceHistory[]>;
  historyOpenWorkspace: (folderPath: string) => Promise<WorkspaceHistory>;
  historyRemoveWorkspace: (folderPath: string) => Promise<{ success: boolean }>;
  historyCreateConversation: (folderPath: string, mode: 'Agent' | 'Chat' | 'Edit') => Promise<Conversation>;
  historyGetConversation: (folderPath: string, conversationId: string) => Promise<Conversation | null>;
  historyGetActiveConversation: (folderPath: string) => Promise<Conversation | null>;
  historyUpdateConversation: (folderPath: string, conversationId: string, messages: ChatMessage[], mode?: 'Agent' | 'Chat' | 'Edit') => Promise<Conversation | null>;
  historyDeleteConversation: (folderPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>;
  historySetActiveConversation: (folderPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>;
  historyRenameConversation: (folderPath: string, conversationId: string, newTitle: string) => Promise<{ success: boolean; error?: string }>;
  historyGetWorkspace: (folderPath: string) => Promise<WorkspaceHistory | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
