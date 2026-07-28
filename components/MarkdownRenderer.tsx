'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import MathRenderer, { HighlightItem } from './MathRenderer';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlights?: HighlightItem[];
}

/**
 * Component that renders full Markdown formatting (bullet points, bold, italic, headers, code blocks, lists)
 * while preserving KaTeX math rendering ($...$, $$\frac{}{}$$) for all text segments.
 */
export default function MarkdownRenderer({ content, className = '', highlights }: MarkdownRendererProps) {
  if (!content) return null;

  const renderChildrenWithMath = (children: React.ReactNode) => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return <MathRenderer text={child} highlights={highlights} />;
      }
      return child;
    });
  };

  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <div className="mb-2 last:mb-0 leading-relaxed font-normal">
              {renderChildrenWithMath(children)}
            </div>
          ),
          li: ({ children }) => (
            <li className="my-1 leading-relaxed">
              {renderChildrenWithMath(children)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-bold">
              {renderChildrenWithMath(children)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {renderChildrenWithMath(children)}
            </em>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-bold my-2">
              {renderChildrenWithMath(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold my-2">
              {renderChildrenWithMath(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold my-1.5">
              {renderChildrenWithMath(children)}
            </h3>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-800 dark:text-blue-300 font-mono text-xs">
              {children}
            </code>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-600 pl-3 my-2 italic font-serif">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
