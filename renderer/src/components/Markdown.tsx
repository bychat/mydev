import { useState, useCallback, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TreeEntry } from '../types';

interface MarkdownProps {
  children: string;
  /** Flat set of relative file paths in the workspace (e.g. "src/index.ts") */
  workspaceFiles?: Set<string>;
  /** Called when user clicks a recognised file reference */
  onFileClick?: (relativePath: string) => void;
}

/** Build a flat set of all relative file paths from a tree */
export function flattenTree(entries: TreeEntry[], prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.type === 'file') out.add(rel);
    if (e.children) {
      for (const p of flattenTree(e.children, rel)) out.add(p);
    }
  }
  return out;
}

/** Simple file-extension → emoji mapping */
function fileEmoji(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋', css: '🎨', html: '🌐',
    md: '📝', py: '🐍', rs: '🦀', go: '🐹', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '🖥', bash: '🖥', zsh: '🖥', txt: '📄', svg: '🖼', png: '🖼', jpg: '🖼',
  };
  return map[ext] ?? '📄';
}

/** Inline copy button for code blocks */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button className="md-copy-btn" onClick={handleCopy} title="Copy">
      {copied ? '✓' : '⎘'}
    </button>
  );
}

export default function Markdown({ children, workspaceFiles, onFileClick }: MarkdownProps) {
  /** Check if a string looks like a workspace file path */
  const resolveFile = useMemo(() => {
    if (!workspaceFiles || workspaceFiles.size === 0) return (_s: string) => null;

    // Also build a name→path map so bare filenames like "package.json" match
    const nameMap = new Map<string, string>();
    for (const p of workspaceFiles) {
      const name = p.split('/').pop()!;
      // Only map if the name is unambiguous (first wins)
      if (!nameMap.has(name)) nameMap.set(name, p);
    }

    return (text: string): string | null => {
      const t = text.replace(/^[`'"/]+|[`'"/]+$/g, '').replace(/^\.\//, '');
      if (workspaceFiles.has(t)) return t;
      if (nameMap.has(t)) return nameMap.get(t)!;
      return null;
    };
  }, [workspaceFiles]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        /* Code blocks with language label + copy button */
        code({ className, children: codeChildren, ...rest }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const codeStr = String(codeChildren).replace(/\n$/, '');

          // Inline code (no language class, short, no newlines)
          if (!match && !codeStr.includes('\n')) {
            // Check if this looks like a workspace file
            const resolved = resolveFile(codeStr);
            if (resolved && onFileClick) {
              const fileName = resolved.split('/').pop() ?? resolved;
              return (
                <button
                  className="md-file-link"
                  onClick={(e) => { e.preventDefault(); onFileClick(resolved); }}
                  title={`Open ${resolved}`}
                >
                  <span className="md-file-link-icon">{fileEmoji(fileName)}</span>
                  {codeStr}
                </button>
              );
            }
            return <code className="md-inline-code" {...rest}>{codeChildren}</code>;
          }

          return (
            <div className="md-code-block">
              <div className="md-code-header">
                <span className="md-code-lang">{match?.[1] ?? 'code'}</span>
                <CopyButton text={codeStr} />
              </div>
              <pre className="md-pre"><code className={className} {...rest}>{codeChildren}</code></pre>
            </div>
          );
        },
        /* Tables */
        table({ children: tChildren }: { children?: ReactNode }) {
          return <div className="md-table-wrap"><table className="md-table">{tChildren}</table></div>;
        },
        /* Links open externally */
        a({ href, children: linkChildren }: { href?: string; children?: ReactNode }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
              {linkChildren}
            </a>
          );
        },
        /* Blockquote */
        blockquote({ children: bqChildren }: { children?: ReactNode }) {
          return <blockquote className="md-blockquote">{bqChildren}</blockquote>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
