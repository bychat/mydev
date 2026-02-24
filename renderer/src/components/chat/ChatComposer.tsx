import {
  type RefObject,
  type ChangeEvent,
  type KeyboardEvent,
  type DragEvent,
} from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import {
  AddFileIcon,
  SendIcon,
  StopIcon,
  FolderIcon,
  KeyboardIcon,
  ClockIcon,
  MicrophoneIcon,
} from '../icons';

type ChatMode = 'Agent' | 'Chat' | 'Edit';

interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface SuggestedFile {
  name: string;
  path: string;
}

interface ChatComposerProps {
  input: string;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  ready: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (path: string) => void;
  onAddContext: () => void;
  suggestedFiles: SuggestedFile[];
  activeTabPath: string | null;
  onAddSuggestedFile: (name: string, path: string) => void;
  dragging: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  onFilePick: (e: ChangeEvent<HTMLInputElement>) => void;
}

const chatModes: ChatMode[] = ['Agent', 'Chat', 'Edit'];

/**
 * Chat composer component with input, file attachments, and controls
 */
export default function ChatComposer({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  loading,
  ready,
  mode,
  onModeChange,
  models,
  selectedModel,
  onModelChange,
  attachedFiles,
  onRemoveFile,
  onAddContext,
  suggestedFiles,
  activeTabPath,
  onAddSuggestedFile,
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  textareaRef,
  fileInputRef,
  onFilePick,
}: ChatComposerProps) {
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);

  return (
    <div
      className={`chat-composer ${dragging ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* File chips row */}
      {attachedFiles.length > 0 && (
        <div className="composer-files">
          {attachedFiles.map((f) => (
            <span key={f.path} className="file-chip">
              {getFileIcon(f.name)}
              <span className="file-chip-name">{f.name}</span>
              <button
                className="file-chip-remove"
                onClick={() => onRemoveFile(f.path)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Context + Suggestions */}
      <div className="composer-top">
        <button
          className="composer-add-ctx"
          onClick={onAddContext}
          title="Add Context..."
        >
          <AddFileIcon />
          Add Context…
        </button>
        {suggestedFiles.length > 0 && (
          <div className="composer-suggestions">
            {suggestedFiles.map((f) => (
              <button
                key={f.path}
                className={`composer-suggestion-chip ${f.path === activeTabPath ? 'active-file' : ''}`}
                onClick={() => onAddSuggestedFile(f.name, f.path)}
                title={`Add ${f.name} as context`}
              >
                {getFileIcon(f.name)} {f.name}
              </button>
            ))}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFilePick}
          multiple
          hidden
        />
      </div>

      <textarea
        ref={textareaRef}
        className="composer-textarea"
        placeholder={ready ? 'Ask anything, @ to mention…' : 'Configure AI first…'}
        rows={1}
        value={input}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        disabled={!ready || loading}
      />

      {/* Bottom toolbar */}
      <div className="composer-toolbar">
        <div className="composer-toolbar-left">
          {/* Mode dropdown */}
          <div className="composer-dropdown-wrap">
            <button
              className="composer-dropdown-btn"
              onClick={() => setModeMenuOpen((p) => !p)}
            >
              {mode} <span className="caret">▾</span>
            </button>
            {modeMenuOpen && (
              <div className="composer-dropdown-menu">
                {chatModes.map((m) => (
                  <button
                    key={m}
                    className={`composer-dropdown-item ${m === mode ? 'active' : ''}`}
                    onClick={() => {
                      onModeChange(m);
                      setModeMenuOpen(false);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model dropdown */}
          {models.length > 0 && (
            <div className="composer-dropdown-wrap">
              <select
                className="composer-model-select"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="composer-toolbar-right">
          {/* Tool icons */}
          <button className="composer-icon-btn" title="Tools">
            <FolderIcon />
          </button>
          <button className="composer-icon-btn" title="Keyboard shortcuts">
            <KeyboardIcon />
          </button>
          <button className="composer-icon-btn" title="History">
            <ClockIcon />
          </button>
          <button className="composer-icon-btn" title="Voice input">
            <MicrophoneIcon />
          </button>

          {/* Send / Stop */}
          {loading ? (
            <button
              className="composer-stop-btn"
              onClick={onStop}
              title="Stop generating"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className="composer-send-btn"
              onClick={onSend}
              disabled={!ready}
              title="Send"
            >
              <SendIcon />
              <span className="caret">▾</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Import React for useState
import React from 'react';
