/**
 * StartPageChat - A simple chat interface for the start page
 * Allows users to ask general questions without a workspace selected
 * Agent mode is greyed out until a workspace is selected
 */
import { useState, useRef, useCallback, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useBackend } from '../../context/BackendContext';
import { SendIcon, StopIcon, MessageCircleIcon } from '../icons';
import type { ChatMessage, DisplayMessage } from '../../types';

interface StartPageChatProps {
  onWorkspaceCreated?: (folderPath: string) => void;
}

export default function StartPageChat({ onWorkspaceCreated }: StartPageChatProps) {
  const backend = useBackend();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionFolderPath, setSessionFolderPath] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, []);

  // Create session folder if needed and get response
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Add user message to display
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);

    try {
      // Create session folder if not exists
      let folderPath = sessionFolderPath;
      if (!folderPath) {
        const result = await backend.sessionCreateFolder(userMessage.slice(0, 30));
        if (result.success && result.folderPath) {
          folderPath = result.folderPath;
          setSessionFolderPath(folderPath);
        } else {
          setMessages(prev => [...prev, { 
            text: `Failed to create session: ${result.error || 'Unknown error'}`, 
            sender: 'bot' 
          }]);
          setLoading(false);
          return;
        }
      }

      // Get AI response using the chat endpoint
      const settings = await backend.aiLoadSettings();
      if (!settings.apiKey || !settings.baseUrl) {
        setMessages(prev => [...prev, { 
          text: 'Please configure your AI settings first. Go to Settings to add your API key.', 
          sender: 'bot' 
        }]);
        setLoading(false);
        return;
      }

      // Simple chat without agent capabilities
      const chatHistory: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant. The user is asking a general question without a specific workspace context. Be helpful and informative.'
        },
        ...messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        } as ChatMessage)),
        { role: 'user', content: userMessage }
      ];

      const response = await backend.aiChat(
        settings.baseUrl,
        settings.apiKey,
        settings.model || 'gpt-4o-mini',
        chatHistory
      );

      if (response.success && response.reply) {
        setMessages(prev => [...prev, { text: response.reply, sender: 'bot' }]);
      } else {
        setMessages(prev => [...prev, { 
          text: `Error: ${response.error || 'Failed to get response'}`, 
          sender: 'bot' 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 
        sender: 'bot' 
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionFolderPath, backend]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Open as workspace
  const handleOpenWorkspace = useCallback(() => {
    if (sessionFolderPath) {
      window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath: sessionFolderPath } }));
      onWorkspaceCreated?.(sessionFolderPath);
    }
  }, [sessionFolderPath, onWorkspaceCreated]);

  // Collapsed state - just show the chat icon button
  if (!expanded) {
    return (
      <div className="start-page-chat-collapsed">
        <button 
          className="start-page-chat-toggle"
          onClick={() => setExpanded(true)}
          title="Open quick chat"
        >
          <MessageCircleIcon />
          <span>Quick Chat</span>
        </button>
      </div>
    );
  }

  return (
    <div className="start-page-chat">
      <div className="start-page-chat-header">
        <div className="start-page-chat-title">
          <MessageCircleIcon />
          <span>Quick Chat</span>
        </div>
        <button 
          className="start-page-chat-close"
          onClick={() => setExpanded(false)}
          title="Minimize"
        >
          ×
        </button>
      </div>

      <div className="start-page-chat-messages">
        {messages.length === 0 && (
          <div className="start-page-chat-empty">
            <p>Ask me anything! This is a general chat without workspace context.</p>
            <p className="start-page-chat-hint">
              <span className="agent-disabled">Agent mode</span> is available after you select a workspace.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`start-page-chat-message ${msg.sender}`}>
            <div className="message-content">{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="start-page-chat-message bot">
            <div className="message-content loading">
              <span className="dot">•</span>
              <span className="dot">•</span>
              <span className="dot">•</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {sessionFolderPath && (
        <div className="start-page-chat-session-bar">
          <span>Session created</span>
          <button onClick={handleOpenWorkspace}>Open as Workspace →</button>
        </div>
      )}

      <div className="start-page-chat-composer">
        <textarea
          ref={textareaRef}
          placeholder="Ask anything..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button 
          className="start-page-chat-send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          title="Send"
        >
          {loading ? <StopIcon /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}
