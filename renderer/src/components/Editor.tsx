import { useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import EditorTabs from './EditorTabs';
import DiffViewer from './DiffViewer';
import type { DiffResult } from '../types';

export default function Editor() {
  const { openTabs, activeTabPath, updateTabContent, saveFile } = useWorkspace();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLPreElement>(null);
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  const isDiff = activeTab?.path.startsWith('diff:');

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (activeTabPath) saveFile(activeTabPath); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabPath, saveFile]);

  const updateLines = useCallback(() => {
    if (!textareaRef.current || !lineNumRef.current) return;
    const count = textareaRef.current.value.split('\n').length;
    lineNumRef.current.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  }, []);

  useEffect(updateLines, [activeTab?.content, updateLines]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (activeTabPath) updateTabContent(activeTabPath, e.target.value);
    updateLines();
  };

  const handleScroll = () => {
    if (lineNumRef.current && textareaRef.current) lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current!;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      ta.value = value.substring(0, s) + '  ' + value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 2;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  if (!activeTab) return null;

  // Diff view
  if (isDiff) {
    let diff: DiffResult;
    try { diff = JSON.parse(activeTab.content); }
    catch { diff = { oldContent: '', newContent: activeTab.content }; }
    const realPath = activeTab.path.replace('diff:', '');
    const fileName = realPath.split('/').pop() ?? realPath;
    return (
      <div className="editor-container">
        <EditorTabs />
        <DiffViewer diff={diff} fileName={fileName} />
      </div>
    );
  }

  return (
    <div className="editor-container">
      <EditorTabs />
      <div className="editor-toolbar">
        <span className="editor-path">{activeTab.path}</span>
        <div className="editor-actions">
          {activeTab.readOnly ? (
            <span className="readonly-badge">Read Only</span>
          ) : (
            <>
              <span className={activeTab.modified ? 'modified' : 'saved'}>{activeTab.modified ? 'Modified' : 'Saved'}</span>
              <button className="btn-save" onClick={() => saveFile(activeTabPath!)}>💾 Save</button>
            </>
          )}
        </div>
      </div>
      <div className="editor-body">
        <pre className="line-numbers" ref={lineNumRef} />
        <textarea
          ref={textareaRef}
          className="code-area"
          value={activeTab.content}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={activeTab.readOnly}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
