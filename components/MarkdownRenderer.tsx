'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MathRenderer, { HighlightItem, convertMathmlToLatex } from './MathRenderer';
import { restoreUnderline } from '@/lib/questionBank';
import { formatMathText } from '@/lib/mathFormatter';

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
function extractStringFromChildren(node: React.ReactNode): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map(extractStringFromChildren).join('');
  }
  if (React.isValidElement(node) && node.props && (node.props as any).children) {
    return extractStringFromChildren((node.props as any).children);
  }
  return '';
}

export default function MarkdownRenderer({
  content,
  className = '',
  highlights,
  onHighlightClick,
  explanation,
}: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => {
    if (!content) return '';
    let text = formatMathText(content);

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
          p: ({ children }) => {
            const textContent = extractStringFromChildren(children).trim();

            // Check if SAT Intro sentence ("The following text is from...", "This text is adapted from...", "Adapted from...")
            const isIntro = /^(?:The following (?:text|passage)|This (?:text|passage)|Excerpt|In Text 1|In Text 2|Adapted from|Excerpted from)\s+(?:is|was|has been|from|adapted|excerpted|taken)/i.test(textContent);

            // Check if Paired Passage Heading ("Text 1", "Text 2", "Passage 1", "Passage 2")
            const isPassageHeading = /^(?:\*\*|\b)?(?:Text\s*[12AB]|Passage\s*[12AB])(?:\*\*|\b)?$/i.test(textContent);

            // Check if Copyright / Source attribution ("©1990 by...", "Copyright 1990...", "© 1990")
            const isCopyright = /^(?:[©\u00A9]|\([cC]\)|Copyright|\d{4}\s+by)/i.test(textContent);

            if (isPassageHeading) {
              return (
                <div className="mt-5 mb-2.5 first:mt-0 font-bold text-inherit text-base sm:text-lg font-sans tracking-wide">
                  {renderChildrenWithMath(children)}
                </div>
              );
            }

            if (isIntro) {
              return (
                <div className="mb-4 text-inherit opacity-90 italic font-serif leading-relaxed text-base md:text-lg font-normal tracking-normal">
                  {renderChildrenWithMath(children)}
                </div>
              );
            }

            if (isCopyright) {
              return (
                <div className="mt-5 pt-3 border-t border-slate-300 dark:border-slate-700 text-xs font-sans text-inherit opacity-75 italic">
                  {renderChildrenWithMath(children)}
                </div>
              );
            }

            return (
              <div className="mb-4 sm:mb-5 last:mb-0 leading-relaxed font-serif text-inherit text-base md:text-lg font-normal tracking-normal">
                {renderChildrenWithMath(children)}
              </div>
            );
          },
          u: ({ children }) => (
            <span className="underline decoration-solid decoration-2 underline-offset-4 decoration-current font-normal text-inherit inline">
              {renderChildrenWithMath(children)}
            </span>
          ),
          ins: ({ children }) => (
            <ins className="underline decoration-solid decoration-2 underline-offset-4 decoration-current font-normal text-inherit inline no-underline">
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
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-xs">
              <table className="w-full text-left text-sm border-collapse font-sans text-inherit">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800 text-inherit font-extrabold border-b-2 border-slate-300 dark:border-slate-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-inherit font-medium">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 font-extrabold text-inherit border-r border-slate-300 dark:border-slate-700 last:border-r-0 tracking-tight text-center sm:text-left whitespace-nowrap bg-slate-100 dark:bg-slate-800">
              {renderChildrenWithMath(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-inherit border-r border-slate-200 dark:border-slate-700 last:border-r-0 align-middle text-center sm:text-left font-medium">
              {renderChildrenWithMath(children)}
            </td>
          ),
          li: ({ children }) => (
            <li className="my-1.5 leading-relaxed text-inherit font-serif pl-1">
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
          ul: ({ children }) => <ul className="list-disc pl-6 my-3.5 space-y-2 text-inherit font-serif">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3.5 space-y-2 text-inherit font-serif">{children}</ol>,
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
