/**
 * HtmlPreview - Inline rendered preview for full HTML documents detected in chat.
 * Shows HTML in a sandboxed iframe that updates in real-time during streaming.
 * Includes action bar with Copy / Save / Source toggle.
 *
 * Supports two contexts:
 * - Inside workspace: Save writes file to workspace
 * - Start page: Open button opens workspace + preview tab
 *
 * During streaming, iframe updates are throttled (~800ms) to avoid flicker.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface HtmlPreviewProps {
  html: string;
  /** Optional: session folder path (used on start page to open workspace) */
  sessionFolderPath?: string | null;
  /** Whether content is still being streamed */
  isStreaming?: boolean;
}

/** Detect whether a code string is a full HTML document (not just a fragment) */
export function isFullHtmlDocument(code: string): boolean {
  const lower = code.trim().toLowerCase();
  const hasDoctype = lower.startsWith('<!doctype html');
  const hasHtmlTag = lower.includes('<html');
  const hasBody = lower.includes('<body');
  const hasHead = lower.includes('<head');
  return hasDoctype || (hasHtmlTag && (hasBody || hasHead));
}

/** Generate a short name from the HTML content (title tag or fallback) */
export function extractPreviewName(html: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].trim().slice(0, 40);
    if (title) return title;
  }
  return 'Preview';
}

/**
 * Extract the first full HTML document from markdown text (inside ```html blocks or raw).
 * When `isStreaming` is true, also detects partial code blocks (no closing ```) so the
 * preview appears immediately when HTML is first detected.
 */
export function extractHtmlFromMarkdown(text: string, isStreaming?: boolean): string | null {
  // Complete code blocks (with closing ```)
  const codeBlockRegex = /```html\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const code = match[1].trim();
    if (isFullHtmlDocument(code)) return code;
  }

  // During streaming, detect partial code blocks (assume ending will come)
  if (isStreaming) {
    const partialRegex = /```html\s*\n([\s\S]+)$/i;
    const partialMatch = partialRegex.exec(text);
    if (partialMatch) {
      const code = partialMatch[1].trim();
      if (isFullHtmlDocument(code)) return code;
    }
  }

  if (isFullHtmlDocument(text.trim())) return text.trim();
  return null;
}

export default function HtmlPreview({ html, sessionFolderPath, isStreaming }: HtmlPreviewProps) {
  const backend = useBackend();
  const { folderPath, openFile, refreshTree } = useWorkspace();
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlRef = useRef(html);
  htmlRef.current = html;

  const name = extractPreviewName(html);
  const lines = html.split('\n').length;

  // Write HTML to iframe via contentDocument to avoid full srcdoc reloads
  const writeToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(content);
      doc.close();
    } catch {
      // Fallback: set srcdoc attribute directly
      iframe.srcdoc = content;
    }
  }, []);

  // Streaming: throttled updates via interval
  useEffect(() => {
    if (viewMode !== 'preview' || !isStreaming) return;
    writeToIframe(htmlRef.current);
    const id = setInterval(() => writeToIframe(htmlRef.current), 800);
    return () => clearInterval(id);
  }, [isStreaming, viewMode, writeToIframe]);

  // Non-streaming: immediate updates when html changes
  useEffect(() => {
    if (viewMode !== 'preview' || isStreaming) return;
    writeToIframe(html);
  }, [html, isStreaming, viewMode, writeToIframe]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [html]);

  const handleSave = useCallback(async () => {
    if (!folderPath) return;
    setSaving(true);
    try {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
      const fileName = `${safeName || 'preview'}.html`;
      const filePath = `${folderPath}/${fileName}`;
      const result = await backend.createFile(filePath, html);
      if (result.success) {
        setSaved(fileName);
        await refreshTree();
        openFile(fileName, filePath);
        setTimeout(() => setSaved(null), 3000);
      }
    } catch (err) {
      console.error('[HtmlPreview] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [folderPath, html, name, backend, openFile, refreshTree]);

  const handleOpenWorkspace = useCallback(() => {
    if (sessionFolderPath) {
      window.dispatchEvent(new CustomEvent('open-workspace', {
        detail: {
          folderPath: sessionFolderPath,
          openPreview: true,
          previewHtml: html,
          previewName: name,
        }
      }));
    }
  }, [html, name, sessionFolderPath]);

  return (
    <div className={`html-extract${isStreaming ? ' streaming' : ''}`}>
      <div className="html-extract-header">
        <span className="html-extract-icon">🌐</span>
        <span className="html-extract-name" title={name}>{name}</span>
        <span className={`html-extract-meta${isStreaming ? ' pulse' : ''}`}>
          {isStreaming && <span className="streaming-dot" />}
          {lines} ln
        </span>
        <div className="html-extract-actions">
          <button
            className={`html-extract-btn${viewMode === 'preview' ? ' active' : ''}`}
            onClick={() => setViewMode(v => v === 'preview' ? 'source' : 'preview')}
            title={viewMode === 'preview' ? 'Show source' : 'Show preview'}
          >
            {viewMode === 'preview' ? '⟨/⟩' : '▶'}
          </button>
          <button className="html-extract-btn" onClick={handleCopy} title="Copy HTML">
            {copied ? '✓' : '⎘'}
          </button>
          {folderPath ? (
            <button
              className="html-extract-btn save"
              onClick={handleSave}
              disabled={saving}
              title="Save to workspace"
            >
              {saved ? `✓ ${saved}` : saving ? '…' : '💾 Save'}
            </button>
          ) : sessionFolderPath ? (
            <button className="html-extract-btn primary" onClick={handleOpenWorkspace} title="Open in workspace">
              ▶ Open
            </button>
          ) : null}
        </div>
      </div>

      {viewMode === 'preview' ? (
        <div className="html-extract-iframe-wrap">
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            className="html-extract-iframe"
            title={name}
          />
        </div>
      ) : (
        <div className="html-extract-code">
          <pre className="html-extract-pre"><code>{html}</code></pre>
        </div>
      )}
    </div>
  );
}
