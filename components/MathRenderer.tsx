'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import { formatMathText } from '@/lib/mathFormatter';

export interface HighlightItem {
  id: string;
  selectedText: string;
  color?: 'yellow' | 'blue' | 'pink' | 'underline';
  noteText?: string;
  questionIndex?: number;
}

interface MathRendererProps {
  text: string;
  className?: string;
  highlights?: HighlightItem[];
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void;
}

// Normalize strings for matching across smart quotes, dashes, and whitespace variations
function normalizeText(str: string): string {
  return str
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[\u201C\u201D"]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function highlightTextNodes(
  text: string,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
): React.ReactNode {
  if (!text || !highlights || highlights.length === 0) return text;

  const normTarget = normalizeText(text).toLowerCase();

  // Find highlights that appear in this text block
  const matchedHighlights: { item: HighlightItem; phrase: string }[] = [];

  highlights.forEach((h) => {
    if (!h.selectedText) return;
    const cleanSel = normalizeText(h.selectedText);
    if (!cleanSel) return;

    // Only match exact full selection phrase that appears in this text block
    if (normTarget.includes(cleanSel.toLowerCase())) {
      matchedHighlights.push({ item: h, phrase: cleanSel });
    }
  });

  if (matchedHighlights.length === 0) return text;

  // Sort matched phrases by length descending
  matchedHighlights.sort((a, b) => b.phrase.length - a.phrase.length);

  // Deduplicate phrases
  const uniquePhrases = Array.from(new Set(matchedHighlights.map((m) => m.phrase)));

  const regexPatterns = uniquePhrases.map((phrase) => {
    const escaped = escapeRegExp(phrase);
    return escaped.replace(/\\\s+/g, '\\s+');
  });

  const masterPattern = regexPatterns.join('|');
  if (!masterPattern) return text;

  try {
    const regex = new RegExp(`(${masterPattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;
      const cleanPart = normalizeText(part).toLowerCase();

      const matchedObj = matchedHighlights.find((m) => {
        const pNorm = normalizeText(m.phrase).toLowerCase();
        return pNorm === cleanPart || part.toLowerCase() === m.phrase.toLowerCase();
      });

      if (matchedObj) {
        const item = matchedObj.item;
        const color = item.color || 'yellow';
        let styleClass = 'bg-[#fef08a] text-slate-900 border-b-2 border-amber-400 font-medium px-0.5 rounded-2xs shadow-2xs';
        if (color === 'blue') {
          styleClass = 'bg-[#bae6fd] text-slate-900 border-b-2 border-sky-400 font-medium px-0.5 rounded-2xs shadow-2xs';
        } else if (color === 'pink') {
          styleClass = 'bg-[#fbcfe8] text-slate-900 border-b-2 border-pink-400 font-medium px-0.5 rounded-2xs shadow-2xs';
        } else if (color === 'underline') {
          styleClass = 'underline decoration-2 decoration-blue-600 underline-offset-4 font-semibold text-slate-900 bg-blue-50/50 px-0.5 rounded-2xs';
        }

        return (
          <mark
            key={`hl-${idx}-${part}`}
            onClick={(e) => {
              e.stopPropagation();
              onHighlightClick?.(item, e);
            }}
            data-highlight-id={item.id}
            className={`${styleClass} transition-all hover:brightness-95 cursor-pointer relative group inline`}
            title={item.noteText ? `Note: ${item.noteText}` : 'Click to edit or remove highlight'}
          >
            {part}
            {item.noteText && (
              <span className="inline-block ml-1 text-[10px] bg-amber-500 text-white font-bold px-1 rounded-full align-super select-none">
                Note
              </span>
            )}
          </mark>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}

/**
 * High-precision MathRenderer using KaTeX with zero-crash fallback.
 * Formats inline math ($...$), block math ($$...$$), LaTeX commands (\frac, \sqrt, \le, etc.),
 * and handles dollar currency amounts cleanly.
 */
export default function MathRenderer({ text, className = '', highlights, onHighlightClick }: MathRendererProps) {
  const processedText = useMemo(() => {
    if (!text) return '';
    return formatMathText(text);
  }, [text]);

  if (!text) return null;

  // Render a math string using KaTeX safely
  const renderKatex = (latex: string, isBlock = false, key: number) => {
    let cleanLatex = latex.trim();
    // Convert common plain-text fraction patterns like (4/3) -> \frac{4}{3} if not already LaTeX
    if (!cleanLatex.includes('\\frac') && /\b\d+\/\d+\b/.test(cleanLatex)) {
      cleanLatex = cleanLatex.replace(/\b(\d+)\/(\d+)\b/g, '\\frac{$1}{$2}');
    }

    try {
      const html = katex.renderToString(cleanLatex, {
        displayMode: isBlock,
        throwOnError: false,
        output: 'html',
        strict: false,
      });

      return (
        <span
          key={key}
          className={isBlock ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5 align-baseline'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      return (
        <span key={key} className="inline font-mono text-slate-800 dark:text-slate-200 font-medium">
          {latex}
        </span>
      );
    }
  };

  // Protect currency amounts so they are not split as math delimiters
  const protectedText = processedText.replace(/\$\s*(\d[\d,]*(?:\.\d+)?)\b/g, '__USD__$1');

  // Tokenize by math delimiters ($$...$$, \[...\], $...$, \(...\), or `...`)
  const tokenRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$]+?\$|\\\([\s\S]*?\\\)|`[^`]+?`)/g;

  const parts = protectedText.split(tokenRegex);

  return (
    <span className={`inline-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check for block math ($$...$$ or \[...\])
        if (
          (part.startsWith('$$') && part.endsWith('$$')) ||
          (part.startsWith('\\[') && part.endsWith('\\]'))
        ) {
          const content = part.slice(2, -2).replace(/__USD__/g, '$');
          return renderKatex(content, true, index);
        }

        // Check for inline math (\(...\))
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const content = part.slice(2, -2).replace(/__USD__/g, '$');
          return renderKatex(content, false, index);
        }

        // Check for inline math ($...$ or `...`)
        if (
          (part.startsWith('$') && part.endsWith('$')) ||
          (part.startsWith('`') && part.endsWith('`'))
        ) {
          const content = part.slice(1, -1).replace(/__USD__/g, '$');
          return renderKatex(content, false, index);
        }

        // Plain prose: restore currency and support HTML formatting & highlights
        const restoredProse = part.replace(/__USD__/g, '$');
        return <span key={index}>{renderProseWithFormatting(restoredProse, index, highlights, onHighlightClick)}</span>;
      })}
    </span>
  );
}

function renderProseWithFormatting(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  // Support newlines first if present
  if (prose.includes('\n')) {
    const lines = prose.split('\n');
    return (
      <>
        {lines.map((line, lIdx) => (
          <React.Fragment key={`line-${baseKey}-${lIdx}`}>
            {lIdx > 0 && <br />}
            {renderInlineProse(line, baseKey * 100 + lIdx, highlights, onHighlightClick)}
          </React.Fragment>
        ))}
      </>
    );
  }

  return renderInlineProse(prose, baseKey, highlights, onHighlightClick);
}

function renderInlineProse(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  let cleanProse = prose;

  // Clean raw markdown headers if present at the start of the line (e.g., "### Context Sentence" -> "Context Sentence")
  if (/^#{1,6}\s+/.test(cleanProse)) {
    const headingText = cleanProse.replace(/^#{1,6}\s+/, '');
    return (
      <span key={`h-${baseKey}`} className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
        {renderInlineProse(headingText, baseKey * 10, highlights, onHighlightClick)}
      </span>
    );
  }

  // Clean raw markdown blockquote if present at start of line (e.g., "> \"text\"")
  if (/^>\s+/.test(cleanProse)) {
    const quoteText = cleanProse.replace(/^>\s+/, '');
    return (
      <span key={`bq-${baseKey}`} className="block italic text-slate-800 dark:text-slate-200 my-1 pl-2 border-l-2 border-slate-300 dark:border-slate-700">
        {renderInlineProse(quoteText, baseKey * 10, highlights, onHighlightClick)}
      </span>
    );
  }

  // Support HTML underline <u>...</u>, <b>...</b>, and Markdown **...** / *...* formatting in prose
  const formatTagRegex = /(<u>[\s\S]*?<\/u>|<b>[\s\S]*?<\/b>|\*\*[\s\S]*?\*\*|\*[^\*]+?\*|_[^_]+?_)/gi;
  const tagParts = cleanProse.split(formatTagRegex);

  if (tagParts.length > 1) {
    return tagParts.map((tagPart, tIdx) => {
      if (!tagPart) return null;

      if (/^<u>[\s\S]*?<\/u>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<u>/i, '').replace(/<\/u>$/i, '');
        return (
          <span key={`u-${baseKey}-${tIdx}`} className="underline decoration-2 underline-offset-4 font-normal inline">
            {renderInlineProse(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </span>
        );
      }

      if (/^<b>[\s\S]*?<\/b>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<b>/i, '').replace(/<\/b>$/i, '');
        return (
          <strong key={`b-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderInlineProse(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      if (/^\*\*[\s\S]*?\*\*$/.test(tagPart)) {
        const inner = tagPart.slice(2, -2);
        return (
          <strong key={`bold-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderInlineProse(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      if (/^\*[^\*]+?\*$/.test(tagPart) || /^_[^_]+?_$/.test(tagPart)) {
        const inner = tagPart.slice(1, -1);
        return (
          <em key={`em-${baseKey}-${tIdx}`} className="italic text-inherit inline">
            {renderInlineProse(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </em>
        );
      }

      return highlightTextNodes(tagPart, highlights, onHighlightClick);
    });
  }

  return highlightTextNodes(cleanProse, highlights, onHighlightClick);
}
