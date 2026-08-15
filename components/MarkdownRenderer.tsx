'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MathRenderer, { HighlightItem } from './MathRenderer';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlights?: HighlightItem[];
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void;
}

/**
 * Component that renders full Markdown formatting (tables, bold, underline, italic, headers, lists)
 * with full KaTeX math support ($...$, $$...$$) and HTML tags.
 * Ensures bold text, underlines, and math remain crisp and inherit the proper container color.
 */
export default function MarkdownRenderer({
  content,
  className = '',
  highlights,
  onHighlightClick,
}: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => {
    if (!content) return '';
    let text = content;
    // Normalize literal escaped "\n" into actual newlines if the string has no real newlines
    if (text.includes('\\n') && !text.includes('\n')) {
      text = text.replace(/\\n/g, '\n');
    }
    return text;
  }, [content]);

  if (!normalizedContent) return null;

  const renderChildrenWithMath = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return <MathRenderer text={child} highlights={highlights} onHighlightClick={onHighlightClick} />;
      }
      if (React.isValidElement(child) && child.props && (child.props as any).children) {
        return React.cloneElement(child as React.ReactElement<any>, {
          children: renderChildrenWithMath((child.props as any).children),
        });
      }
      return child;
    });
  };

  return (
    <div className={`prose max-w-none text-inherit leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => (
            <div className="mb-2 last:mb-0 leading-relaxed font-normal text-inherit">
              {renderChildrenWithMath(children)}
            </div>
          ),
          u: ({ children }) => (
            <span className="underline decoration-2 underline-offset-4 decoration-current font-normal inline">
              {renderChildrenWithMath(children)}
            </span>
          ),
          ins: ({ children }) => (
            <ins className="underline decoration-2 underline-offset-4 decoration-current no-underline inline">
              {renderChildrenWithMath(children)}
            </ins>
          ),
          b: ({ children }) => (
            <b className="font-extrabold font-black text-inherit inline">
              {renderChildrenWithMath(children)}
            </b>
          ),
          strong: ({ children }) => (
            <strong className="font-extrabold font-black text-inherit inline">
              {renderChildrenWithMath(children)}
            </strong>
          ),
          mark: ({ children }) => (
            <mark className="bg-yellow-200 text-slate-950 px-1 py-0.5 rounded-xs">
              {renderChildrenWithMath(children)}
            </mark>
          ),
          // SAT Styled Table Components in Clean Light Scheme
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-xs">
              <table className="w-full text-left text-sm border-collapse font-sans text-slate-900">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 text-black font-extrabold border-b-2 border-slate-300">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 bg-white text-slate-900 font-medium">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 font-extrabold text-black border-r border-slate-300 last:border-r-0 tracking-tight text-center sm:text-left whitespace-nowrap bg-slate-100">
              {renderChildrenWithMath(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-black border-r border-slate-200 last:border-r-0 align-middle text-center sm:text-left bg-white font-medium">
              {renderChildrenWithMath(children)}
            </td>
          ),
          li: ({ children }) => (
            <li className="my-1 leading-relaxed text-inherit">
              {renderChildrenWithMath(children)}
            </li>
          ),
          em: ({ children }) => (
            <em className="italic text-inherit">
              {renderChildrenWithMath(children)}
            </em>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-extrabold text-inherit my-2">
              {renderChildrenWithMath(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-extrabold text-inherit my-2">
              {renderChildrenWithMath(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-inherit my-1.5">
              {renderChildrenWithMath(children)}
            </h3>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-blue-900 font-mono text-xs">
              {children}
            </code>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 text-inherit">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 text-inherit">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-600 pl-3 my-2 italic font-serif text-inherit">
              {children}
            </blockquote>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
