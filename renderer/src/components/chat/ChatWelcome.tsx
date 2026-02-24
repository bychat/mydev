import type { ReactNode } from 'react';

interface ChatWelcomeProps {
  ready: boolean;
  selectedModel: string;
  onOpenSettings: () => void;
}

/**
 * Welcome message shown when chat is empty
 */
export default function ChatWelcome({
  ready,
  selectedModel,
  onOpenSettings,
}: ChatWelcomeProps) {
  return (
    <div className="chat-welcome">
      <span className="chat-icon">🤖</span>
      {ready ? (
        <p>
          Ask me anything about your project.
          <br />
          <span className="chat-model-hint">
            Using <strong>{selectedModel}</strong>
          </span>
        </p>
      ) : (
        <div className="chat-setup">
          <p>Configure an AI provider to get started.</p>
          <button className="btn-primary chat-setup-btn" onClick={onOpenSettings}>
            ⚙️ Open Settings
          </button>
        </div>
      )}
    </div>
  );
}
