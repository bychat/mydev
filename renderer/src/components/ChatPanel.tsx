/**
 * ChatPanel - Main chat interface component.
 * Orchestrates hooks and renders sub-components.
 */
import { useState, useRef, useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';
import SettingsModal from './SettingsModal';
import { flattenTree } from './Markdown';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import ChatHistorySidebar from './ChatHistorySidebar';

import {
  useAttachedFiles,
  useChatHistory,
  useAISettings,
  useScrollToBottom,
  useAgentPipeline,
  useMessageStream,
} from '../hooks';
import {
  getFileIcon,
} from '../utils';
import { ChatHeader, ChatWelcome, ChatMessages } from './chat';
import {
  AddFileIcon,
  SendIcon,
  StopIcon,
  MicrophoneIcon,
  ClockIcon,
  KeyboardIcon,
  FolderIcon,
} from './icons';

type ChatMode = 'Agent' | 'Chat' | 'Edit';

interface ChatPanelProps {
  onCollapse?: () => void;
}

export default function ChatPanel({ onCollapse }: ChatPanelProps) {
  const { openTabs, activeTabPath, tree, folderPath, openFile, setActivePanel, gitIgnoredPaths } = useWorkspace();
  const backend = useBackend();
  
  // Use extracted hooks
  const {
    settings,
    models,
    selectedModel,
    setSelectedModel,
    ready,
    settingsOpen,
    setSettingsOpen,
    handleSettingsSaved,
  } = useAISettings();

  const [mode, setMode] = useState<ChatMode>('Agent');
  const [loading, setLoading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    workspaceHistory,
    activeConversationId,
    messages,
    history,
    setMessages,
    setHistory,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    ensureConversation,
    clearChat: clearChatHistory,
  } = useChatHistory(folderPath, mode);

  const {
    attachedFiles,
    setAttachedFiles,
    dragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    addFile,
    removeFile,
    clearFiles,
    handleFilePick,
  } = useAttachedFiles();

  const { endRef, scrollToBottom } = useScrollToBottom();

  // ── Workspace file paths for clickable file references ──
  const workspaceFiles = useMemo(() => flattenTree(tree), [tree]);

  // ── Agent pipeline & streaming hooks ──
  const agentPipeline = useAgentPipeline({
    folderPath, workspaceFiles, gitIgnoredPaths,
    scrollToBottom, setMessages, setHistory,
  });
  const { streamResponse, stopMessage } = useMessageStream({
    scrollToBottom, setMessages, setHistory, setLoading,
  });

  // ── Suggested files from open editor tabs ──
  const suggestedFiles = openTabs
    .filter(t => !t.path.startsWith('diff:') && !attachedFiles.some(a => a.path === t.path))
    .map(t => ({ name: t.name, path: t.path, content: t.content }));

  const sortedSuggestions = [...suggestedFiles].sort((a, b) => {
    if (a.path === activeTabPath) return -1;
    if (b.path === activeTabPath) return 1;
    return 0;
  });

  const addSuggestedFile = useCallback(async (name: string, path: string, content?: string) => {
    const isSpecialTab = path.startsWith('supabase:');
    await addFile(name, path, isSpecialTab ? content : undefined);
    textareaRef.current?.focus();
  }, [addFile]);

  const handleMdFileClick = useCallback((relativePath: string) => {
    if (!folderPath) return;
    const fullPath = `${folderPath}/${relativePath}`;
    const name = relativePath.split('/').pop() ?? relativePath;
    openFile(name, fullPath);
    setActivePanel('explorer');
  }, [folderPath, openFile, setActivePanel]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !settings) return;
    const model = selectedModel || settings.selectedModel;
    if (!model) { setSettingsOpen(true); return; }

    await ensureConversation();

    const currentFiles = [...attachedFiles];
    setMessages(prev => [...prev, {
      text,
      sender: 'user',
      files: currentFiles.length > 0 ? currentFiles : undefined,
    }]);
    setInput('');
    clearFiles();
    scrollToBottom();

    const isFirstMessage = history.length === 0;
    setLoading(true);

    const ai = { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model };
    let researchedFiles: Array<{ name: string; path: string; content?: string }> = [];

    // Step 1: Research Agent (first message only)
    if (isFirstMessage && folderPath && workspaceFiles.size > 0) {
      researchedFiles = await agentPipeline.runResearchStep(text, ai);
    }

    // Step 2: Build chat messages
    const allContextFiles = [...currentFiles, ...researchedFiles];
    let contextPrefix = '';
    if (allContextFiles.length > 0) {
      contextPrefix = allContextFiles
        .filter(f => f.content)
        .map(f => {
          const relPath = folderPath && f.path.startsWith(folderPath)
            ? f.path.slice(folderPath.length + 1)
            : f.name;
          return `--- File: ${relPath} ---\n${f.content}`;
        })
        .join('\n\n') + '\n\n';
    }

    const userContent = contextPrefix + text;
    const systemContext = agentPipeline.getSystemContext();

    const newHistory: ChatMessage[] = isFirstMessage
      ? [systemContext, { role: 'user', content: userContent, displayText: text }]
      : [...history, { role: 'user', content: userContent, displayText: text }];

    setHistory(newHistory);

    // Step 2.5: Check Agent (follow-up in Agent mode)
    const isFollowUp = !isFirstMessage && mode === 'Agent' && folderPath && workspaceFiles.size > 0;
    let needsFileChanges = false;

    if (isFollowUp) {
      needsFileChanges = await agentPipeline.runCheckStep(text, newHistory, ai);
    }

    // Step 2.6: File Action Agent
    if (needsFileChanges) {
      await agentPipeline.runFileChangeStep(text, newHistory, ai);
    }

    // Step 3: Stream the response
    await streamResponse(settings.baseUrl, settings.apiKey, model, newHistory);
  }, [
    input, loading, settings, selectedModel, history, attachedFiles, scrollToBottom,
    folderPath, workspaceFiles, mode, gitIgnoredPaths, setMessages, setHistory,
    ensureConversation, clearFiles, agentPipeline, streamResponse, setSettingsOpen,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  };

  const clearChat = () => {
    clearChatHistory();
    clearFiles();
  };

  const handleAddContext = () => fileInputRef.current?.click();

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
        <ChatHeader
          historySidebarOpen={historySidebarOpen}
          onToggleHistory={() => setHistorySidebarOpen(!historySidebarOpen)}
          onNewChat={handleNewChat}
          onDebugOpen={() => backend.debugOpen()}
          onClearChat={clearChat}
          onOpenSettings={() => setSettingsOpen(true)}
          onCollapse={onCollapse}
          showClear={messages.length > 0}
        />

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="chat-messages">
            <ChatWelcome
              ready={ready}
              selectedModel={selectedModel}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            loading={loading}
            workspaceFiles={workspaceFiles}
            onFileClick={handleMdFileClick}
            endRef={endRef as React.RefObject<HTMLDivElement>}
          />
        )}

        {/* Input Composer */}
        <div
          className={`chat-composer ${dragging ? 'drag-over' : ''}`}
          ref={inputBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* File chips */}
          {attachedFiles.length > 0 && (
            <div className="composer-files">
              {attachedFiles.map(f => (
                <span key={f.path} className="file-chip">
                  {getFileIcon(f.name)}
                  <span className="file-chip-name">{f.name}</span>
                  <button className="file-chip-remove" onClick={() => removeFile(f.path)}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* Add Context + Suggestions */}
          <div className="composer-top">
            <button className="composer-add-ctx" onClick={handleAddContext} title="Add Context...">
              <AddFileIcon />
              Add Context…
            </button>
            {sortedSuggestions.length > 0 && (
              <div className="composer-suggestions">
                {sortedSuggestions.map(f => (
                  <button
                    key={f.path}
                    className={`composer-suggestion-chip ${f.path === activeTabPath ? 'active-file' : ''}`}
                    onClick={() => addSuggestedFile(f.name, f.path, f.content)}
                    title={`Add ${f.name} as context`}
                  >
                    {getFileIcon(f.name)} {f.name}
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
                      <button 
                        key={m} 
                        className={`composer-dropdown-item ${m === mode ? 'active' : ''}`} 
                        onClick={() => { setMode(m); setModeMenuOpen(false); }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model dropdown */}
              {models.length > 0 && (
                <div className="composer-dropdown-wrap">
                  <select 
                    className="composer-model-select" 
                    value={selectedModel} 
                    onChange={e => setSelectedModel(e.target.value)}
                  >
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="composer-toolbar-right">
              <button className="composer-icon-btn" title="Tools">
                <FolderIcon />
              </button>
              <button className="composer-icon-btn" title="Keyboard shortcuts">
                <KeyboardIcon />
              </button>
              <button className="composer-icon-btn" title="History">
                <ClockIcon />
              </button>
              <button className="composer-icon-btn" title="Voice input">
                <MicrophoneIcon />
              </button>
              {/* Send / Stop */}
              {loading ? (
                <button className="composer-stop-btn" onClick={stopMessage} title="Stop generating">
                  <StopIcon />
                </button>
              ) : (
                <button className="composer-send-btn" onClick={sendMessage} disabled={!ready} title="Send">
                  <SendIcon />
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
