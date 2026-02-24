/**
 * AI prompt builders for the chat system
 */

import type { ChatMessage, FileActionPlan } from '../types';

/**
 * Build system context message with workspace information
 */
export function buildSystemContext(
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[]
): ChatMessage {
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
}

/**
 * Build research agent prompt to pick relevant files
 */
export function buildResearchPrompt(
  userQuestion: string,
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[]
): ChatMessage[] {
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
}

/**
 * Parse research agent response into file paths
 */
export function parseResearchResponse(raw: string, workspaceFiles: Set<string>): string[] {
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'string')) {
      const valid = (parsed as string[]).filter(f => workspaceFiles.has(f));
      return valid.slice(0, 9);
    }
  } catch {
    // fallback
  }
  return [];
}

/**
 * Build check agent prompt to detect file change needs
 */
export function buildCheckAgentPrompt(
  userMessage: string,
  chatHistory: ChatMessage[]
): ChatMessage[] {
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

  const recent = chatHistory.slice(-6);
  return [system, ...recent, { role: 'user', content: userMessage }];
}

/**
 * Parse check agent response
 */
export function parseCheckAgentResponse(raw: string): boolean {
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return !!parsed.needsFileChanges;
  } catch {
    const lower = raw.toLowerCase();
    return lower.includes('"needsfilechanges": true') || lower.includes('"needsfilechanges":true');
  }
}

/**
 * Build action plan prompt for file changes
 */
export function buildActionPlanPrompt(
  userMessage: string,
  chatHistory: ChatMessage[],
  folderPath: string | null,
  workspaceFiles: Set<string>,
  gitIgnoredPaths: string[]
): ChatMessage[] {
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
}

/**
 * Parse action plan response
 */
export function parseActionPlanResponse(raw: string): FileActionPlan[] {
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
  } catch {
    // fallback
  }
  return [];
}

/**
 * Build file change prompt for SEARCH/REPLACE
 */
export function buildFileChangePrompt(
  plan: FileActionPlan,
  currentContent: string | null,
  userRequest: string,
  chatHistory: ChatMessage[]
): ChatMessage[] {
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
}

/**
 * Build verification prompt
 */
export function buildVerifyPrompt(
  userRequest: string,
  changedFiles: { file: string; action: string; diff?: { before: string; after: string } }[]
): ChatMessage[] {
  const summary = changedFiles.map(f => {
    if (f.action === 'delete') return `- **DELETED** ${f.file}`;
    if (f.action === 'create') return `- **CREATED** ${f.file}`;
    if (f.diff) {
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
}

/**
 * Parse verification response
 */
export function parseVerifyResponse(raw: string): {
  satisfied: boolean;
  reason: string;
  missingChanges: FileActionPlan[];
} {
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      satisfied: !!parsed.satisfied,
      reason: parsed.reason ?? '',
      missingChanges: Array.isArray(parsed.missingChanges)
        ? parsed.missingChanges.map((x: any) => ({
            file: x.file,
            action: x.action ?? 'update',
            description: x.description ?? '',
          }))
        : [],
    };
  } catch {
    return { satisfied: true, reason: 'Unable to parse verification response', missingChanges: [] };
  }
}
