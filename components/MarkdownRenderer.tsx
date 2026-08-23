'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MathRenderer, { HighlightItem, convertMathmlToLatex } from './MathRenderer';
import { restoreUnderline } from '@/lib/questionBank';
import { formatMathText, sanitizeSatText } from '@/lib/mathFormatter';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlights?: HighlightItem[];
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void;
  explanation?: string;
}

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

function escapeNonHtmlAngleBrackets(str: string): string {
  if (!str) return '';
  const validHtmlTagRegex = /<\/?(?:u|ins|b|strong|em|i|math|annotation|semantics|mrow|mfrac|msup|msub|msubsup|mroot|msqrt|mtable|mtr|mtd|mtext|mo|mi|mn|mspace|mfenced|mover|munder|menclose|mstyle|mpadded|table|thead|tbody|tr|th|td|p|div|br|span|img|sup|sub|a|ul|ol|li|mark)\b[^>]*>/gi;
  // Single $ expressions must not cross table cell pipes (|) or newlines
  const mathBlockRegex = /(<math[\s\S]*?<\/math>|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}|[^$\n|]+?)(?<!\\)\$)/gi;

  const savedPlaceholders: string[] = [];

  // 1. Protect valid HTML tags FIRST so they are never swallowed by math blocks
  let text = str.replace(validHtmlTagRegex, (tag) => {
    savedPlaceholders.push(tag);
    return `SATMDPLCHLD${savedPlaceholders.length - 1}X`;
  });

  // 2. Protect MathML & LaTeX Math blocks so their < and > are NEVER turned into &lt; / &gt;
  text = text.replace(mathBlockRegex, (match) => {
    savedPlaceholders.push(match);
    return `SATMDPLCHLD${savedPlaceholders.length - 1}X`;
  });

  // 3. Escape remaining raw prose < and > to prevent broken HTML parsing in rehypeRaw
  const escapedText = text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 4. Restore protected Math and HTML blocks
  return escapedText.replace(/SATMDPLCHLD(\d+)X/g, (_, idx) => savedPlaceholders[parseInt(idx, 10)] || '');
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
    let text = sanitizeSatText(content);
    text = formatMathText(text);

    if (/(?:underlined|underline|underlining)/i.test(text) && !/<u[\s>]|\\underline|<ins[\s>]/i.test(text)) {
      text = restoreUnderline(text, explanation);
    }

    if (text.includes('<math')) {
      text = text.replace(/<math[\s\S]*?<\/math>/gi, (m) => {
        const latex = convertMathmlToLatex(m);
        return latex ? `$${latex}$` : '';
      });
    }

    text = escapeNonHtmlAngleBrackets(text);

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

            const isIntro = /^(?:The following (?:text|passage)|This (?:text|passage)|Excerpt|In Text 1|In Text 2|Adapted from|Excerpted from)\s+(?:is|was|has been|from|adapted|excerpted|taken)/i.test(textContent);
            const isPassageHeading = /^(?:\*\*|\b)?(?:Text\s*[12AB]|Passage\s*[12AB])(?:\*\*|\b)?$/i.test(textContent);
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
          b: ({ children }) => <b className="font-extrabold font-black text-inherit inline">{renderChildrenWithMath(children)}</b>,
          strong: ({ children }) => <strong className="font-extrabold font-black text-inherit inline">{renderChildrenWithMath(children)}</strong>,
          em: ({ children }) => <em className="italic text-inherit">{renderChildrenWithMath(children)}</em>,
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-sm border-collapse font-sans text-slate-900 dark:text-slate-100">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold border-b-2 border-slate-300 dark:border-slate-700">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2.5 font-extrabold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-700 last:border-r-0 tracking-tight text-center sm:text-left whitespace-nowrap bg-slate-100 dark:bg-slate-800">{renderChildrenWithMath(children)}</th>,
          td: ({ children }) => <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 last:border-r-0 align-middle text-center sm:text-left font-medium">{renderChildrenWithMath(children)}</td>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1.5 text-inherit font-serif text-base md:text-lg">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 text-inherit font-serif text-base md:text-lg">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed text-inherit font-serif">{renderChildrenWithMath(children)}</li>,
          img: ({ src, alt }) => (
            <img
              src={src || ''}
              alt={alt || 'SAT Image'}
              referrerPolicy="no-referrer"
              className="max-h-80 max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 my-2 inline-block shadow-xs"
              loading="lazy"
            />
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}