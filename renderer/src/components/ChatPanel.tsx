import { useState, useRef, useEffect, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import type { AISettings, ChatMessage } from '../types';
import SettingsModal from './SettingsModal';

interface DisplayMessage {
  text: string;
  sender: 'user' | 'bot';
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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
          if (!list.includes(s.selectedModel) && list.length > 0) {
            setSelectedModel(list[0]);
          }
        }
      } catch { /* settings not configured yet */ }
    })();
  }, []);

  const handleSettingsSaved = useCallback(async (s: AISettings) => {
    setSettings(s);
    setSelectedModel(s.selectedModel);
    const list = await window.electronAPI.aiListModels(s.baseUrl, s.apiKey);
    setModels(list);
    setReady(list.length > 0 && !!s.selectedModel);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !settings) return;

    const model = selectedModel || settings.selectedModel;
    if (!model) {
      setSettingsOpen(true);
      return;
    }

    // Add user message
    setMessages(prev => [...prev, { text, sender: 'user' }]);
    setInput('');
    scrollToBottom();

    const newHistory: ChatMessage[] = [...history, { role: 'user', content: text }];
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
  }, [input, loading, settings, selectedModel, history, scrollToBottom]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const clearChat = () => {
    setMessages([]);
    setHistory([]);
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

      {/* Model selector bar */}
      {models.length > 0 && (
        <div className="chat-model-bar">
          <select
            className="chat-model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
          >
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="chat-icon">🤖</span>
            {ready ? (
              <p>Hi! Ask me anything about your project.<br /><span className="chat-model-hint">Using <strong>{selectedModel}</strong></span></p>
            ) : (
              <div className="chat-setup">
                <p>Configure an AI provider to get started.</p>
                <button className="btn-primary chat-setup-btn" onClick={() => setSettingsOpen(true)}>
                  ⚙️ Open Settings
                </button>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              <div className="bubble">{msg.text}</div>
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

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={ready ? 'Type a message…' : 'Configure AI first…'}
          rows={1}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={!ready || loading}
        />
        <button className="chat-send" onClick={sendMessage} disabled={!ready || loading}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />
    </section>
  );
}
