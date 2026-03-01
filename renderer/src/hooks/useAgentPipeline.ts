/**
 * useAgentPipeline — Orchestrates the multi-step AI agent flow:
 *   1. Research (file discovery)
 *   2. Check agent (does the follow-up need file changes?)
 *   3. Action plan + file execution
 *   4. Verification loop
 *
 * Extracted from ChatPanel to keep the component focused on UI.
 */
import { useCallback } from 'react';
import type { ChatMessage, FileActionPlan, FileActionProgress, DisplayMessage } from '../types';
import { useBackend } from '../context/BackendContext';
import {
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

type SetMessages = React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
type SetHistory = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

interface AgentPipelineDeps {
  folderPath: string | null;
  workspaceFiles: Set<string>;
  gitIgnoredPaths: string[];
  scrollToBottom: () => void;
  setMessages: SetMessages;
  setHistory: SetHistory;
}

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function useAgentPipeline(deps: AgentPipelineDeps) {
  const { folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, setHistory } = deps;
  const backend = useBackend();

  /** Read multiple files for context */
  const readFilesForContext = useCallback(async (relativePaths: string[]) => {
    if (!folderPath) return [];
    const results: Array<{ name: string; path: string; content?: string }> = [];
    for (const rel of relativePaths) {
      const fullPath = `${folderPath}/${rel}`;
      const name = rel.split('/').pop() ?? rel;
      try {
        const result = await backend.readFile(fullPath);
        if (result.success && result.content) {
          results.push({ name: rel, path: fullPath, content: result.content });
        }
      } catch { /* skip */ }
    }
    return results;
  }, [folderPath]);

  /** Execute planned file actions (create / update / delete) */
  const executeFileActions = useCallback(async (
    actions: FileActionPlan[],
    userRequest: string,
    chatHistory: ChatMessage[],
    ai: AIConfig,
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

      progressList[i] = { ...progressList[i], status: 'reading' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      let currentContent: string | null = null;
      if (plan.action !== 'create') {
        try {
          const result = await backend.readFile(fullPath);
          if (result.success) currentContent = result.content ?? null;
        } catch { /* file might not exist */ }
      }

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
        const changeResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, changeMessages);

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
          await backend.saveFile(fullPath, newContent);
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

  /** Build the system context message */
  const getSystemContext = useCallback(() => {
    return buildSystemContext(folderPath, workspaceFiles, gitIgnoredPaths);
  }, [folderPath, workspaceFiles, gitIgnoredPaths]);

  /** Step 1: Research — discover relevant files on first message */
  const runResearchStep = useCallback(async (
    text: string,
    ai: AIConfig,
  ): Promise<Array<{ name: string; path: string; content?: string }>> => {
    if (!folderPath || workspaceFiles.size === 0) return [];

    setMessages(prev => [...prev, {
      text: '🔍 Researching your codebase…',
      sender: 'system',
      isResearchStatus: true,
    }]);
    scrollToBottom();

    try {
      const researchMessages = buildResearchPrompt(text, folderPath, workspaceFiles, gitIgnoredPaths);
      const researchResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, researchMessages);

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

          const researchedFiles = await readFilesForContext(chosenFiles);

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
          return researchedFiles;
        }
      }
    } catch { /* ignore research failures */ }

    // Clean up status if no files found
    setMessages(prev => prev.filter(m => !m.isResearchStatus));
    return [];
  }, [folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, readFilesForContext]);

  /** Step 2.5: Check if follow-up needs file changes */
  const runCheckStep = useCallback(async (
    text: string,
    history: ChatMessage[],
    ai: AIConfig,
  ): Promise<boolean> => {
    setMessages(prev => [...prev, {
      text: '🧠 Analyzing your request…',
      sender: 'system',
      isResearchStatus: true,
    }]);
    scrollToBottom();

    try {
      const checkMessages = buildCheckAgentPrompt(text, history);
      const checkResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, checkMessages);
      if (checkResult.success && checkResult.reply) {
        return parseCheckAgentResponse(checkResult.reply);
      }
    } catch { /* proceed without file changes */ }

    setMessages(prev => prev.filter(m => !m.isResearchStatus));
    return false;
  }, [scrollToBottom, setMessages]);

  /** Step 2.6: Plan and execute file changes with verification loop */
  const runFileChangeStep = useCallback(async (
    text: string,
    history: ChatMessage[],
    ai: AIConfig,
  ): Promise<void> => {
    // Clean up any leftover research status
    setMessages(prev => prev.filter(m => !m.isResearchStatus));

    setMessages(prev => [...prev, {
      text: '📋 Planning file changes…',
      sender: 'system' as const,
      isAgentProgress: true,
      agentActions: [],
    }]);
    scrollToBottom();

    await new Promise(r => setTimeout(r, 0));
    const progressMsgIdx = await new Promise<number>(resolve => {
      setMessages(prev => { resolve(prev.length - 1); return prev; });
    });

    let actionPlan: FileActionPlan[] = [];
    try {
      const planMessages = buildActionPlanPrompt(text, history, folderPath, workspaceFiles, gitIgnoredPaths);
      const planResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, planMessages);
      if (planResult.success && planResult.reply) {
        actionPlan = parseActionPlanResponse(planResult.reply);
      }
    } catch { /* no plan */ }

    if (actionPlan.length === 0) {
      setMessages(prev => prev.filter(m => !m.isAgentProgress));
      return;
    }

    let completedProgress: FileActionProgress[] = [];
    let attempt = 0;
    const MAX_ATTEMPTS = 3;
    let currentPlan = actionPlan;

    while (attempt < MAX_ATTEMPTS && currentPlan.length > 0) {
      attempt++;
      completedProgress = await executeFileActions(currentPlan, text, history, ai, progressMsgIdx);

      // Verify
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
        .map(p => ({ file: p.plan.file, action: p.plan.action, diff: p.diff }));

      if (changedForVerify.length === 0) break;

      try {
        const verifyMessages = buildVerifyPrompt(text, changedForVerify);
        const verifyResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, verifyMessages);
        if (verifyResult.success && verifyResult.reply) {
          const verification = parseVerifyResponse(verifyResult.reply);
          if (verification.satisfied || verification.missingChanges.length === 0) break;
          currentPlan = verification.missingChanges;
        } else break;
      } catch { break; }
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
  }, [folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, setHistory, executeFileActions]);

  return {
    readFilesForContext,
    getSystemContext,
    runResearchStep,
    runCheckStep,
    runFileChangeStep,
  };
}
