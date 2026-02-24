/**
 * ChatPanel - Main chat interface component with hooks, utilities, and sub-components
 */
import { useState, useRef, useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import type { ChatMessage, FileActionPlan, FileActionProgress } from '../types';
import SettingsModal from './SettingsModal';
import Markdown, { flattenTree } from './Markdown';
import { useWorkspace } from '../context/WorkspaceContext';
import ChatHistorySidebar from './ChatHistorySidebar';

// Import hooks and utilities
import {
  useAttachedFiles,
  useChatHistory,
  useAISettings,
  useScrollToBottom,
} from '../hooks';
import {
  getFileIcon,
  stripMarkdownFences,
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  findLastIdx,
  buildSystemContext,
  buildResearchPrompt,
  parseResearchResponse,
  buildCheckAgentPrompt,
  parseCheckAgentResponse,
  buildActionPlanPrompt,
  parseActionPlanResponse,
  buildFileChangePrompt,
  buildVerifyPrompt,
  parseVerifyResponse,
} from '../utils';
import { ChatHeader, ChatWelcome, ChatMessages, AgentActionRow, type DisplayMessage } from './chat';
import {
  HistoryIcon,
  PlusIcon,
  CollapseIcon,
  SendIcon,
  StopIcon,
  MicrophoneIcon,
  ClockIcon,
  KeyboardIcon,
  FolderIcon,
  AddFileIcon,
} from './icons';

type ChatMode = 'Agent' | 'Chat' | 'Edit';

interface ChatPanelProps {
  onCollapse?: () => void;
}

export default function ChatPanel({ onCollapse }: ChatPanelProps) {
  const { openTabs, activeTabPath, tree, folderPath, openFile, setActivePanel, gitIgnoredPaths } = useWorkspace();
  
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

  // ── Suggested files from open editor tabs ──
  const suggestedFiles = openTabs
    .filter(t => !t.path.startsWith('diff:') && !attachedFiles.some(a => a.path === t.path))
    .map(t => ({ name: t.name, path: t.path }));

  const sortedSuggestions = [...suggestedFiles].sort((a, b) => {
    if (a.path === activeTabPath) return -1;
    if (b.path === activeTabPath) return 1;
    return 0;
  });

  const addSuggestedFile = useCallback(async (name: string, path: string) => {
    await addFile(name, path);
    textareaRef.current?.focus();
  }, [addFile]);

  const handleMdFileClick = useCallback((relativePath: string) => {
    if (!folderPath) return;
    const fullPath = `${folderPath}/${relativePath}`;
    const name = relativePath.split('/').pop() ?? relativePath;
    openFile(name, fullPath);
    setActivePanel('explorer');
  }, [folderPath, openFile, setActivePanel]);

  // ── Read multiple files for context ──
  const readFilesForContext = useCallback(async (relativePaths: string[]) => {
    if (!folderPath) return [];
    const results: Array<{ name: string; path: string; content?: string }> = [];
    for (const rel of relativePaths) {
      const fullPath = `${folderPath}/${rel}`;
      const name = rel.split('/').pop() ?? rel;
      try {
        const result = await window.electronAPI.readFile(fullPath);
        if (result.success && result.content) {
          results.push({ name: rel, path: fullPath, content: result.content });
        }
      } catch { /* skip */ }
    }
    return results;
  }, [folderPath]);

  // ── Execute file actions ──
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
      status: 'pending' as const,
    }));

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

      // Reading phase
      progressList[i] = { ...progressList[i], status: 'reading' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      let currentContent: string | null = null;
      if (plan.action !== 'create') {
        try {
          const result = await window.electronAPI.readFile(fullPath);
          if (result.success) currentContent = result.content ?? null;
        } catch { /* file might not exist */ }
      }

      // Updating phase
      progressList[i] = { ...progressList[i], status: 'updating' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      if (plan.action === 'delete') {
        progressList[i] = {
          ...progressList[i],
          status: 'done',
          diff: { before: currentContent ?? '', after: '(deleted)' },
        };
        updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);
        continue;
      }

      try {
        const changeMessages = buildFileChangePrompt(plan, currentContent, userRequest, chatHistory);
        const changeResult = await window.electronAPI.aiChat(baseUrl, apiKey, model, changeMessages);

        if (changeResult.success && changeResult.reply) {
          let newContent: string;

          if (plan.action === 'create') {
            newContent = stripMarkdownFences(changeResult.reply);
          } else {
            const blocks = parseSearchReplaceBlocks(changeResult.reply);
            if (blocks.length > 0 && currentContent !== null) {
              newContent = applySearchReplaceBlocks(currentContent, blocks);
            } else {
              newContent = stripMarkdownFences(changeResult.reply);
            }
          }

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
  }, [folderPath, scrollToBottom, setMessages]);

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
      files: currentFiles.length > 0 ? currentFiles : undefined 
    }]);
    setInput('');
    clearFiles();
    scrollToBottom();

    const isFirstMessage = history.length === 0;
    setLoading(true);

    let researchedFiles: Array<{ name: string; path: string; content?: string }> = [];

    // Step 1: Research Agent (first message only)
    if (isFirstMessage && folderPath && workspaceFiles.size > 0) {
      setMessages(prev => [...prev, {
        text: '🔍 Researching your codebase…',
        sender: 'system',
        isResearchStatus: true,
      }]);
      scrollToBottom();

      try {
        const researchMessages = buildResearchPrompt(text, folderPath, workspaceFiles, gitIgnoredPaths);
        const researchResult = await window.electronAPI.aiChat(
          settings.baseUrl, settings.apiKey, model, researchMessages
        );

        if (researchResult.success && researchResult.reply) {
          const chosenFiles = parseResearchResponse(researchResult.reply, workspaceFiles);

          if (chosenFiles.length > 0) {
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
            setMessages(prev => prev.filter(m => !m.isResearchStatus));
          }
        } else {
          setMessages(prev => prev.filter(m => !m.isResearchStatus));
        }
      } catch {
        setMessages(prev => prev.filter(m => !m.isResearchStatus));
      }
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
    const systemContext = buildSystemContext(folderPath, workspaceFiles, gitIgnoredPaths);

    const newHistory: ChatMessage[] = isFirstMessage
      ? [systemContext, { role: 'user', content: userContent, displayText: text }]
      : [...history, { role: 'user', content: userContent, displayText: text }];

    setHistory(newHistory);

    // Step 2.5: Check Agent (follow-up messages in Agent mode)
    const isFollowUp = !isFirstMessage && mode === 'Agent' && folderPath && workspaceFiles.size > 0;
    let needsFileChanges = false;

    if (isFollowUp) {
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

      setMessages(prev => prev.filter(m => !m.isResearchStatus));
    }

    // Step 2.6: File Action Agent
    if (needsFileChanges) {
      setMessages(prev => {
        return [...prev, {
          text: '📋 Planning file changes…',
          sender: 'system' as const,
          isAgentProgress: true,
          agentActions: [],
        }];
      });
      scrollToBottom();

      await new Promise(r => setTimeout(r, 0));
      const progressMsgIdx = await new Promise<number>(resolve => {
        setMessages(prev => {
          resolve(prev.length - 1);
          return prev;
        });
      });

      let actionPlan: FileActionPlan[] = [];
      try {
        const planMessages = buildActionPlanPrompt(text, newHistory, folderPath, workspaceFiles, gitIgnoredPaths);
        const planResult = await window.electronAPI.aiChat(
          settings.baseUrl, settings.apiKey, model, planMessages
        );

        if (planResult.success && planResult.reply) {
          actionPlan = parseActionPlanResponse(planResult.reply);
        }
      } catch { /* no plan */ }

      if (actionPlan.length > 0) {
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

          // Verify changes
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

          if (changedForVerify.length === 0) break;

          try {
            const verifyMessages = buildVerifyPrompt(text, changedForVerify);
            const verifyResult = await window.electronAPI.aiChat(
              settings.baseUrl, settings.apiKey, model, verifyMessages
            );

            if (verifyResult.success && verifyResult.reply) {
              const verification = parseVerifyResponse(verifyResult.reply);

              if (verification.satisfied || verification.missingChanges.length === 0) {
                break;
              }

              currentPlan = verification.missingChanges;
            } else {
              break;
            }
          } catch {
            break;
          }
        }

        // Finalize progress
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
        setMessages(prev => prev.filter(m => !m.isAgentProgress));
      }
    }

    // Step 3: Stream the response
    setMessages(prev => [...prev, { text: '', sender: 'bot' }]);
    scrollToBottom();

    let streamedText = '';

    const cleanupChunk = window.electronAPI.onAiChatChunk((chunk: string) => {
      streamedText += chunk;
      const currentText = streamedText;
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
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: result.reply!, sender: 'bot' };
          return updated;
        });
        setHistory(prev => [...prev, { role: 'assistant', content: result.reply! }]);
      } else if (result.error === 'aborted') {
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
  }, [
    input, loading, settings, selectedModel, history, attachedFiles, scrollToBottom,
    folderPath, workspaceFiles, mode, gitIgnoredPaths, setMessages, setHistory, 
    ensureConversation, clearFiles, readFilesForContext, executeFileActions, setSettingsOpen
  ]);

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
          onDebugOpen={() => window.electronAPI.debugOpen()}
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
                    onClick={() => addSuggestedFile(f.name, f.path)}
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
