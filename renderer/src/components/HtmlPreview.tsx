/**
 * HtmlPreview - Extracted collapsible preview for complete HTML documents.
 * Uses contentDocument.write() to avoid iframe blink on re-renders.
 * Debounces updates during streaming so preview stays smooth.
 */
import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface HtmlPreviewProps {
  html: string;
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
 * Stable iframe that writes HTML via contentDocument instead of srcDoc.
 * This prevents the iframe from being destroyed/recreated on every render.
 */
function StableIframe({ html, title }: { html: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastWrittenRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write — updates at most every 600ms during streaming
  useEffect(() => {
    if (!iframeRef.current) return;
    // If content hasn't changed, skip
    if (html === lastWrittenRef.current) return;

    const write = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          lastWrittenRef.current = html;
        }
      } catch {
        // fallback: use srcdoc
        iframe.srcdoc = html;
        lastWrittenRef.current = html;
      }
    };

    // If we have a pending write, clear it
    if (timerRef.current) clearTimeout(timerRef.current);

    // If this is the first write, do it immediately
    if (!lastWrittenRef.current) {
      write();
    } else {
      // Otherwise debounce
      timerRef.current = setTimeout(write, 600);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="html-extract-frame"
      sandbox="allow-scripts"
      title={title}
    />
  );
}

const HtmlPreview = memo(function HtmlPreview({ html }: HtmlPreviewProps) {
  const backend = useBackend();
  const { folderPath, openFile, refreshTree } = useWorkspace();
  const [previewOpen, setPreviewOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const name = extractPreviewName(html);
  const lines = html.split('\n').length;

  const handleLivePreview = useCallback(() => {
    const tabKey = `html-preview:${Date.now()}`;
    window.dispatchEvent(new CustomEvent('open-html-preview-tab', {
      detail: { name, tabKey, html }
    }));
  }, [html, name]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [html]);

  const handleSave = useCallback(async () => {
    if (!folderPath) return;
    setSaving(true);
    try {
      const fileName = `preview-${Date.now()}.html`;
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
  }, [folderPath, html, backend, openFile, refreshTree]);

  return (
    <div className="html-extract">
      {/* Compact header */}
      <div className="html-extract-header">
        <span className="html-extract-icon">🌐</span>
        <span className="html-extract-name" title={name}>{name}</span>
        <span className="html-extract-meta">{lines} ln</span>
        <div className="html-extract-actions">
          <button className="html-extract-btn" onClick={handleCopy} title="Copy">
            {copied ? '✓' : '⎘'}
          </button>
          <button className="html-extract-btn" onClick={handleLivePreview} title="Open in tab">
            ▶
          </button>
          {folderPath && (
            <button className="html-extract-btn" onClick={handleSave} disabled={saving} title="Save">
              {saved ? '✓' : saving ? '…' : '💾'}
            </button>
          )}
        </div>
      </div>

      {/* Preview — always visible by default, collapsible */}
      <button
        className={`html-extract-toggle ${previewOpen ? 'open' : ''}`}
        onClick={() => setPreviewOpen(v => !v)}
      >
        <span className="html-extract-chevron">{previewOpen ? '▾' : '▸'}</span>
        Preview
      </button>
      {previewOpen && (
        <div className="html-extract-preview">
          <StableIframe html={html} title={name} />
        </div>
      )}

      {/* Source code — collapsed by default */}
      <button
        className={`html-extract-toggle ${codeOpen ? 'open' : ''}`}
        onClick={() => setCodeOpen(v => !v)}
      >
        <span className="html-extract-chevron">{codeOpen ? '▾' : '▸'}</span>
        Source
        <span className="html-extract-line-count">{lines} ln</span>
      </button>
      {codeOpen && (
        <div className="html-extract-code">
          <pre className="html-extract-pre"><code>{html}</code></pre>
        </div>
      )}
    </div>
  );
});

export default HtmlPreview;
