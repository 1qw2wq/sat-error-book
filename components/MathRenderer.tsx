'use client';

import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
  highlights?: HighlightItem[];
}

export interface HighlightItem {
  id: string;
  selectedText: string;
  color?: 'yellow' | 'blue' | 'pink' | 'underline';
  noteText?: string;
}

export function highlightTextNodes(text: string, highlights?: HighlightItem[]): React.ReactNode {
  if (!text || !highlights || highlights.length === 0) return text;

  // Normalize string for fuzzy/whitespace-insensitive lookup
  const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

  // Find highlights that overlap or match the text
  const validHighlights = highlights.filter((h) => {
    if (!h.selectedText) return false;
    const cleanSel = normalize(h.selectedText);
    if (!cleanSel) return false;
    const cleanText = normalize(text);
    return cleanText.toLowerCase().includes(cleanSel.toLowerCase()) || text.toLowerCase().includes(h.selectedText.toLowerCase());
  });

  if (validHighlights.length === 0) return text;

  // Sort by length descending to match longer phrases first
  const sorted = [...validHighlights].sort((a, b) => b.selectedText.length - a.selectedText.length);

  // Build pattern using regex escaping for each highlight string
  const patternParts = sorted.map((h) => {
    const escaped = h.selectedText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Allow flexible whitespace in match if user selected across line breaks or spaces
    return escaped.replace(/\\\s+/g, '\\s+');
  });

  const pattern = patternParts.join('|');
  if (!pattern) return text;

  try {
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const cleanPart = normalize(part).toLowerCase();
      const match = sorted.find((h) => {
        const cleanSel = normalize(h.selectedText).toLowerCase();
        return cleanSel === cleanPart || h.selectedText.toLowerCase() === part.toLowerCase();
      });

      if (match) {
        const color = match.color || 'yellow';
        let styleClass = 'bg-amber-200/90 text-amber-950 border-b-2 border-amber-400 font-medium px-0.5 rounded-2xs';
        if (color === 'blue') {
          styleClass = 'bg-sky-200/90 text-sky-950 border-b-2 border-sky-400 font-medium px-0.5 rounded-2xs';
        } else if (color === 'pink') {
          styleClass = 'bg-pink-200/90 text-pink-950 border-b-2 border-pink-400 font-medium px-0.5 rounded-2xs';
        } else if (color === 'underline') {
          styleClass = 'underline decoration-2 decoration-blue-600 underline-offset-4 font-semibold text-slate-900';
        }

        return (
          <mark
            key={idx}
            className={`${styleClass} transition-all hover:brightness-95 cursor-pointer`}
            title={match.noteText ? `Note: ${match.noteText}` : match.selectedText}
          >
            {part}
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
export default function MathRenderer({ text, className = '', highlights }: MathRendererProps) {
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
        return <span key={index}>{renderProseWithInlineMath(part, index, highlights)}</span>;
      })}
    </span>
  );
}

function renderProseWithInlineMath(prose: string, baseKey: number, highlights?: HighlightItem[]) {
  // Matches expressions like y = -3x + 4, x^2 - 4x + 3 = 0, f(x), (2, -1), x^2
  const exprRegex = /(\b(?:[a-zA-Z]\([a-zA-Z0-9\s,\+-]+\)|[a-zA-Z0-9_-]+\^[0-9a-zA-Z]+|\d*x\^2|\b[a-zA-Z]\s*=\s*[-+\d\/\*\.\(\)a-zA-Z]+|\b\d+[a-zA-Z]\s*[\+-]\s*\d+[a-zA-Z]\s*=\s*\d+)\b)/g;

  const subParts = prose.split(exprRegex);
  if (subParts.length <= 1) return highlightTextNodes(prose, highlights);

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
        return <span key={`sub-${baseKey}-${i}`}>{highlightTextNodes(sub, highlights)}</span>;
      }
    }
    return <span key={`sub-${baseKey}-${i}`}>{highlightTextNodes(sub, highlights)}</span>;
  });
}
