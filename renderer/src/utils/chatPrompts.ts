/**
 * AI prompt builders for the chat system
 *
 * Re-exports shared logic from core/chat.ts and provides thin
 * renderer-specific wrappers that accept Set<string> / gitIgnoredPaths.
 */

import type { ChatMessage, FileActionPlan } from '../types';
import {
  buildSystemContext as _buildSystemContext,
  buildResearchPrompt as _buildResearchPrompt,
  parseResearchResponse,
  buildCheckAgentPrompt,
  parseCheckAgentResponse,
  buildActionPlanPrompt as _buildActionPlanPrompt,
  parseActionPlanResponse,
  buildFileChangePrompt,
  buildVerifyPrompt,
  parseVerifyResponse,
} from '../../../core/chat';

// Re-export everything the renderer already imports
export {
  parseResearchResponse,
  buildCheckAgentPrompt,
  parseCheckAgentResponse,
  parseActionPlanResponse,
  buildFileChangePrompt,
  buildVerifyPrompt,
  parseVerifyResponse,
};

// ─── Renderer-specific wrappers (accept Set<string> + gitIgnoredPaths) ───

function filterFiles(
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[],
): string[] {
  return Array.from(workspaceFiles)
    .filter(rel => {
      if (!folderPath || gitIgnoredPaths.length === 0) return true;
      const abs = `${folderPath}/${rel}`;
      return !gitIgnoredPaths.some(ip => abs === ip || abs.startsWith(ip + '/'));
    })
    .sort();
}

export function buildSystemContext(
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[],
): ChatMessage {
  const fileList = filterFiles(folderPath, workspaceFiles, gitIgnoredPaths);
  return _buildSystemContext(folderPath, fileList);
}

export function buildResearchPrompt(
  userQuestion: string,
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[],
  searchResults?: { query: string; matches: Array<{ filePath: string; lineContent?: string }> }[],
): ChatMessage[] {
  const fileList = filterFiles(folderPath, workspaceFiles, gitIgnoredPaths);
  return _buildResearchPrompt(userQuestion, folderPath, fileList, searchResults);
}

export function buildActionPlanPrompt(
  userMessage: string,
  chatHistory: ChatMessage[],
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[],
): ChatMessage[] {
  const fileList = filterFiles(folderPath, workspaceFiles, gitIgnoredPaths);
  return _buildActionPlanPrompt(userMessage, chatHistory, folderPath, fileList);
}
