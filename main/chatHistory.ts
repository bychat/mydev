import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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

// ── Storage ──

const HISTORY_FILE = (): string => path.join(app.getPath('userData'), 'chat-history.json');
const HISTORY_VERSION = 1;

function createDefaultHistory(): AppHistory {
  return {
    version: HISTORY_VERSION,
    workspaces: [],
    lastWorkspacePath: null,
  };
}

export function loadAppHistory(): AppHistory {
  try {
    const data = fs.readFileSync(HISTORY_FILE(), 'utf-8');
    const history = JSON.parse(data) as AppHistory;
    // Version migration if needed
    if (!history.version || history.version < HISTORY_VERSION) {
      // For now, just reset if incompatible
      return createDefaultHistory();
    }
    return history;
  } catch {
    return createDefaultHistory();
  }
}

export function saveAppHistory(history: AppHistory): void {
  try {
    fs.writeFileSync(HISTORY_FILE(), JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChatHistory] Failed to save history:', err);
  }
}

// ── Workspace Operations ──

export function getOrCreateWorkspace(history: AppHistory, folderPath: string): WorkspaceHistory {
  let workspace = history.workspaces.find(w => w.folderPath === folderPath);
  if (!workspace) {
    const folderName = folderPath.split('/').pop() ?? folderPath.split('\\').pop() ?? folderPath;
    workspace = {
      folderPath,
      folderName,
      lastOpened: new Date().toISOString(),
      conversations: [],
      activeConversationId: null,
    };
    history.workspaces.push(workspace);
  } else {
    workspace.lastOpened = new Date().toISOString();
  }
  history.lastWorkspacePath = folderPath;
  return workspace;
}

export function getRecentWorkspaces(history: AppHistory, limit = 10): WorkspaceHistory[] {
  return [...history.workspaces]
    .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
    .slice(0, limit);
}

export function removeWorkspace(history: AppHistory, folderPath: string): void {
  history.workspaces = history.workspaces.filter(w => w.folderPath !== folderPath);
  if (history.lastWorkspacePath === folderPath) {
    history.lastWorkspacePath = history.workspaces[0]?.folderPath ?? null;
  }
}

// ── Conversation Operations ──

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateTitle(messages: ChatMessage[]): string {
  // Use the first user message as the title, truncated
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const text = firstUserMsg.content.replace(/\n/g, ' ').trim();
    return text.length > 50 ? text.substring(0, 47) + '...' : text;
  }
  return 'New Chat';
}

export function createConversation(workspace: WorkspaceHistory, mode: 'Agent' | 'Chat' | 'Edit' = 'Agent'): Conversation {
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: generateId(),
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    mode,
  };
  workspace.conversations.unshift(conv); // Add to beginning
  workspace.activeConversationId = conv.id;
  return conv;
}

export function getConversation(workspace: WorkspaceHistory, conversationId: string): Conversation | null {
  return workspace.conversations.find(c => c.id === conversationId) ?? null;
}

export function getActiveConversation(workspace: WorkspaceHistory): Conversation | null {
  if (!workspace.activeConversationId) return null;
  return getConversation(workspace, workspace.activeConversationId);
}

export function updateConversation(
  workspace: WorkspaceHistory,
  conversationId: string,
  messages: ChatMessage[],
  mode?: 'Agent' | 'Chat' | 'Edit'
): Conversation | null {
  const conv = getConversation(workspace, conversationId);
  if (!conv) return null;
  
  conv.messages = messages;
  conv.updatedAt = new Date().toISOString();
  conv.title = generateTitle(messages);
  if (mode) conv.mode = mode;
  
  return conv;
}

export function deleteConversation(workspace: WorkspaceHistory, conversationId: string): void {
  workspace.conversations = workspace.conversations.filter(c => c.id !== conversationId);
  if (workspace.activeConversationId === conversationId) {
    workspace.activeConversationId = workspace.conversations[0]?.id ?? null;
  }
}

export function setActiveConversation(workspace: WorkspaceHistory, conversationId: string): void {
  const conv = getConversation(workspace, conversationId);
  if (conv) {
    workspace.activeConversationId = conversationId;
  }
}

export function renameConversation(workspace: WorkspaceHistory, conversationId: string, newTitle: string): void {
  const conv = getConversation(workspace, conversationId);
  if (conv) {
    conv.title = newTitle;
    conv.updatedAt = new Date().toISOString();
  }
}
