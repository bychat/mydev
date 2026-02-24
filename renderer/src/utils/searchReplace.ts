/**
 * Search/Replace block utilities for AI code editing
 */

/**
 * Strip markdown code fences from text
 */
export function stripMarkdownFences(text: string): string {
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

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

/**
 * Parse SEARCH/REPLACE blocks from AI response
 */
export function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
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

/**
 * Apply SEARCH/REPLACE blocks to file content
 */
export function applySearchReplaceBlocks(content: string, blocks: SearchReplaceBlock[]): string {
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
