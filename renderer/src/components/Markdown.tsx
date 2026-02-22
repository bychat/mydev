import { useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  children: string;
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

export default function Markdown({ children }: MarkdownProps) {
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
