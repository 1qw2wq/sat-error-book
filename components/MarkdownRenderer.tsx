'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MathRenderer, { HighlightItem, convertMathmlToLatex } from './MathRenderer';
import { restoreUnderline } from '@/lib/questionBank';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlights?: HighlightItem[];
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void;
  explanation?: string;
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
  explanation,
}: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => {
    if (!content) return '';
    let text = content;
    // Normalize literal escaped "\n" into actual newlines if the string has no real newlines
    if (text.includes('\\n') && !text.includes('\n')) {
      text = text.replace(/\\n/g, '\n');
    }

    // Auto line breaks before option choices (A), (B), (C), (D) or A), B), C), D) or A., B., C., D. or 选项A
    text = text.replace(/([^\n])\s*(\([A-Da-d]\)|[A-Da-d]\)|[A-Da-d]\.|选项[A-Da-d])\s*/g, '$1\n$2 ');

    // Auto line break before conclusion "所以选", "故选", "因此选"
    text = text.replace(/([^\n])\s*(所以选|故选|因此选)\s*/g, '$1\n$2 ');

    // Auto-restore underline if text mentions underlined but lacks <u> tags
    if (text.includes('underlined') && !/<u[\s>]|\\underline|<ins[\s>]/i.test(text)) {
      text = restoreUnderline(text, explanation);
    }

    // Pre-convert MathML <math>...</math> tags into LaTeX math $...$ before passing to ReactMarkdown.
    // This prevents rehypeRaw from converting <math> into broken HTML DOM element nodes.
    if (text.includes('<math')) {
      text = text.replace(/<math[\s\S]*?<\/math>/gi, (m) => {
        const latex = convertMathmlToLatex(m);
        return `$${latex}$`;
      });
    }

    // Convert un-delimited LaTeX commands, caret superscripts (e.g. 4x^2, p^2, 8^2), and subscripts outside $...$
    const tokens: { type: 'prose' | 'math'; text: string }[] = [];
    const tagRegex = /(<math[\s\S]*?<\/math>|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^\$\n]+?\$)/gi;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        tokens.push({ type: 'prose', text: text.substring(lastIdx, match.index) });
      }
      tokens.push({ type: 'math', text: match[0] });
      lastIdx = tagRegex.lastIndex;
    }
    if (lastIdx < text.length) {
      tokens.push({ type: 'prose', text: text.substring(lastIdx) });
    }

    const processedTokens = tokens.map((token) => {
      if (token.type === 'math') return token.text;

      let prose = token.text;

      // Convert raw LaTeX commands like \Delta, \frac{...}{...}, \sqrt{...}, \alpha, \beta, \theta, \pi, \le, \ge, \pm, \times
      prose = prose.replace(/(\\([a-zA-Z]+)(?:\{[^\}]*\}|\b))/g, (full) => {
        if (full === '\\n' || full === '\\t' || full === '\\r') return full;
        return `$${full}$`;
      });

      // Replace unicode Delta (Δ) if used as math symbol in prose
      prose = prose.replace(/Δ\s*=\s*/g, '$\\Delta =$ ');

      // Convert caret superscripts like 4x^2, p^2, k^2, 8^2, 10^2, 20^2 outside $ into $...$
      prose = prose.replace(/([a-zA-Z0-9_\(\)]+)\^([a-zA-Z0-9]+|\{[^\}]+\})/g, '$$$1^{$2}$$$');

      // Convert subscripts like x_1, a_n outside $ into $...$
      prose = prose.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9]+|\{[^\}]+\})/g, '$$$1_{$2}$$$');

      // Clean up any double/triple dollars created
      prose = prose.replace(/\$\$+/g, '$');

      return prose;
    });

    text = processedTokens.join('');

    return text;
  }, [content, explanation]);

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
            <span className="underline decoration-solid decoration-2 underline-offset-4 decoration-black dark:decoration-white font-normal text-inherit inline">
              {renderChildrenWithMath(children)}
            </span>
          ),
          ins: ({ children }) => (
            <ins className="underline decoration-solid decoration-2 underline-offset-4 decoration-black dark:decoration-white font-normal text-inherit inline no-underline">
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
          // SAT Styled Table Components
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-sm border-collapse font-sans text-slate-900 dark:text-slate-100">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold border-b-2 border-slate-300 dark:border-slate-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 font-extrabold text-slate-900 dark:text-white border-r border-slate-300 dark:border-slate-700 last:border-r-0 tracking-tight text-center sm:text-left whitespace-nowrap bg-slate-100 dark:bg-slate-800">
              {renderChildrenWithMath(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700 last:border-r-0 align-middle text-center sm:text-left bg-white dark:bg-slate-900 font-medium">
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
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-blue-300 font-mono text-xs">
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
