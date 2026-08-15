'use client';

import React from 'react';
import katex from 'katex';

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
 * and converts unformatted algebraic expressions like (3/4)x or x^2 into clean math.
 */
export default function MathRenderer({ text, className = '', highlights, onHighlightClick }: MathRendererProps) {
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
      });

      return (
        <span
          key={key}
          className={isBlock ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5 mx-0.5 align-middle'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      return (
        <span key={key} className="inline font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
          {latex}
        </span>
      );
    }
  };

  // Tokenize by math delimiters ($$...$$, $...$, `...`, or LaTeX macros)
  const tokenRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$|\\\([\s\S]*?\\\)|`[\s\S]*?`|\\\b(?:frac|sqrt|le|ge|cdot|times|pm|infty|theta|pi|alpha|beta)\b\{?[^}\s]*\}?)/g;

  const parts = text.split(tokenRegex);

  return (
    <span className={`inline-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check for block math
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
          const content = part.slice(2, -2);
          return renderKatex(content, true, index);
        }

        // Check for inline math
        if (
          (part.startsWith('$') && part.endsWith('$')) ||
          (part.startsWith('\\(') && part.endsWith('\\)')) ||
          (part.startsWith('`') && part.endsWith('`'))
        ) {
          const content = part.slice(1, -1);
          return renderKatex(content, false, index);
        }

        // Check for raw LaTeX macro
        if (part.startsWith('\\')) {
          return renderKatex(part, false, index);
        }

        // Plain prose with potential inline equations like y = 3x - 5 or x^2
        return <span key={index}>{renderProseWithInlineMath(part, index, highlights, onHighlightClick)}</span>;
      })}
    </span>
  );
}

function renderProseWithInlineMath(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  // Support HTML underline <u>...</u>, <b>...</b>, and Markdown **...** formatting in prose
  const formatTagRegex = /(<u>[\s\S]*?<\/u>|<b>[\s\S]*?<\/b>|\*\*[\s\S]*?\*\*)/gi;
  const tagParts = prose.split(formatTagRegex);

  if (tagParts.length > 1) {
    return tagParts.map((tagPart, tIdx) => {
      if (!tagPart) return null;

      if (/^<u>[\s\S]*?<\/u>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<u>/i, '').replace(/<\/u>$/i, '');
        return (
          <span key={`u-${baseKey}-${tIdx}`} className="underline decoration-2 underline-offset-4 font-normal inline">
            {renderProseWithInlineMath(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </span>
        );
      }

      if (/^<b>[\s\S]*?<\/b>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<b>/i, '').replace(/<\/b>$/i, '');
        return (
          <strong key={`b-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderProseWithInlineMath(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      if (/^\*\*[\s\S]*?\*\*$/.test(tagPart)) {
        const inner = tagPart.slice(2, -2);
        return (
          <strong key={`bold-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderProseWithInlineMath(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      return renderMathSegments(tagPart, baseKey * 100 + tIdx, highlights, onHighlightClick);
    });
  }

  return renderMathSegments(prose, baseKey, highlights, onHighlightClick);
}

function renderMathSegments(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  // Matches expressions like y = -3x + 4, x^2 - 4x + 3 = 0, f(x), (2, -1), x^2
  const exprRegex = /(\b(?:[a-zA-Z]\([a-zA-Z0-9\s,\+-]+\)|[a-zA-Z0-9_-]+\^[0-9a-zA-Z]+|\d*x\^2|\b[a-zA-Z]\s*=\s*[-+\d\/\*\.\(\)a-zA-Z]+|\b\d+[a-zA-Z]\s*[\+-]\s*\d+[a-zA-Z]\s*=\s*\d+)\b)/g;

  const subParts = prose.split(exprRegex);
  if (subParts.length <= 1) return highlightTextNodes(prose, highlights, onHighlightClick);

  return subParts.map((sub, i) => {
    if (exprRegex.test(sub)) {
      try {
        let latex = sub.trim();
        if (!latex.includes('\\frac') && /\b\d+\/\d+\b/.test(latex)) {
          latex = latex.replace(/\b(\d+)\/(\d+)\b/g, '\\frac{$1}{$2}');
        }
        const html = katex.renderToString(latex, { throwOnError: false });
        return (
          <span
            key={`math-${baseKey}-${i}`}
            className="inline-block px-0.5 mx-0.5 align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <span key={`sub-${baseKey}-${i}`}>{highlightTextNodes(sub, highlights, onHighlightClick)}</span>;
      }
    }
    return <span key={`sub-${baseKey}-${i}`}>{highlightTextNodes(sub, highlights, onHighlightClick)}</span>;
  });
}
