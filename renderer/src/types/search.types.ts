/**
 * Search-related types
 */

export interface SearchOptions {
  query: string;
  searchFileNames: boolean;
  searchFileContents: boolean;
  respectGitignore: boolean;
  maxResults?: number;
}

export interface SearchMatch {
  filePath: string;          // Relative path from folder root
  fileName: string;
  matchType: 'filename' | 'content';
  lineNumber?: number;       // For content matches
  lineContent?: string;      // Line containing the match
  matchStart?: number;       // Start position in line
  matchEnd?: number;         // End position in line
}

export interface SearchResult {
  success: boolean;
  matches: SearchMatch[];
  searchedFiles: number;
  error?: string;
}
