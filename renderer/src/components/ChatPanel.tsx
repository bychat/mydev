import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import type { AISettings, ChatMessage, FileActionPlan, FileActionProgress, FileActionStatus, Conversation, WorkspaceHistory } from '../types';
import SettingsModal from './SettingsModal';
import Markdown, { flattenTree } from './Markdown';
import { useWorkspace } from '../context/WorkspaceContext';
import ChatHistorySidebar from './ChatHistorySidebar';

type ChatMode = 'Agent' | 'Chat' | 'Edit';

/** findLastIndex polyfill for ES2020 targets */
function findLastIdx<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface DisplayMessage {
  text: string;
  sender: 'user' | 'bot' | 'system';
  files?: AttachedFile[];
  isResearchStatus?: boolean;
  /** Follow-up agent progress tracking */
  isAgentProgress?: boolean;
  agentActions?: FileActionProgress[];
  verifyAttempt?: number;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋', css: '🎨', html: '🌐',
    md: '📝', py: '🐍', rs: '🦀', go: '🐹', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '🖥', bash: '🖥', zsh: '🖥', txt: '📄', svg: '🖼', png: '🖼', jpg: '🖼',
  };
  return map[ext] ?? '📄';
}

/** Strip markdown fences from AI output */
function stripMarkdownFences(text: string): string {
  let s = text.trim();
  // Remove opening fence (``` or ```lang)
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
  }
  // Remove closing fence
  if (s.endsWith('```')) {
    const lastNewline = s.lastIndexOf('\n', s.length - 4);
    if (lastNewline !== -1) s = s.slice(0, lastNewline);
    else s = s.slice(0, -3);
  }
  return s;
}

/** Parse SEARCH/REPLACE blocks from AI response */
function parseSearchReplaceBlocks(text: string): { search: string; replace: string }[] {
  const blocks: { search: string; replace: string }[] = [];
  // Strip outer markdown fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = stripMarkdownFences(cleaned);

  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }
  return blocks;
}

/** Apply SEARCH/REPLACE blocks to file content */
function applySearchReplaceBlocks(content: string, blocks: { search: string; replace: string }[]): string {
  let result = content;
  for (const block of blocks) {
    const idx = result.indexOf(block.search);
    if (idx !== -1) {
      result = result.slice(0, idx) + block.replace + result.slice(idx + block.search.length);
    } else {
      // Fuzzy fallback — try trimmed matching line by line
      const searchLines = block.search.split('\n').map(l => l.trimEnd());
      const resultLines = result.split('\n');
      let startIdx = -1;
      for (let i = 0; i <= resultLines.length - searchLines.length; i++) {
        let found = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (resultLines[i + j].trimEnd() !== searchLines[j]) {
            found = false;
            break;
          }
        }
        if (found) {
          startIdx = i;
          break;
        }
      }
      if (startIdx !== -1) {
        const before = resultLines.slice(0, startIdx);
        const after = resultLines.slice(startIdx + searchLines.length);
        result = [...before, block.replace, ...after].join('\n');
      }
      // If still no match, skip this block silently
    }
  }
  return result;
}

/** Compact diff display — shows a simple unified diff between before/after */
function computeSimpleDiff(before: string, after: string): { added: string[]; removed: string[] } {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const removed = beforeLines.filter(l => !afterSet.has(l)).slice(0, 12);
  const added = afterLines.filter(l => !beforeSet.has(l)).slice(0, 12);
  return { added, removed };
}

