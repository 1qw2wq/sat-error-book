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

// Check if a string is an image URL
function isPureImageUrl(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (/^https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?.*)?|\/upload\/image\/[^\s]+)$/i.test(s)) {
    return true;
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(s)) {
    return true;
  }
  return false;
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
 * handles dollar currency amounts cleanly, and natively renders diagram image URLs.
 */
export default function MathRenderer({ text, className = '', highlights, onHighlightClick }: MathRendererProps) {
  const isImage = useMemo(() => {
    if (!text) return false;
    return isPureImageUrl(text.trim());
  }, [text]);

  const processedText = useMemo(() => {
    if (!text || isImage) return '';
    return formatMathText(text);
  }, [text, isImage]);

  if (!text) return null;

  const rawTrimmed = text.trim();

  // If the entire text is an image URL (e.g., in graph choice selections), render the image directly
  if (isImage) {
    return (
      <span className={`inline-block my-1 ${className}`}>
        <img
          src={rawTrimmed}
          alt="SAT Diagram / Option"
          referrerPolicy="no-referrer"
          className="max-h-48 md:max-h-56 max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 shadow-2xs transition-transform hover:scale-[1.02]"
          loading="lazy"
        />
      </span>
    );
  }

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

  // Tokenize string into math blocks vs plain prose
  const tokens: { type: 'math' | 'prose'; text: string; isBlock?: boolean }[] = [];
  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}|[^$\n]+?)\$|`[^`]+?`|\\begin\{([a-z*]+)\}[\s\S]*?\\end\{\2\})/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(processedText)) !== null) {
    const start = match.index;
    const fullMatch = match[0];

    // Check if it's a false-positive $...$ matching between two standalone currency amounts in prose
    // e.g. "$15 each and $20 total" -> naive regex matches "$15 each and $"
    if (fullMatch.startsWith('$') && fullMatch.endsWith('$') && fullMatch.length > 2 && !fullMatch.includes('\\')) {
      const inner = fullMatch.slice(1, -1);
      if (/\b(?:and|each|the|for|per|is|was|were|of|in|to|with|from|total|cost|price|bought|spent|earned|saved|where|which|equation)\b/i.test(inner)) {
        continue;
      }
    }

    if (start > lastIdx) {
      tokens.push({ type: 'prose', text: processedText.substring(lastIdx, start) });
    }

    const isBlock = (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) ||
                    (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) ||
                    (fullMatch.startsWith('\\begin{') && fullMatch.includes('\\end{'));

    tokens.push({ type: 'math', text: fullMatch, isBlock });
    lastIdx = mathRegex.lastIndex;
  }

  if (lastIdx < processedText.length) {
    tokens.push({ type: 'prose', text: processedText.substring(lastIdx) });
  }

  return (
    <span className={`inline-wrap leading-relaxed ${className}`}>
      {tokens.map((token, index) => {
        if (!token.text) return null;

        if (token.type === 'math') {
          let content = token.text;
          if (content.startsWith('$$') && content.endsWith('$$')) {
            content = content.slice(2, -2);
          } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
            content = content.slice(2, -2);
          } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
            content = content.slice(2, -2);
          } else if (content.startsWith('$') && content.endsWith('$')) {
            content = content.slice(1, -1);
          } else if (content.startsWith('`') && content.endsWith('`')) {
            content = content.slice(1, -1);
          }
          return renderKatex(content, !!token.isBlock, index);
        }

        return <span key={index}>{renderProseWithFormatting(token.text, index, highlights, onHighlightClick)}</span>;
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

  // Support Markdown Images !\[alt\](url) or embedded pure image URLs
  const imgRegex = /(!\[.*?\]\(https?:\/\/[^\s\)]+\)|https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp|svg)|\/upload\/image\/[^\s]+))/gi;
  if (imgRegex.test(cleanProse)) {
    const imgParts = cleanProse.split(imgRegex);
    return (
      <span key={`img-group-${baseKey}`} className="inline">
        {imgParts.map((subPart, sIdx) => {
          if (!subPart) return null;
          if (/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/i.test(subPart)) {
            const m = subPart.match(/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/i);
            const alt = m?.[1] || 'SAT Diagram';
            const url = m?.[2] || '';
            return (
              <img
                key={`md-img-${baseKey}-${sIdx}`}
                src={url}
                alt={alt}
                referrerPolicy="no-referrer"
                className="max-h-52 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 my-2 inline-block"
                loading="lazy"
              />
            );
          }
          if (isPureImageUrl(subPart)) {
            return (
              <img
                key={`url-img-${baseKey}-${sIdx}`}
                src={subPart}
                alt="SAT Diagram"
                referrerPolicy="no-referrer"
                className="max-h-52 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 my-2 inline-block"
                loading="lazy"
              />
            );
          }
          return renderFormattedProseLeaves(subPart, baseKey * 100 + sIdx, highlights, onHighlightClick);
        })}
      </span>
    );
  }

  return renderFormattedProseLeaves(cleanProse, baseKey, highlights, onHighlightClick);
}

function renderFormattedProseLeaves(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  // Support HTML underline <u>...</u>, <b>...</b>, and Markdown **...** / *...* formatting in prose
  const formatTagRegex = /(<u>[\s\S]*?<\/u>|<b>[\s\S]*?<\/b>|\*\*[\s\S]*?\*\*|\*[^\*]+?\*|_[^_]+?_)/gi;
  const tagParts = prose.split(formatTagRegex);

  if (tagParts.length > 1) {
    return tagParts.map((tagPart, tIdx) => {
      if (!tagPart) return null;

      if (/^<u>[\s\S]*?<\/u>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<u>/i, '').replace(/<\/u>$/i, '');
        return (
          <span key={`u-${baseKey}-${tIdx}`} className="underline decoration-2 underline-offset-4 font-normal inline">
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </span>
        );
      }

      if (/^<b>[\s\S]*?<\/b>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<b>/i, '').replace(/<\/b>$/i, '');
        return (
          <strong key={`b-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      if (/^\*\*[\s\S]*?\*\*$/.test(tagPart)) {
        const inner = tagPart.slice(2, -2);
        return (
          <strong key={`bold-${baseKey}-${tIdx}`} className="font-extrabold text-inherit inline">
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </strong>
        );
      }

      if (/^\*[^\*]+?\*$/.test(tagPart) || /^_[^_]+?_$/.test(tagPart)) {
        const inner = tagPart.slice(1, -1);
        return (
          <em key={`em-${baseKey}-${tIdx}`} className="italic text-inherit inline">
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </em>
        );
      }

      return highlightTextNodes(tagPart, highlights, onHighlightClick);
    });
  }

  return highlightTextNodes(prose, highlights, onHighlightClick);
}
