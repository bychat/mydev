import { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { SearchMatch, SearchOptions } from '../types';
import { getFileIcon } from '../utils';

export default function SearchPanel() {
  const { folderPath, openFile } = useWorkspace();
  const backend = useBackend();
  
  const [query, setQuery] = useState('');
  const [searchFileNames, setSearchFileNames] = useState(true);
  const [searchFileContents, setSearchFileContents] = useState(true);
  const [respectGitignore, setRespectGitignore] = useState(true);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFiles, setSearchedFiles] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!folderPath || !searchQuery.trim()) {
      setResults([]);
      setSearchedFiles(0);
      return;
    }

    setSearching(true);
    try {
      const options: SearchOptions = {
        query: searchQuery.trim(),
        searchFileNames,
        searchFileContents,
        respectGitignore,
        maxResults: 100,
      };
      const result = await backend.searchFiles(folderPath, options);
      if (result.success) {
        setResults(result.matches);
        setSearchedFiles(result.searchedFiles);
      } else {
        setResults([]);
        setSearchedFiles(0);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [folderPath, searchFileNames, searchFileContents, respectGitignore]);

  // Trigger search on query or options change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!query.trim()) {
      setResults([]);
      setSearchedFiles(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleResultClick = (match: SearchMatch) => {
    if (!folderPath) return;
    const fullPath = `${folderPath}/${match.filePath}`;
    openFile(match.fileName, fullPath);
  };

  // Group results by file for better display
  const groupedResults = results.reduce((acc, match) => {
    const key = match.filePath;
    if (!acc[key]) {
      acc[key] = { fileName: match.fileName, filePath: match.filePath, matches: [] };
    }
    acc[key].matches.push(match);
    return acc;
  }, {} as Record<string, { fileName: string; filePath: string; matches: SearchMatch[] }>);

  return (
    <div className="search-panel">
      <div className="sidebar-hdr">
        <h2>🔍 Search</h2>
        <button 
          className="search-options-toggle"
          onClick={() => setShowOptions(!showOptions)}
          title="Search options"
        >
          ⚙
        </button>
      </div>
      
      <div className="sidebar-actions">
        <input
          className="search-input"
          placeholder="Search files and text…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Search Options */}
      {showOptions && (
        <div className="search-options">
          <label className="search-option">
            <input
              type="checkbox"
              checked={searchFileNames}
              onChange={e => setSearchFileNames(e.target.checked)}
            />
            <span>Search file names</span>
          </label>
          <label className="search-option">
            <input
              type="checkbox"
              checked={searchFileContents}
              onChange={e => setSearchFileContents(e.target.checked)}
            />
            <span>Search file contents</span>
          </label>
          <label className="search-option">
            <input
              type="checkbox"
              checked={respectGitignore}
              onChange={e => setRespectGitignore(e.target.checked)}
            />
            <span>Ignore .gitignore files</span>
          </label>
        </div>
      )}

      {/* Status */}
      {searching && (
        <div className="search-status">Searching…</div>
      )}
      {!searching && query && results.length > 0 && (
        <div className="search-status">
          {results.length} match{results.length !== 1 ? 'es' : ''} 
          {searchFileContents && ` in ${searchedFiles} files`}
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {Object.values(groupedResults).map(group => (
          <div key={group.filePath} className="search-result-group">
            <div 
              className="search-result-file"
              onClick={() => handleResultClick(group.matches[0])}
            >
              <span className="search-result-icon">{getFileIcon(group.fileName)}</span>
              <span className="search-result-name">{group.fileName}</span>
              <span className="search-result-path">{group.filePath.split('/').slice(0, -1).join('/')}</span>
            </div>
            {group.matches.filter(m => m.matchType === 'content').map((match, idx) => (
              <div 
                key={`${match.filePath}-${match.lineNumber}-${idx}`}
                className="search-result-line"
                onClick={() => handleResultClick(match)}
              >
                <span className="search-result-linenum">:{match.lineNumber}</span>
                <span className="search-result-content">
                  {highlightMatch(match.lineContent || '', query)}
                </span>
              </div>
            ))}
          </div>
        ))}
        
        {!searching && query && results.length === 0 && (
          <div className="sc-empty">No matches found</div>
        )}
        
        {!query && (
          <div className="search-hint">
            Type to search file names and contents
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Highlight matching text in search results.
 * Limits to first 3 highlights per line for performance.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIdx = 0;
  let searchStart = 0;
  let key = 0;
  let highlightCount = 0;
  const MAX_HIGHLIGHTS = 3;
  
  while (searchStart < lowerText.length && highlightCount < MAX_HIGHLIGHTS) {
    const matchIdx = lowerText.indexOf(lowerQuery, searchStart);
    if (matchIdx === -1) break;
    
    if (matchIdx > lastIdx) {
      parts.push(<span key={key++}>{text.slice(lastIdx, matchIdx)}</span>);
    }
    parts.push(
      <mark key={key++} className="search-highlight">
        {text.slice(matchIdx, matchIdx + query.length)}
      </mark>
    );
    lastIdx = matchIdx + query.length;
    searchStart = lastIdx;
    highlightCount++;
  }
  
  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  }
  
  return parts.length > 0 ? parts : text;
}
