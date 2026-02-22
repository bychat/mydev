import React, { useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import EditorTabs from './EditorTabs';
import '../styles/editor.css';

export default function Editor() {
  const {
    openTabs, activeTabPath,
    updateTabContent, saveFile,
  } = useWorkspace();

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  // Keyboard shortcut: Cmd/Ctrl + S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeTabPath) saveFile(activeTabPath);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, saveFile]);

  // Update line numbers
  const updateLineNumbers = useCallback(() => {
    if (!textareaRef.current || !lineNumbersRef.current) return;
    const count = textareaRef.current.value.split('\n').length;
    lineNumbersRef.current.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  }, []);

  useEffect(() => {
    updateLineNumbers();
  }, [activeTab?.content, updateLineNumbers]);

  const handleChange = (e) => {
    if (activeTabPath) updateTabContent(activeTabPath, e.target.value);
    updateLineNumbers();
  };

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      ta.value = val.substring(0, start) + '  ' + val.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  if (!activeTab) return null;

  return (
    <div className="editor-container">
      <EditorTabs />
      <div className="editor-toolbar">
        <span className="editor-filepath">{activeTab.path}</span>
        <div className="editor-toolbar-right">
          <span className={`editor-status${activeTab.modified ? ' modified' : ''}`}>
            {activeTab.modified ? 'Modified' : 'Saved'}
          </span>
          <button className="btn-save" onClick={() => saveFile(activeTabPath)} title="Save (⌘S)">
            💾 Save
          </button>
        </div>
      </div>
      <div className="editor-body">
        <pre className="editor-line-numbers" ref={lineNumbersRef} />
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={activeTab.content}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
