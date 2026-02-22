import { useState, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { text, sender: 'user' }]);
    setInput('');
    scrollToBottom();
    setTimeout(() => {
      setMessages(prev => [...prev, { text: 'This is a placeholder response. Connect an AI backend to power real replies!', sender: 'bot' }]);
      scrollToBottom();
    }, 600);
  }, [input, scrollToBottom]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <section className="chat-panel">
      <div className="chat-hdr"><h2>💬 Chat</h2></div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome"><span className="chat-icon">🤖</span><p>Hi! How can I help you with your project?</p></div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              <div className="bubble">{msg.text}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="chat-input-area">
        <textarea className="chat-input" placeholder="Type a message…" rows={1} value={input} onChange={handleInput} onKeyDown={handleKeyDown} />
        <button className="chat-send" onClick={sendMessage}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
    </section>
  );
}