/** Single file action progress row with collapsible diff */
function AgentActionRow({ action, onFileClick }: { action: FileActionProgress; onFileClick: (f: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = () => {
    switch (action.status) {
      case 'pending': return '⏳';
      case 'reading': return '📖';
      case 'updating': return '✏️';
      case 'done': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const statusLabel = () => {
    switch (action.status) {
      case 'pending': return 'Pending';
      case 'reading': return 'Reading…';
      case 'updating': return 'Updating…';
      case 'done': return 'Done';
      case 'error': return 'Error';
      default: return '';
    }
  };

  const hasDiff = action.status === 'done' && action.diff;
  const diff = hasDiff ? computeSimpleDiff(action.diff!.before, action.diff!.after) : null;

  return (
    <div className={`agent-action-row status-${action.status}`}>
      <div className="agent-action-header" onClick={() => hasDiff && setExpanded(!expanded)}>
        <span className="agent-action-icon">{statusIcon()}</span>
        <span
          className="agent-action-file"
          onClick={(e) => { e.stopPropagation(); onFileClick(action.plan.file); }}
          title={`Open ${action.plan.file}`}
        >
          {fileIcon(action.plan.file)} {action.plan.file}
        </span>
        <span className="agent-action-badge">{action.plan.action}</span>
        <span className="agent-action-status">{statusLabel()}</span>
        {(action.status === 'reading' || action.status === 'updating') && (
          <span className="agent-spinner" />
        )}
        {hasDiff && (
          <span className="agent-action-toggle">{expanded ? '▾' : '▸'}</span>
        )}
      </div>
      {action.error && (
        <div className="agent-action-error">{action.error}</div>
      )}
      {expanded && diff && (
        <div className="agent-diff">
          {diff.removed.map((line, k) => (
            <div key={`r${k}`} className="diff-removed">- {line}</div>
          ))}
          {diff.added.map((line, k) => (
            <div key={`a${k}`} className="diff-added">+ {line}</div>
          ))}
          {((action.diff!.before.split('\n').length > 12) || (action.diff!.after.split('\n').length > 12)) && (
            <div className="diff-truncated">… (diff truncated)</div>
          )}
        </div>
      )}
      <div className="agent-action-desc">{action.plan.description}</div>
    </div>
  );
}

interface ChatPanelProps {
  onCollapse?: () => void;
}

export default function ChatPanel({ onCollapse }: ChatPanelProps) {
  const { openTabs, activeTabPath, tree, folderPath, openFile, setActivePanel, gitIgnoredPaths } = useWorkspace();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ChatMode>('Agent');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);

  // ── Chat History State ──
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceHistory | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Load workspace history when folder changes
  useEffect(() => {
    if (!folderPath) {
      setWorkspaceHistory(null);
      setActiveConversationId(null);
      return;
    }
    (async () => {
      try {
        const ws = await window.electronAPI.historyOpenWorkspace(folderPath);
        setWorkspaceHistory(ws);
        // Load active conversation if exists
        if (ws.activeConversationId) {
          const conv = await window.electronAPI.historyGetConversation(folderPath, ws.activeConversationId);
          if (conv) {
            setActiveConversationId(conv.id);
            setMode(conv.mode);
            // Restore messages from conversation
            const displayMsgs: DisplayMessage[] = conv.messages
              .filter(m => m.role !== 'system')
              .map(m => ({
                // For user messages, use displayText if available (original user input without file context)
                text: m.role === 'user' && m.displayText ? m.displayText : m.content,
                sender: m.role === 'user' ? 'user' : 'bot',
              }));
            setMessages(displayMsgs);
            setHistory(conv.messages);
          }
        }
      } catch (err) {
        console.error('[ChatPanel] Failed to load workspace history:', err);
      }
    })();
  }, [folderPath]);

  // Save conversation whenever history changes
  const saveConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!folderPath || !activeConversationId) return;
    try {
      const updated = await window.electronAPI.historyUpdateConversation(
        folderPath,
        activeConversationId,
        msgs,
        mode
      );
      if (updated && workspaceHistory) {
        // Update local state
        const idx = workspaceHistory.conversations.findIndex(c => c.id === activeConversationId);
        if (idx >= 0) {
          const newConvs = [...workspaceHistory.conversations];
          newConvs[idx] = updated;
          setWorkspaceHistory({ ...workspaceHistory, conversations: newConvs });
        }
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to save conversation:', err);
    }
  }, [folderPath, activeConversationId, mode, workspaceHistory]);

  // Create new conversation
  const handleNewChat = useCallback(async () => {
    if (!folderPath) return;
    try {
      const conv = await window.electronAPI.historyCreateConversation(folderPath, mode);
      setActiveConversationId(conv.id);
      setMessages([]);
      setHistory([]);
      setAttachedFiles([]);
      // Update workspace history
      if (workspaceHistory) {
        setWorkspaceHistory({
          ...workspaceHistory,
          conversations: [conv, ...workspaceHistory.conversations],
          activeConversationId: conv.id,
        });
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to create conversation:', err);
    }
  }, [folderPath, mode, workspaceHistory]);

  // Select existing conversation
  const handleSelectConversation = useCallback(async (conversationId: string) => {
    if (!folderPath) return;
    try {
      const conv = await window.electronAPI.historyGetConversation(folderPath, conversationId);
      if (conv) {
        await window.electronAPI.historySetActiveConversation(folderPath, conversationId);
        setActiveConversationId(conv.id);
        setMode(conv.mode);
        // Restore messages
        const displayMsgs: DisplayMessage[] = conv.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            // For user messages, use displayText if available (original user input without file context)
            text: m.role === 'user' && m.displayText ? m.displayText : m.content,
            sender: m.role === 'user' ? 'user' : 'bot',
          }));
        setMessages(displayMsgs);
        setHistory(conv.messages);
        setAttachedFiles([]);
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to load conversation:', err);
    }
  }, [folderPath]);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!folderPath) return;
    try {
      await window.electronAPI.historyDeleteConversation(folderPath, conversationId);
      if (workspaceHistory) {
        const newConvs = workspaceHistory.conversations.filter(c => c.id !== conversationId);
        const newActiveId = conversationId === activeConversationId
          ? (newConvs[0]?.id ?? null)
          : activeConversationId;
        setWorkspaceHistory({
          ...workspaceHistory,
          conversations: newConvs,
          activeConversationId: newActiveId,
        });
        if (conversationId === activeConversationId) {
          if (newActiveId) {
            handleSelectConversation(newActiveId);
          } else {
            setActiveConversationId(null);
            setMessages([]);
            setHistory([]);
          }
        }
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to delete conversation:', err);
    }
  }, [folderPath, workspaceHistory, activeConversationId, handleSelectConversation]);

  // Rename conversation
  const handleRenameConversation = useCallback(async (conversationId: string, newTitle: string) => {
    if (!folderPath) return;
    try {
      await window.electronAPI.historyRenameConversation(folderPath, conversationId, newTitle);
      if (workspaceHistory) {
        const newConvs = workspaceHistory.conversations.map(c =>
          c.id === conversationId ? { ...c, title: newTitle } : c
        );
        setWorkspaceHistory({ ...workspaceHistory, conversations: newConvs });
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to rename conversation:', err);
    }
  }, [folderPath, workspaceHistory]);

  // Auto-save conversation when history changes (debounced)
  useEffect(() => {
    if (!folderPath || !activeConversationId || history.length === 0) return;
    const timeout = setTimeout(() => {
      saveConversation(history);
    }, 500);
    return () => clearTimeout(timeout);
  }, [history, folderPath, activeConversationId, saveConversation]);

  // Auto-create conversation when user sends first message
  const ensureConversation = useCallback(async () => {
    if (!folderPath) return null;
    if (activeConversationId) return activeConversationId;
    // Create new conversation
    try {
      const conv = await window.electronAPI.historyCreateConversation(folderPath, mode);
      setActiveConversationId(conv.id);
      if (workspaceHistory) {
        setWorkspaceHistory({
          ...workspaceHistory,
          conversations: [conv, ...workspaceHistory.conversations],
          activeConversationId: conv.id,
        });
      }
      return conv.id;
    } catch (err) {
      console.error('[ChatPanel] Failed to create conversation:', err);
      return null;
    }
  }, [folderPath, activeConversationId, mode, workspaceHistory]);

  // ── Suggested files from open editor tabs ──
  const suggestedFiles = openTabs
    .filter(t => !t.path.startsWith('diff:') && !attachedFiles.some(a => a.path === t.path))
    .map(t => ({ name: t.name, path: t.path }));

  // Highlight the active file at the top of suggestions
  const sortedSuggestions = [...suggestedFiles].sort((a, b) => {
    if (a.path === activeTabPath) return -1;
    if (b.path === activeTabPath) return 1;
    return 0;
  });

  const addSuggestedFile = useCallback(async (name: string, path: string) => {
    if (attachedFiles.some(a => a.path === path)) return;
    try {
      const result = await window.electronAPI.readFile(path);
      setAttachedFiles(prev => [...prev, { name, path, content: result.success ? result.content : undefined }]);
    } catch {
      setAttachedFiles(prev => [...prev, { name, path }]);
    }
    textareaRef.current?.focus();
  }, [attachedFiles]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // ── Workspace file paths for clickable file references in markdown ──
  const workspaceFiles = useMemo(() => flattenTree(tree), [tree]);

  const handleMdFileClick = useCallback((relativePath: string) => {
    if (!folderPath) return;
    const fullPath = `${folderPath}/${relativePath}`;
    const name = relativePath.split('/').pop() ?? relativePath;
    openFile(name, fullPath);
    setActivePanel('explorer');
  }, [folderPath, openFile, setActivePanel]);

  // Load settings & models on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await window.electronAPI.aiLoadSettings();
        setSettings(s);
        setSelectedModel(s.selectedModel);
        const list = await window.electronAPI.aiListModels(s.baseUrl, s.apiKey);
        setModels(list);
        if (list.length > 0) {
          setReady(true);
          if (!list.includes(s.selectedModel)) setSelectedModel(list[0]);
        }
      } catch { /* not configured */ }
    })();
  }, []);

  const handleSettingsSaved = useCallback(async (s: AISettings) => {
    setSettings(s);
    setSelectedModel(s.selectedModel);
    const list = await window.electronAPI.aiListModels(s.baseUrl, s.apiKey);
    setModels(list);
    setReady(list.length > 0 && !!s.selectedModel);
  }, []);

  // ── Drag & Drop ──
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filePath = (f as unknown as { path: string }).path; // Electron gives us .path
      if (!filePath) continue;
      const name = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? f.name;
      if (attachedFiles.some(a => a.path === filePath)) continue;
      // Read file content
      try {
        const result = await window.electronAPI.readFile(filePath);
        setAttachedFiles(prev => [...prev, { name, path: filePath, content: result.success ? result.content : undefined }]);
      } catch {
        setAttachedFiles(prev => [...prev, { name, path: filePath }]);
      }
    }
    textareaRef.current?.focus();
  }, [attachedFiles]);

  const removeFile = (path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  };

  // ── Build the system message with workspace context (sent only once, on first chat) ──
  const buildSystemContext = useCallback((): ChatMessage => {
    // Filter out gitignored files from the workspace file list
    const fileList = Array.from(workspaceFiles)
      .filter(rel => {
        if (!folderPath || gitIgnoredPaths.length === 0) return true;
        const abs = `${folderPath}/${rel}`;
        return !gitIgnoredPaths.some(ip => abs === ip || abs.startsWith(ip + '/'));
      })
      .sort();
    const lines = [
      `You are an expert coding assistant inside the "mydev.bychat.io" desktop IDE.`,
      ``,
      `## Workspace`,
      `- **Directory**: ${folderPath ?? 'No project open'}`,
      `- **Files** (${fileList.length} total):`,
      ...fileList.map(f => `  - ${f}`),
      ``,
      `Use this workspace context to give precise, file-aware answers. When referencing files, use the exact relative paths listed above.`,
    ];
    return { role: 'system', content: lines.join('\n') };
  }, [folderPath, workspaceFiles, gitIgnoredPaths]);

  // ── Build the research agent prompt that picks relevant files ──
  const buildResearchPrompt = useCallback((userQuestion: string): ChatMessage[] => {
    const fileList = Array.from(workspaceFiles)
      .filter(rel => {
        if (!folderPath || gitIgnoredPaths.length === 0) return true;
        const abs = `${folderPath}/${rel}`;
        return !gitIgnoredPaths.some(ip => abs === ip || abs.startsWith(ip + '/'));
      })
      .sort();

    const system: ChatMessage = {
      role: 'system',
      content: [
        `You are a code research agent. Your job is to decide which files from the workspace are most relevant to the user's question.`,
        ``,
        `## Workspace: ${folderPath ?? 'unknown'}`,
        `## Files (${fileList.length} total):`,
        ...fileList.map(f => `- ${f}`),
        ``,
        `## Instructions`,
        `Based on the user's question below, choose between 4 and 9 files that are most relevant to answering it.`,
        `Return ONLY a valid JSON array of relative file paths. No explanation, no markdown fences, just the JSON array.`,
        `Example: ["src/index.ts", "package.json", "README.md", "src/utils/helper.ts"]`,
      ].join('\n'),
    };

    const user: ChatMessage = {
      role: 'user',
      content: userQuestion,
    };

    return [system, user];
  }, [folderPath, workspaceFiles, gitIgnoredPaths]);

  // ── Parse the research agent response into file paths ──
  const parseResearchResponse = useCallback((raw: string): string[] => {
    try {
      // Try to extract a JSON array — the model might wrap it in markdown fences
      const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'string')) {
        // Validate against workspace files
        const valid = (parsed as string[]).filter(f => workspaceFiles.has(f));
        return valid.slice(0, 9);
      }
    } catch { /* fallback */ }
    return [];
  }, [workspaceFiles]);

  // ── Read multiple files and return as AttachedFile[] ──
  const readFilesForContext = useCallback(async (relativePaths: string[]): Promise<AttachedFile[]> => {
    if (!folderPath) return [];
    const results: AttachedFile[] = [];
    for (const rel of relativePaths) {
      const fullPath = `${folderPath}/${rel}`;
      const name = rel.split('/').pop() ?? rel;
      try {
        const result = await window.electronAPI.readFile(fullPath);
        if (result.success && result.content) {
          results.push({ name: rel, path: fullPath, content: result.content });
        }
      } catch { /* skip unreadable files */ }
    }
    return results;
  }, [folderPath]);

  // ── Check Agent: detect whether the user wants file changes ──
  const buildCheckAgentPrompt = useCallback((userMessage: string, chatHistory: ChatMessage[]): ChatMessage[] => {
    const system: ChatMessage = {
      role: 'system',
      content: [
        `You are a triage agent inside a coding IDE. Your ONLY job is to decide whether the user's latest message requires creating, modifying, or deleting files in the workspace.`,
        ``,
        `Reply with ONLY a valid JSON object — no markdown fences, no explanation:`,
        `{ "needsFileChanges": true | false }`,
        ``,
        `Examples that need file changes: "add a dark mode toggle", "fix the bug in auth.ts", "create a new component", "refactor the utils", "update the README".`,
        `Examples that do NOT need file changes: "explain how X works", "what does this function do", "summarize the project", "how do I run this".`,
      ].join('\n'),
    };
    // Include just the last few exchanges for context (save tokens)
    const recent = chatHistory.slice(-6);
    return [system, ...recent, { role: 'user', content: userMessage }];
  }, []);

  const parseCheckAgentResponse = useCallback((raw: string): boolean => {
    try {
      const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return !!parsed.needsFileChanges;
    } catch {
      // Fallback heuristics
      const lower = raw.toLowerCase();
      return lower.includes('"needsfilechanges": true') || lower.includes('"needsfilechanges":true');
    }
  }, []);

  // ── File Action Planner: ask AI which files to create/update/delete ──
  const buildActionPlanPrompt = useCallback((userMessage: string, chatHistory: ChatMessage[]): ChatMessage[] => {
    const fileList = Array.from(workspaceFiles)
      .filter(rel => {
        if (!folderPath || gitIgnoredPaths.length === 0) return true;
        const abs = `${folderPath}/${rel}`;
        return !gitIgnoredPaths.some(ip => abs === ip || abs.startsWith(ip + '/'));
      })
      .sort();

    const system: ChatMessage = {
      role: 'system',
      content: [
        `You are a code planning agent. The user wants to make changes to their codebase.`,
        ``,
        `## Workspace files (${fileList.length}):`,
        ...fileList.map(f => `- ${f}`),
        ``,
        `## Instructions`,
        `Based on the conversation and the user's latest request, determine which files need to be created, updated, or deleted.`,
        `Return ONLY a valid JSON array of action objects. No explanation, no markdown fences.`,
        `Each object: { "file": "<relative path>", "action": "create"|"update"|"delete", "description": "<brief description of what to change>" }`,
        ``,
        `Example: [{"file":"src/utils/auth.ts","action":"update","description":"Add password validation function"},{"file":"src/components/Login.tsx","action":"create","description":"Create login form component"}]`,
        ``,
        `Keep the list focused — only include files that truly need changes. Max 10 files.`,
      ].join('\n'),
    };
    const recent = chatHistory.slice(-6);
    return [system, ...recent, { role: 'user', content: userMessage }];
  }, [workspaceFiles, folderPath, gitIgnoredPaths]);

  const parseActionPlanResponse = useCallback((raw: string): FileActionPlan[] => {
    try {
      const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x: any) => x.file && x.action && x.description)
          .map((x: any) => ({
            file: x.file as string,
            action: (x.action === 'create' || x.action === 'delete') ? x.action : 'update' as const,
            description: x.description as string,
          }))
          .slice(0, 10);
      }
    } catch { /* fallback */ }
    return [];
  }, []);

  // ── Build the prompt for applying a single file change ──
  const buildFileChangePrompt = useCallback((
    plan: FileActionPlan,
    currentContent: string | null,
    userRequest: string,
    chatHistory: ChatMessage[],
  ): ChatMessage[] => {
    const system: ChatMessage = {
      role: 'system',
      content: plan.action === 'delete'
        ? `You are a code editor. Respond with exactly: __DELETE_FILE__`
        : plan.action === 'create'
          ? [
              `You are a code editor. Create the file "${plan.file}".`,
              `Task: ${plan.description}`,
              ``,
              `Return ONLY the file content. No markdown fences, no explanation.`,
            ].join('\n')
          : [
              `You are a precise code editor. You must apply targeted changes to the file using SEARCH/REPLACE blocks.`,
              ``,
              `## Task: ${plan.description}`,
              `## File: ${plan.file}`,
              ``,
              `## Current file content:`,
              '```',
              currentContent ?? '',
              '```',
              ``,
              `## Instructions`,
              `Return ONLY one or more SEARCH/REPLACE blocks. Each block looks like:`,
              ``,
              `<<<<<<< SEARCH`,
              `exact lines from the current file to find`,
              `=======`,
              `replacement lines`,
              `>>>>>>> REPLACE`,
              ``,
              `Rules:`,
              `- The SEARCH section must match the current file EXACTLY (including whitespace).`,
              `- Include 2-3 lines of unchanged context around each change for precision.`,
              `- Use multiple blocks for multiple changes.`,
              `- Do NOT return the whole file. Only return SEARCH/REPLACE blocks.`,
              `- No markdown fences around the blocks, no explanation text.`,
            ].join('\n'),
    };
    const lastAssistant = chatHistory.filter(m => m.role === 'assistant').slice(-1);
    return [system, ...lastAssistant, { role: 'user', content: userRequest }];
  }, []);

  // ── Build verification prompt ──
  const buildVerifyPrompt = useCallback((
    userRequest: string,
    changedFiles: { file: string; action: string; diff?: { before: string; after: string } }[],
  ): ChatMessage[] => {
    const summary = changedFiles.map(f => {
      if (f.action === 'delete') return `- **DELETED** ${f.file}`;
      if (f.action === 'create') return `- **CREATED** ${f.file}`;
      if (f.diff) {
        // Compute a compact diff representation
        const beforeLines = f.diff.before.split('\n');
        const afterLines = f.diff.after.split('\n');
        const added = afterLines.length - beforeLines.length;
        return `- **UPDATED** ${f.file} (${added >= 0 ? '+' : ''}${added} lines net)`;
      }
      return `- **UPDATED** ${f.file}`;
    }).join('\n');

    const system: ChatMessage = {
      role: 'system',
      content: [
        `You are a verification agent. The following file changes were just applied to fulfill the user's request.`,
        ``,
        `## User's request:`,
        `${userRequest}`,
        ``,
        `## Changes made:`,
        summary,
        ``,
        `## Instructions`,
        `Evaluate whether these changes fully satisfy the user's request.`,
        `Reply with ONLY a valid JSON object:`,
        `{ "satisfied": true | false, "reason": "<brief explanation>", "missingChanges": [] }`,
        ``,
        `If not satisfied, list the missing changes as objects: { "file": "path", "action": "create|update|delete", "description": "what's missing" }`,
      ].join('\n'),
    };
    return [system, { role: 'user', content: userRequest }];
  }, []);

  const parseVerifyResponse = useCallback((raw: string): { satisfied: boolean; reason: string; missingChanges: FileActionPlan[] } => {
    try {
      const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        satisfied: !!parsed.satisfied,
        reason: parsed.reason ?? '',
        missingChanges: Array.isArray(parsed.missingChanges)
          ? parsed.missingChanges.map((x: any) => ({ file: x.file, action: x.action ?? 'update', description: x.description ?? '' }))
          : [],
      };
    } catch {
      return { satisfied: true, reason: 'Unable to parse verification response', missingChanges: [] };
    }
  }, []);

  // ── Execute file actions (read, apply, write) with progress updates ──
  const executeFileActions = useCallback(async (
    actions: FileActionPlan[],
    userRequest: string,
    chatHistory: ChatMessage[],
    model: string,
    baseUrl: string,
    apiKey: string,
    statusMsgIndex: number,
  ): Promise<FileActionProgress[]> => {
    const progressList: FileActionProgress[] = actions.map(a => ({
      plan: a,
      status: 'pending' as FileActionStatus,
    }));

    // Helper to update the progress message
    const updateProgress = (statusText: string, list: FileActionProgress[]) => {
      setMessages(prev => {
        const updated = [...prev];
        if (statusMsgIndex < updated.length) {
          updated[statusMsgIndex] = {
            text: statusText,
            sender: 'system',
            isAgentProgress: true,
            agentActions: [...list],
          };
        }
        return updated;
      });
      scrollToBottom();
    };

    for (let i = 0; i < actions.length; i++) {
      const plan = actions[i];
      const fullPath = folderPath ? `${folderPath}/${plan.file}` : plan.file;

      // 1. Reading phase
      progressList[i] = { ...progressList[i], status: 'reading' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      let currentContent: string | null = null;
      if (plan.action !== 'create') {
        try {
          const result = await window.electronAPI.readFile(fullPath);
          if (result.success) currentContent = result.content ?? null;
        } catch { /* file might not exist */ }
      }

      // 2. Updating phase — ask AI for the new content
      progressList[i] = { ...progressList[i], status: 'updating' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      if (plan.action === 'delete') {
        // For delete — no AI call needed, just mark it
        progressList[i] = {
          ...progressList[i],
          status: 'done',
          diff: { before: currentContent ?? '', after: '(deleted)' },
        };
        // Note: We don't actually delete files for safety — user can do it manually
        updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);
        continue;
      }

      try {
        const changeMessages = buildFileChangePrompt(plan, currentContent, userRequest, chatHistory);
        const changeResult = await window.electronAPI.aiChat(baseUrl, apiKey, model, changeMessages);

        if (changeResult.success && changeResult.reply) {
          let newContent: string;

          if (plan.action === 'create') {
            // For new files — strip markdown fences if present
            newContent = stripMarkdownFences(changeResult.reply);
          } else {
            // For updates — parse SEARCH/REPLACE blocks and apply them
            const blocks = parseSearchReplaceBlocks(changeResult.reply);
            if (blocks.length > 0 && currentContent !== null) {
              newContent = applySearchReplaceBlocks(currentContent, blocks);
            } else {
              // Fallback: model returned raw content instead of blocks
              newContent = stripMarkdownFences(changeResult.reply);
            }
          }

          // Write the file
          await window.electronAPI.saveFile(fullPath, newContent);

          progressList[i] = {
            ...progressList[i],
            status: 'done',
            diff: { before: currentContent ?? '', after: newContent },
          };
        } else {
          progressList[i] = {
            ...progressList[i],
            status: 'error',
            error: changeResult.error ?? 'AI failed to generate changes',
          };
        }
      } catch (err: unknown) {
        progressList[i] = {
          ...progressList[i],
          status: 'error',
          error: (err as Error).message,
        };
      }

      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);
    }

    return progressList;
  }, [folderPath, scrollToBottom, buildFileChangePrompt]);


  // ── Send ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !settings) return;
    const model = selectedModel || settings.selectedModel;
    if (!model) { setSettingsOpen(true); return; }

    // Ensure we have an active conversation
    await ensureConversation();

    const currentFiles = [...attachedFiles];
    setMessages(prev => [...prev, { text, sender: 'user', files: currentFiles.length > 0 ? currentFiles : undefined }]);
    setInput('');
    setAttachedFiles([]);
    scrollToBottom();

    const isFirstMessage = history.length === 0;
    setLoading(true);

    let researchedFiles: AttachedFile[] = [];

    // ── Step 1: Research Agent (first message only) ──
    if (isFirstMessage && folderPath && workspaceFiles.size > 0) {
      // Show research status
      setMessages(prev => [...prev, {
        text: '🔍 Researching your codebase…',
        sender: 'system',
        isResearchStatus: true,
      }]);
      scrollToBottom();

      try {
        const researchMessages = buildResearchPrompt(text);
        const researchResult = await window.electronAPI.aiChat(
          settings.baseUrl, settings.apiKey, model, researchMessages
        );

        if (researchResult.success && researchResult.reply) {
          const chosenFiles = parseResearchResponse(researchResult.reply);

          if (chosenFiles.length > 0) {
            // Update status → reading files
            setMessages(prev => {
              const updated = [...prev];
              const statusIdx = findLastIdx(updated, m => !!m.isResearchStatus);
              if (statusIdx >= 0) {
                updated[statusIdx] = {
                  text: `📂 Reading ${chosenFiles.length} relevant file${chosenFiles.length > 1 ? 's' : ''}…`,
                  sender: 'system',
                  isResearchStatus: true,
                };
              }
              return updated;
            });
            scrollToBottom();

            researchedFiles = await readFilesForContext(chosenFiles);

            // Replace status with the researched files display
            setMessages(prev => {
              const updated = [...prev];
              const statusIdx = findLastIdx(updated, m => !!m.isResearchStatus);
              if (statusIdx >= 0) {
                updated[statusIdx] = {
                  text: `📎 Added ${researchedFiles.length} file${researchedFiles.length > 1 ? 's' : ''} as context`,
                  sender: 'system',
                  files: researchedFiles,
                  isResearchStatus: false,
                };
              }
              return updated;
            });
            scrollToBottom();
          } else {
            // No files chosen — remove status
            setMessages(prev => prev.filter(m => !m.isResearchStatus));
          }
        } else {
          // Research failed — remove status, continue without context
          setMessages(prev => prev.filter(m => !m.isResearchStatus));
        }
      } catch {
        // Research failed — remove status, continue without context
        setMessages(prev => prev.filter(m => !m.isResearchStatus));
      }
    }

    // ── Step 2: Build the actual chat messages ──
    // Merge user-attached files + research-agent files
    const allContextFiles = [...currentFiles, ...researchedFiles];

    let contextPrefix = '';
    if (allContextFiles.length > 0) {
      contextPrefix = allContextFiles
        .filter(f => f.content)
        .map(f => {
          // Use relative path to save tokens — strip folderPath prefix
          const relPath = folderPath && f.path.startsWith(folderPath)
            ? f.path.slice(folderPath.length + 1)
            : f.name;
          return `--- File: ${relPath} ---\n${f.content}`;
        })
        .join('\n\n') + '\n\n';
    }

    const userContent = contextPrefix + text;

    const newHistory: ChatMessage[] = isFirstMessage
      ? [buildSystemContext(), { role: 'user', content: userContent, displayText: text }]
      : [...history, { role: 'user', content: userContent, displayText: text }];

    setHistory(newHistory);

    // ── Step 2.5: Follow-up Check Agent (Agent mode, non-first message) ──
    const isFollowUp = !isFirstMessage && mode === 'Agent' && folderPath && workspaceFiles.size > 0;
    let needsFileChanges = false;

    if (isFollowUp) {
      // Show check agent status
      setMessages(prev => [...prev, {
        text: '🧠 Analyzing your request…',
        sender: 'system',
        isResearchStatus: true,
      }]);
      scrollToBottom();

      try {
        const checkMessages = buildCheckAgentPrompt(text, newHistory);
        const checkResult = await window.electronAPI.aiChat(
          settings.baseUrl, settings.apiKey, model, checkMessages
        );

        if (checkResult.success && checkResult.reply) {
          needsFileChanges = parseCheckAgentResponse(checkResult.reply);
        }
      } catch { /* proceed without file changes */ }

      // Remove status
      setMessages(prev => prev.filter(m => !m.isResearchStatus));
    }

    // ── Step 2.6: File Action Agent (if changes needed) ──
    if (needsFileChanges) {
      // Phase A: Plan what files to change
      setMessages(prev => {
        const next = [...prev, {
          text: '📋 Planning file changes…',
          sender: 'system' as const,
          isAgentProgress: true,
          agentActions: [],
        }];
        return next;
      });
      scrollToBottom();

      // Compute the progress index from the current messages length
      // We need to await a tick so the state update has applied
      await new Promise(r => setTimeout(r, 0));
      // The progress message is always the last system message we just pushed
      const progressMsgIdx = await new Promise<number>(resolve => {
        setMessages(prev => {
          resolve(prev.length - 1);
          return prev;
        });
      });

      let actionPlan: FileActionPlan[] = [];
      try {
        const planMessages = buildActionPlanPrompt(text, newHistory);
        const planResult = await window.electronAPI.aiChat(
          settings.baseUrl, settings.apiKey, model, planMessages
        );

        if (planResult.success && planResult.reply) {
          actionPlan = parseActionPlanResponse(planResult.reply);
        }
      } catch { /* no plan */ }

      if (actionPlan.length > 0) {
        // Phase B: Execute each action with progress
        let completedProgress: FileActionProgress[] = [];
        let attempt = 0;
        const MAX_ATTEMPTS = 3;
        let currentPlan = actionPlan;

        while (attempt < MAX_ATTEMPTS && currentPlan.length > 0) {
          attempt++;

          completedProgress = await executeFileActions(
            currentPlan, text, newHistory, model,
            settings.baseUrl, settings.apiKey, progressMsgIdx,
          );

          // Phase C: Verify changes
          setMessages(prev => {
            const updated = [...prev];
            if (progressMsgIdx < updated.length) {
              updated[progressMsgIdx] = {
                text: `✅ Verifying changes… (attempt ${attempt}/${MAX_ATTEMPTS})`,
                sender: 'system',
                isAgentProgress: true,
                agentActions: completedProgress,
                verifyAttempt: attempt,
              };
            }
            return updated;
          });
          scrollToBottom();

          const changedForVerify = completedProgress
            .filter(p => p.status === 'done')
            .map(p => ({
              file: p.plan.file,
              action: p.plan.action,
              diff: p.diff,
            }));

          if (changedForVerify.length === 0) break; // nothing to verify

          try {
            const verifyMessages = buildVerifyPrompt(text, changedForVerify);
            const verifyResult = await window.electronAPI.aiChat(
              settings.baseUrl, settings.apiKey, model, verifyMessages
            );

            if (verifyResult.success && verifyResult.reply) {
              const verification = parseVerifyResponse(verifyResult.reply);

              if (verification.satisfied || verification.missingChanges.length === 0) {
                // All done!
                break;
              }

              // Need more changes — loop again with missing changes
              currentPlan = verification.missingChanges;
            } else {
              break; // can't verify, stop
            }
          } catch {
            break; // verification failed, stop
          }
        }

        // Finalize the progress message
        const successCount = completedProgress.filter(p => p.status === 'done').length;
        const errorCount = completedProgress.filter(p => p.status === 'error').length;
        setMessages(prev => {
          const updated = [...prev];
          if (progressMsgIdx < updated.length) {
            updated[progressMsgIdx] = {
              text: `✅ Applied ${successCount} file change${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`,
              sender: 'system',
              isAgentProgress: true,
              agentActions: completedProgress,
            };
          }
          return updated;
        });
        scrollToBottom();

        // Add a summary of what was done to the chat history so the AI knows
        const changeSummary = completedProgress
          .filter(p => p.status === 'done')
          .map(p => `- ${p.plan.action.toUpperCase()} ${p.plan.file}: ${p.plan.description}`)
          .join('\n');

        if (changeSummary) {
          setHistory(prev => [...prev, {
            role: 'assistant',
            content: `I've made the following file changes:\n${changeSummary}`,
          }]);
        }
      } else {
        // No action plan — remove progress and fall through to regular chat
        setMessages(prev => prev.filter(m => !m.isAgentProgress));
      }
    }

    // ── Step 3: Get the real answer (streamed) ──
    // Add an empty bot message that we'll update chunk by chunk
    setMessages(prev => [...prev, { text: '', sender: 'bot' }]);
    scrollToBottom();

    // If we just did file changes, build a fresh history with the summary
    // so the streaming response can reference what was done
    const streamHistory = needsFileChanges
      ? [...newHistory, ...history.slice(newHistory.length).filter(m => m.role === 'assistant')]
      : newHistory;

    // Accumulate streamed text in a ref-like variable
    let streamedText = '';

    // Listen for streaming chunks
    const cleanupChunk = window.electronAPI.onAiChatChunk((chunk: string) => {
      streamedText += chunk;
      const currentText = streamedText; // capture for closure
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { text: currentText, sender: 'bot' };
        return updated;
      });
      scrollToBottom();
    });

    try {
      const result = await window.electronAPI.aiChatStream(settings.baseUrl, settings.apiKey, model, newHistory);
      cleanupChunk();

      if (result.success && result.reply) {
        // Ensure final state matches the full reply
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: result.reply!, sender: 'bot' };
          return updated;
        });
        setHistory(prev => [...prev, { role: 'assistant', content: result.reply! }]);
      } else if (result.error === 'aborted') {
        if (streamedText) {
          // Keep whatever was streamed, add a note
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
            return updated;
          });
          setHistory(prev => [...prev, { role: 'assistant', content: streamedText }]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: '⏹ Response stopped.', sender: 'bot' };
            return updated;
          });
        }
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: `⚠️ ${result.error ?? 'Unknown error'}`, sender: 'bot' };
          return updated;
        });
      }
    } catch (err: unknown) {
      cleanupChunk();
      const msg = (err as Error).message;
      if (msg?.includes('abort')) {
        if (streamedText) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
            return updated;
          });
          setHistory(prev => [...prev, { role: 'assistant', content: streamedText }]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: '⏹ Response stopped.', sender: 'bot' };
            return updated;
          });
        }
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: `⚠️ ${msg}`, sender: 'bot' };
          return updated;
        });
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, settings, selectedModel, history, attachedFiles, scrollToBottom, buildSystemContext, buildResearchPrompt, parseResearchResponse, readFilesForContext, folderPath, workspaceFiles, mode, buildCheckAgentPrompt, parseCheckAgentResponse, buildActionPlanPrompt, parseActionPlanResponse, executeFileActions, buildVerifyPrompt, parseVerifyResponse, ensureConversation]);

  // ── Stop running request ──
  const stopMessage = useCallback(async () => {
    try {
      await window.electronAPI.aiChatAbort();
    } catch { /* ignore */ }
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  };

  const clearChat = () => { setMessages([]); setHistory([]); setAttachedFiles([]); };

  // ── Add Context (trigger native file dialog via hidden input) ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleAddContext = () => fileInputRef.current?.click();
  const handleFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filePath = (f as unknown as { path: string }).path;
      if (!filePath) continue;
      const name = filePath.split('/').pop() ?? f.name;
      if (attachedFiles.some(a => a.path === filePath)) continue;
      try {
        const result = await window.electronAPI.readFile(filePath);
        setAttachedFiles(prev => [...prev, { name, path: filePath, content: result.success ? result.content : undefined }]);
      } catch {
        setAttachedFiles(prev => [...prev, { name, path: filePath }]);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="chat-panel-container">
      {/* History Sidebar */}
      {historySidebarOpen && (
        <ChatHistorySidebar
          workspace={workspaceHistory}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onClose={() => setHistorySidebarOpen(false)}
        />
      )}

      <section className="chat-panel chat-panel-main">
        {/* Header */}
        <div className="chat-hdr">
          <div className="chat-hdr-left">
            <button
              className={`chat-history-toggle ${historySidebarOpen ? 'active' : ''}`}
              onClick={() => setHistorySidebarOpen(!historySidebarOpen)}
              title="Chat History"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.025 8.025 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z"/>
                <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
                <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
              </svg>
            </button>
            <h2>💬 Chat</h2>
          </div>
          <div className="chat-hdr-actions">
            <button className="chat-hdr-btn" onClick={handleNewChat} title="New Chat">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
              </svg>
            </button>
            <button className="chat-hdr-btn" onClick={() => window.electronAPI.debugOpen()} title="Session Debug — view all prompts sent to the AI">🐛</button>
            {messages.length > 0 && (
              <button className="chat-hdr-btn" onClick={clearChat} title="Clear chat">🗑</button>
            )}
            <button className="chat-hdr-btn" onClick={() => setSettingsOpen(true)} title="AI Settings">⚙️</button>
            {onCollapse && (
              <button className="panel-collapse-btn" onClick={onCollapse} title="Collapse chat">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M6 3.5a.5.5 0 0 1 .82-.38l4 3.5a.5.5 0 0 1 0 .76l-4 3.5A.5.5 0 0 1 6 10.5v-7z"/></svg>
              </button>
            )}
          </div>
        </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="chat-icon">🤖</span>
            {ready ? (
              <p>Ask me anything about your project.<br /><span className="chat-model-hint">Using <strong>{selectedModel}</strong></span></p>
            ) : (
              <div className="chat-setup">
                <p>Configure an AI provider to get started.</p>
                <button className="btn-primary chat-setup-btn" onClick={() => setSettingsOpen(true)}>⚙️ Open Settings</button>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              <div className="bubble">
                {msg.files && msg.files.length > 0 && (
                  <div className="bubble-files">
                    {msg.files.map(f => (
                      <span key={f.path} className="file-chip-inline">{fileIcon(f.name)} {f.name}</span>
                    ))}
                  </div>
                )}
                {/* Agent progress panel */}
                {msg.isAgentProgress && msg.agentActions && msg.agentActions.length > 0 && (
                  <div className="agent-progress">
                    {msg.agentActions.map((action, j) => (
                      <AgentActionRow
                        key={`${action.plan.file}-${j}`}
                        action={action}
                        onFileClick={handleMdFileClick}
                      />
                    ))}
                    {msg.verifyAttempt && (
                      <div className="agent-verify-badge">🔄 Verification attempt {msg.verifyAttempt}/3</div>
                    )}
                  </div>
                )}
                {msg.sender === 'bot' ? (
                  <div className="md-content">
                    <Markdown workspaceFiles={workspaceFiles} onFileClick={handleMdFileClick}>
                      {msg.text}
                    </Markdown>
                  </div>
                ) : (
                  !msg.isAgentProgress && msg.text
                )}
              </div>
            </div>
          ))
        )}
        {loading && (messages.length === 0 || messages[messages.length - 1].sender !== 'bot') && (
          <div className="chat-msg bot">
            <div className="bubble chat-typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Input Composer (VS Code Copilot style) ── */}
      <div
        className={`chat-composer ${dragging ? 'drag-over' : ''}`}
        ref={inputBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File chips row */}
        {attachedFiles.length > 0 && (
          <div className="composer-files">
            {attachedFiles.map(f => (
              <span key={f.path} className="file-chip">
                {fileIcon(f.name)}
                <span className="file-chip-name">{f.name}</span>
                <button className="file-chip-remove" onClick={() => removeFile(f.path)}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Add Context + Suggestions */}
        <div className="composer-top">
          <button className="composer-add-ctx" onClick={handleAddContext} title="Add Context...">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.5 1a.5.5 0 0 1 .5.5V4h2.5a.5.5 0 0 1 0 1H12v2.5a.5.5 0 0 1-1 0V5H8.5a.5.5 0 0 1 0-1H11V1.5a.5.5 0 0 1 .5-.5z"/><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H8v1H3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8h1v4.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9z"/></svg>
            Add Context…
          </button>
          {sortedSuggestions.length > 0 && (
            <div className="composer-suggestions">
              {sortedSuggestions.map(f => (
                <button
                  key={f.path}
                  className={`composer-suggestion-chip ${f.path === activeTabPath ? 'active-file' : ''}`}
                  onClick={() => addSuggestedFile(f.name, f.path)}
                  title={`Add ${f.name} as context`}
                >
                  {fileIcon(f.name)} {f.name}
                </button>
              ))}
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFilePick} multiple hidden />
        </div>

        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={ready ? 'Ask anything, @ to mention…' : 'Configure AI first…'}
          rows={1}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={!ready || loading}
        />

        {/* Bottom toolbar */}
        <div className="composer-toolbar">
          <div className="composer-toolbar-left">
            {/* Mode dropdown */}
            <div className="composer-dropdown-wrap">
              <button className="composer-dropdown-btn" onClick={() => setModeMenuOpen(p => !p)}>
                {mode} <span className="caret">▾</span>
              </button>
              {modeMenuOpen && (
                <div className="composer-dropdown-menu">
                  {(['Agent', 'Chat', 'Edit'] as ChatMode[]).map(m => (
                    <button key={m} className={`composer-dropdown-item ${m === mode ? 'active' : ''}`} onClick={() => { setMode(m); setModeMenuOpen(false); }}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model dropdown */}
            {models.length > 0 && (
              <div className="composer-dropdown-wrap">
                <select className="composer-model-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="composer-toolbar-right">
            {/* Tool icons */}
            <button className="composer-icon-btn" title="Tools">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A.5.5 0 0 0 8.914 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
            </button>
            <button className="composer-icon-btn" title="Keyboard shortcuts">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M14 5H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM2 4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H2z"/><path d="M13 10.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm0-2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-5 0A.25.25 0 0 1 8.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 8 8.75v-.5z"/></svg>
            </button>
            <button className="composer-icon-btn" title="History">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
            </button>
            <button className="composer-icon-btn" title="Voice input">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 11a3 3 0 0 0 3-3V3a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M12 8a.5.5 0 0 1 .5.5A4.5 4.5 0 0 1 8.5 13v1.5h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V13A4.5 4.5 0 0 1 3.5 8.5a.5.5 0 0 1 1 0A3.5 3.5 0 0 0 8 12a3.5 3.5 0 0 0 3.5-3.5.5.5 0 0 1 .5-.5z"/></svg>
            </button>
            {/* Send / Stop */}
            {loading ? (
              <button className="composer-stop-btn" onClick={stopMessage} title="Stop generating">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1.5" /></svg>
              </button>
            ) : (
              <button className="composer-send-btn" onClick={sendMessage} disabled={!ready} title="Send">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.724 1.053a.5.5 0 0 1 .541-.054l12 6.5a.5.5 0 0 1 0 .882l-12 6.5A.5.5 0 0 1 1.5 14.5v-5.191l7.72-1.31L1.5 6.69V1.5a.5.5 0 0 1 .224-.447z"/></svg>
                <span className="caret">▾</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />
    </section>
    </div>
  );
}
