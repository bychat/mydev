import { useState, useRef, useEffect, useCallback, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import type { AISettings, ChatMessage } from '../types';
import SettingsModal from './SettingsModal';
import { useWorkspace } from '../context/WorkspaceContext';

type ChatMode = 'Agent' | 'Chat' | 'Edit';

interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface DisplayMessage {
  text: string;
  sender: 'user' | 'bot';
  files?: AttachedFile[];
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋', css: '🎨', html: '🌐',
    md: '📝', py: '🐍', rs: '🦀', go: '🐹', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '🖥', bash: '🖥', zsh: '🖥', txt: '📄', svg: '🖼', png: '🖼', jpg: '🖼',
  };
  return map[ext] ?? '📄';
}

export default function ChatPanel() {
  const { openTabs, activeTabPath } = useWorkspace();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ChatMode>('Agent');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);

  // ── Suggested files from open editor tabs ──
  const suggestedFiles = openTabs
    .filter(t => !t.path.startsWith('diff:') && !attachedFiles.some(a => a.path === t.path))
    .map(t => ({ name: t.name, path: t.path }));

  // Highlight the active file at the top of suggestions
  const sortedSuggestions = [...suggestedFiles].sort((a, b) => {
    if (a.path === activeTabPath) return -1;
    if (b.path === activeTabPath) return 1;
    return 0;
  });

  const addSuggestedFile = useCallback(async (name: string, path: string) => {
    if (attachedFiles.some(a => a.path === path)) return;
    try {
      const result = await window.electronAPI.readFile(path);
      setAttachedFiles(prev => [...prev, { name, path, content: result.success ? result.content : undefined }]);
    } catch {
      setAttachedFiles(prev => [...prev, { name, path }]);
    }
    textareaRef.current?.focus();
  }, [attachedFiles]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Load settings & models on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await window.electronAPI.aiLoadSettings();
        setSettings(s);
        setSelectedModel(s.selectedModel);
        const list = await window.electronAPI.aiListModels(s.baseUrl, s.apiKey);
        setModels(list);
        if (list.length > 0) {
          setReady(true);
          if (!list.includes(s.selectedModel)) setSelectedModel(list[0]);
        }
      } catch { /* not configured */ }
    })();
  }, []);

  const handleSettingsSaved = useCallback(async (s: AISettings) => {
    setSettings(s);
    setSelectedModel(s.selectedModel);
    const list = await window.electronAPI.aiListModels(s.baseUrl, s.apiKey);
    setModels(list);
    setReady(list.length > 0 && !!s.selectedModel);
  }, []);

  // ── Drag & Drop ──
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filePath = (f as unknown as { path: string }).path; // Electron gives us .path
      if (!filePath) continue;
      const name = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? f.name;
      if (attachedFiles.some(a => a.path === filePath)) continue;
      // Read file content
      try {
        const result = await window.electronAPI.readFile(filePath);
        setAttachedFiles(prev => [...prev, { name, path: filePath, content: result.success ? result.content : undefined }]);
      } catch {
        setAttachedFiles(prev => [...prev, { name, path: filePath }]);
      }
    }
    textareaRef.current?.focus();
  }, [attachedFiles]);

  const removeFile = (path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  };

  // ── Send ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !settings) return;
    const model = selectedModel || settings.selectedModel;
    if (!model) { setSettingsOpen(true); return; }

    const currentFiles = [...attachedFiles];
    setMessages(prev => [...prev, { text, sender: 'user', files: currentFiles.length > 0 ? currentFiles : undefined }]);
    setInput('');
    setAttachedFiles([]);
    scrollToBottom();

    // Build context from attached files
    let contextPrefix = '';
    if (currentFiles.length > 0) {
      contextPrefix = currentFiles
        .filter(f => f.content)
        .map(f => `--- File: ${f.name} ---\n${f.content}`)
        .join('\n\n') + '\n\n';
    }

    const userContent = contextPrefix + text;
    const newHistory: ChatMessage[] = [...history, { role: 'user', content: userContent }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const result = await window.electronAPI.aiChat(settings.baseUrl, settings.apiKey, model, newHistory);
      if (result.success && result.reply) {
        setMessages(prev => [...prev, { text: result.reply!, sender: 'bot' }]);
        setHistory(prev => [...prev, { role: 'assistant', content: result.reply! }]);
      } else {
        setMessages(prev => [...prev, { text: `⚠️ ${result.error ?? 'Unknown error'}`, sender: 'bot' }]);
      }
    } catch (err: unknown) {
      setMessages(prev => [...prev, { text: `⚠️ ${(err as Error).message}`, sender: 'bot' }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, settings, selectedModel, history, attachedFiles, scrollToBottom]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  };

  const clearChat = () => { setMessages([]); setHistory([]); setAttachedFiles([]); };

  // ── Add Context (trigger native file dialog via hidden input) ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleAddContext = () => fileInputRef.current?.click();
  const handleFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filePath = (f as unknown as { path: string }).path;
      if (!filePath) continue;
      const name = filePath.split('/').pop() ?? f.name;
      if (attachedFiles.some(a => a.path === filePath)) continue;
      try {
        const result = await window.electronAPI.readFile(filePath);
        setAttachedFiles(prev => [...prev, { name, path: filePath, content: result.success ? result.content : undefined }]);
      } catch {
        setAttachedFiles(prev => [...prev, { name, path: filePath }]);
      }
    }
    e.target.value = '';
  };

  return (
    <section className="chat-panel">
      {/* Header */}
      <div className="chat-hdr">
        <h2>💬 Chat</h2>
        <div className="chat-hdr-actions">
          {messages.length > 0 && (
            <button className="chat-hdr-btn" onClick={clearChat} title="Clear chat">🗑</button>
          )}
          <button className="chat-hdr-btn" onClick={() => setSettingsOpen(true)} title="AI Settings">⚙️</button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="chat-icon">🤖</span>
            {ready ? (
              <p>Ask me anything about your project.<br /><span className="chat-model-hint">Using <strong>{selectedModel}</strong></span></p>
            ) : (
              <div className="chat-setup">
                <p>Configure an AI provider to get started.</p>
                <button className="btn-primary chat-setup-btn" onClick={() => setSettingsOpen(true)}>⚙️ Open Settings</button>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              <div className="bubble">
                {msg.files && msg.files.length > 0 && (
                  <div className="bubble-files">
                    {msg.files.map(f => (
                      <span key={f.path} className="file-chip-inline">{fileIcon(f.name)} {f.name}</span>
                    ))}
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="chat-msg bot">
            <div className="bubble chat-typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Input Composer (VS Code Copilot style) ── */}
      <div
        className={`chat-composer ${dragging ? 'drag-over' : ''}`}
        ref={inputBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File chips row */}
        {attachedFiles.length > 0 && (
          <div className="composer-files">
            {attachedFiles.map(f => (
              <span key={f.path} className="file-chip">
                {fileIcon(f.name)}
                <span className="file-chip-name">{f.name}</span>
                <button className="file-chip-remove" onClick={() => removeFile(f.path)}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Add Context + Suggestions */}
        <div className="composer-top">
          <button className="composer-add-ctx" onClick={handleAddContext} title="Add Context...">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.5 1a.5.5 0 0 1 .5.5V4h2.5a.5.5 0 0 1 0 1H12v2.5a.5.5 0 0 1-1 0V5H8.5a.5.5 0 0 1 0-1H11V1.5a.5.5 0 0 1 .5-.5z"/><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H8v1H3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8h1v4.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9z"/></svg>
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
                  {fileIcon(f.name)} {f.name}
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
                    <button key={m} className={`composer-dropdown-item ${m === mode ? 'active' : ''}`} onClick={() => { setMode(m); setModeMenuOpen(false); }}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model dropdown */}
            {models.length > 0 && (
              <div className="composer-dropdown-wrap">
                <select className="composer-model-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="composer-toolbar-right">
            {/* Tool icons */}
            <button className="composer-icon-btn" title="Tools">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A.5.5 0 0 0 8.914 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
            </button>
            <button className="composer-icon-btn" title="Keyboard shortcuts">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M14 5H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM2 4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H2z"/><path d="M13 10.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm0-2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-5 0A.25.25 0 0 1 8.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 8 8.75v-.5z"/></svg>
            </button>
            <button className="composer-icon-btn" title="History">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
            </button>
            <button className="composer-icon-btn" title="Voice input">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 11a3 3 0 0 0 3-3V3a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M12 8a.5.5 0 0 1 .5.5A4.5 4.5 0 0 1 8.5 13v1.5h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V13A4.5 4.5 0 0 1 3.5 8.5a.5.5 0 0 1 1 0A3.5 3.5 0 0 0 8 12a3.5 3.5 0 0 0 3.5-3.5.5.5 0 0 1 .5-.5z"/></svg>
            </button>
            {/* Send / Submit */}
            <button className="composer-send-btn" onClick={sendMessage} disabled={!ready || loading} title="Send">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.724 1.053a.5.5 0 0 1 .541-.054l12 6.5a.5.5 0 0 1 0 .882l-12 6.5A.5.5 0 0 1 1.5 14.5v-5.191l7.72-1.31L1.5 6.69V1.5a.5.5 0 0 1 .224-.447z"/></svg>
              <span className="caret">▾</span>
            </button>
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />
    </section>
  );
}
