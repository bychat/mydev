import type { ReactNode } from 'react';

interface ChatWelcomeProps {
  ready: boolean;
  selectedModel: string;
  onOpenSettings: () => void;
  isCopilotMode?: boolean;
  copilotInstalled?: boolean;
}

/**
 * Welcome message shown when chat is empty.
 * Shows different content for Copilot CLI vs Local AI modes.
 */
export default function ChatWelcome({
  ready,
  selectedModel,
  onOpenSettings,
  isCopilotMode = false,
  copilotInstalled = false,
}: ChatWelcomeProps) {
  if (isCopilotMode) {
    return (
      <div className="chat-welcome">
        <span className="chat-icon">✦</span>
        {copilotInstalled ? (
          <div>
            <p>
              Ask Copilot CLI anything about your code.
              <br />
              <span className="chat-model-hint">
                Using <strong>{selectedModel}</strong>
              </span>
            </p>
            <div className="chat-copilot-tips">
              <p className="chat-tip">
                💡 <strong>Shift+Tab</strong> to toggle Plan mode
              </p>
              <p className="chat-tip">
                💡 Prefix with <code>/plan</code> for implementation plans
              </p>
              <p className="chat-tip">
                💡 Copilot CLI streams responses directly from the CLI binary
              </p>
            </div>
          </div>
        ) : (
          <div className="chat-setup">
            <p>Copilot CLI is not installed. Install it to use this mode.</p>
            <button
              className="btn-primary chat-setup-btn"
              onClick={onOpenSettings}
            >
              📖 View Install Guide
            </button>
          </div>
        )}
      </div>
    );
  }

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
          <button
            className="btn-primary chat-setup-btn"
            onClick={onOpenSettings}
          >
            ⚙️ Open Settings
          </button>
        </div>
      )}
    </div>
  );
}
