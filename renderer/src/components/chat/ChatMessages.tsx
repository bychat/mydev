import { type RefObject } from 'react';
import Markdown from '../Markdown';
import AgentActionRow from './AgentActionRow';
import { getFileIcon } from '../../utils/fileIcons';
import type { FileActionProgress } from '../../types';

export interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

export interface DisplayMessage {
  text: string;
  sender: 'user' | 'bot' | 'system';
  files?: AttachedFile[];
  isResearchStatus?: boolean;
  isAgentProgress?: boolean;
  agentActions?: FileActionProgress[];
  verifyAttempt?: number;
}

interface ChatMessagesProps {
  messages: DisplayMessage[];
  loading: boolean;
  workspaceFiles: Set<string>;
  onFileClick: (relativePath: string) => void;
  endRef: RefObject<HTMLDivElement>;
}

/**
 * Chat messages list component
 */
export default function ChatMessages({
  messages,
  loading,
  workspaceFiles,
  onFileClick,
  endRef,
}: ChatMessagesProps) {
  return (
    <div className="chat-messages">
      {messages.map((msg, i) => (
        <div key={i} className={`chat-msg ${msg.sender}`}>
          <div className="bubble">
            {/* Attached files */}
            {msg.files && msg.files.length > 0 && (
              <div className="bubble-files">
                {msg.files.map((f) => (
                  <span key={f.path} className="file-chip-inline">
                    {getFileIcon(f.name)} {f.name}
                  </span>
                ))}
              </div>
            )}

            {/* Agent progress panel */}
            {msg.isAgentProgress && msg.agentActions && msg.agentActions.length > 0 && (
              <div className="agent-progress">
                {msg.agentActions.map((action, j) => (
                  <AgentActionRow
                    key={`${action.plan.file}-${j}`}
                    action={action}
                    onFileClick={onFileClick}
                  />
                ))}
                {msg.verifyAttempt && (
                  <div className="agent-verify-badge">
                    🔄 Verification attempt {msg.verifyAttempt}/3
                  </div>
                )}
              </div>
            )}

            {/* Message content */}
            {msg.sender === 'bot' ? (
              <div className="md-content">
                <Markdown workspaceFiles={workspaceFiles} onFileClick={onFileClick}>
                  {msg.text}
                </Markdown>
              </div>
            ) : (
              !msg.isAgentProgress && msg.text
            )}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {loading &&
        (messages.length === 0 || messages[messages.length - 1].sender !== 'bot') && (
          <div className="chat-msg bot">
            <div className="bubble chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

      <div ref={endRef} />
    </div>
  );
}
