'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import { formatMathText, sanitizeSatText } from '@/lib/mathFormatter';

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
  explanation?: string;
}

export function isPureImageUrl(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (/^!\[.*?\]\([^\)]+\)$/i.test(s)) return true;
  if (/^data:image\/[a-zA-Z0-9\+\-]+;base64,/i.test(s)) return true;
  if (/^blob:/i.test(s)) return true;
  if (/^(?:https?:\/\/|\/|assets\/)[^\s]+$/i.test(s)) return true;
  return false;
}

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
  // Convert escaped currency \$ back to $ and strip stray backslashes for clean UI display
  const cleanText = text ? text.replace(/\\(\$)/g, '$1').replace(/\\(?![a-zA-Z])/g, '') : text;
  if (!cleanText || !highlights || highlights.length === 0) return cleanText;

  const normTarget = normalizeText(cleanText).toLowerCase();

  const matchedHighlights: { item: HighlightItem; phrase: string }[] = [];

  highlights.forEach((h) => {
    if (!h.selectedText) return;
    const cleanSel = normalizeText(h.selectedText);
    if (!cleanSel) return;

    if (normTarget.includes(cleanSel.toLowerCase())) {
      matchedHighlights.push({ item: h, phrase: cleanSel });
    }
  });

  if (matchedHighlights.length === 0) return cleanText;

  matchedHighlights.sort((a, b) => b.phrase.length - a.phrase.length);

  const uniquePhrases = Array.from(new Set(matchedHighlights.map((m) => m.phrase)));

  const regexPatterns = uniquePhrases.map((phrase) => {
    const escaped = escapeRegExp(phrase);
    return escaped.replace(/\\\s+/g, '\\s+');
  });

  const masterPattern = regexPatterns.join('|');
  if (!masterPattern) return cleanText;

  try {
    const regex = new RegExp(`(${masterPattern})`, 'gi');
    const parts = cleanText.split(regex);

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
        let styleClass = 'bg-[#fef08a] text-slate-900 border-b-2 border-amber-400 font-normal px-0.5 rounded-2xs shadow-2xs';
        if (color === 'blue') {
          styleClass = 'bg-[#bae6fd] text-slate-900 border-b-2 border-sky-400 font-normal px-0.5 rounded-2xs shadow-2xs';
        } else if (color === 'pink') {
          styleClass = 'bg-[#fbcfe8] text-slate-900 border-b-2 border-pink-400 font-normal px-0.5 rounded-2xs shadow-2xs';
        } else if (color === 'underline') {
          styleClass = 'underline decoration-dashed decoration-2 decoration-current underline-offset-4 font-normal text-inherit px-0.5';
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
    return cleanText;
  }
}

function renderFormattedProseLeaves(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  const formatTagRegex = /(<u[^>]*>[\s\S]*?<\/u>|<ins[^>]*>[\s\S]*?<\/ins>|\\underline\{[^\}]*\}|<strong[^>]*>[\s\S]*?<\/strong>|<b[^>]*>[\s\S]*?<\/b>|\*\*[\s\S]*?\*\*|\*[^\*]+?\*|_[^_]+?_|_____+\b)/gi;
  const tagParts = prose.split(formatTagRegex);

  if (tagParts.length > 1) {
    return tagParts.map((tagPart, tIdx) => {
      if (!tagPart) return null;

      if (/^<u[^>]*>[\s\S]*?<\/u>$/i.test(tagPart) || /^<ins[^>]*>[\s\S]*?<\/ins>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<(?:u|ins)[^>]*>/i, '').replace(/<\/(?:u|ins)>$/i, '');
        return (
          <span
            key={`u-${baseKey}-${tIdx}`}
            className="underline decoration-solid decoration-2 underline-offset-4 decoration-current font-normal text-inherit inline"
          >
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </span>
        );
      }

      if (/^\\underline\{[^\}]*\}$/i.test(tagPart)) {
        const inner = tagPart.replace(/^\\underline\{/, '').replace(/\}$/, '');
        return (
          <span
            key={`u-latex-${baseKey}-${tIdx}`}
            className="underline decoration-solid decoration-2 underline-offset-4 decoration-current font-normal text-inherit inline"
          >
            {renderFormattedProseLeaves(inner, baseKey * 100 + tIdx, highlights, onHighlightClick)}
          </span>
        );
      }

      if (/^_____+\b/.test(tagPart)) {
        return (
          <span
            key={`blank-${baseKey}-${tIdx}`}
            className="inline-block border-b-2 border-slate-700 dark:border-slate-300 min-w-12 mx-1 px-1 text-center font-mono font-medium text-inherit"
          >
            &nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        );
      }

      if (/^<b[^>]*>[\s\S]*?<\/b>$/i.test(tagPart) || /^<strong[^>]*>[\s\S]*?<\/strong>$/i.test(tagPart)) {
        const inner = tagPart.replace(/^<(?:b|strong)[^>]*>/i, '').replace(/<\/(?:b|strong)>$/i, '');
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

function renderInlineProse(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  let cleanProse = prose;

  if (/^#{1,6}\s+/.test(cleanProse)) {
    const headingText = cleanProse.replace(/^#{1,6}\s+/, '');
    return (
      <span key={`h-${baseKey}`} className="block font-bold text-inherit mb-1">
        {renderInlineProse(headingText, baseKey * 10, highlights, onHighlightClick)}
      </span>
    );
  }

  if (/^>\s+/.test(cleanProse)) {
    const quoteText = cleanProse.replace(/^>\s+/, '');
    return (
      <span key={`bq-${baseKey}`} className="block italic text-inherit my-1 pl-2 border-l-2 border-slate-300 dark:border-slate-700">
        {renderInlineProse(quoteText, baseKey * 10, highlights, onHighlightClick)}
      </span>
    );
  }

  if (/^(?:[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]|\*(?!\*))\s*/.test(cleanProse)) {
    const bulletText = cleanProse.replace(/^(?:[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]|\*(?!\*)|\s)+/, '');
    if (!bulletText.trim()) return null;
    return (
      <span key={`bullet-${baseKey}`} className="flex items-start gap-2.5 my-1.5 pl-1 leading-relaxed text-inherit font-serif">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-slate-300 mt-2 shrink-0 select-none" />
        <span className="flex-1">
          {renderInlineProse(bulletText, baseKey * 10, highlights, onHighlightClick)}
        </span>
      </span>
    );
  }

  const imgRegex = /(!\[.*?\]\((?:https?:\/\/[^\s\)]+|data:image\/[a-zA-Z0-9\+\-]+;base64,[^\s\)]+|\/[^\s\)]+)\)|data:image\/[a-zA-Z0-9\+\-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s]+|\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s]*)?)/gi;
  if (imgRegex.test(cleanProse)) {
    const imgParts = cleanProse.split(imgRegex);
    return (
      <span key={`img-group-${baseKey}`} className="inline">
        {imgParts.map((subPart, sIdx) => {
          if (!subPart) return null;
          const mdMatch = subPart.match(/^!\[(.*?)\]\((.*?)\)$/i);
          if (mdMatch) {
            const alt = mdMatch[1] || 'SAT Diagram';
            const url = mdMatch[2] || '';
            return (
              <img
                key={`md-img-${baseKey}-${sIdx}`}
                src={url}
                alt={alt}
                referrerPolicy="no-referrer"
                className="max-h-56 max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 my-2 inline-block"
                loading="lazy"
              />
            );
          }
          if (isPureImageUrl(subPart)) {
            const imgSrc = subPart.startsWith('![')
              ? subPart.replace(/^!\[.*?\]\((.*?)\)$/, '$1').trim()
              : subPart.trim();
            return (
              <img
                key={`url-img-${baseKey}-${sIdx}`}
                src={imgSrc}
                alt="SAT Diagram"
                referrerPolicy="no-referrer"
                className="max-h-56 max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 my-2 inline-block"
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

function renderProseWithFormatting(
  prose: string,
  baseKey: number,
  highlights?: HighlightItem[],
  onHighlightClick?: (highlight: HighlightItem, e: React.MouseEvent) => void
) {
  if (prose.includes('|') && /\|[^\n]+\|/.test(prose)) {
    const lines = prose.split('\n');
    const tableLineIndices: number[] = [];
    lines.forEach((line, idx) => {
      if (/^\s*\|.*\|\s*$/.test(line)) {
        tableLineIndices.push(idx);
      }
    });

    if (tableLineIndices.length >= 2) {
      const startIdx = tableLineIndices[0];
      const endIdx = tableLineIndices[tableLineIndices.length - 1];

      const beforeLines = lines.slice(0, startIdx).map((l) => l.trim()).filter(Boolean);
      const tableLines = lines.slice(startIdx, endIdx + 1).map((l) => l.trim()).filter(Boolean);
      const afterLines = lines.slice(endIdx + 1).map((l) => l.trim()).filter(Boolean);

      const parsedRows: string[][] = tableLines
        .filter((l) => l.startsWith('|') && l.endsWith('|'))
        .map((l) =>
          l
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim())
        )
        .filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));

      if (parsedRows.length >= 2) {
        const headerRow = parsedRows[0];
        const bodyRows = parsedRows.slice(1);

        return (
          <span className="block my-3 w-full">
            {beforeLines.length > 0 && (
              <span className="block mb-2 font-serif text-inherit">
                {beforeLines.map((l, i) => (
                  <span key={i} className="block mb-1">{renderInlineProse(l, baseKey * 1000 + i, highlights, onHighlightClick)}</span>
                ))}
              </span>
            )}

            <div className="my-3 w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full text-left text-sm border-collapse font-sans text-slate-900 dark:text-slate-100">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold border-b-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    {headerRow.map((hCell, hIdx) => (
                      <th key={hIdx} className="px-4 py-2.5 font-extrabold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-700 last:border-r-0 text-center sm:text-left bg-slate-100 dark:bg-slate-800">
                        {renderInlineProse(hCell, baseKey * 100 + hIdx, highlights, onHighlightClick)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                  {bodyRows.map((rRow, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      {rRow.map((cCell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 last:border-r-0 align-middle text-center sm:text-left font-medium">
                          {renderInlineProse(cCell, baseKey * 200 + rIdx * 10 + cIdx, highlights, onHighlightClick)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {afterLines.length > 0 && (
              <span className="block mt-2 font-serif text-inherit">
                {afterLines.map((l, i) => (
                  <span key={i} className="block mt-1">{renderInlineProse(l, baseKey * 3000 + i, highlights, onHighlightClick)}</span>
                ))}
              </span>
            )}
          </span>
        );
      }
    }
  }

  if (prose.includes('\n')) {
    const lines = prose.split('\n');
    return (
      <span className="block space-y-1.5 my-1">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <span key={`empty-${baseKey}-${lIdx}`} className="block h-2" />;
          }
          return (
            <span key={`line-${baseKey}-${lIdx}`} className="block leading-relaxed">
              {renderInlineProse(trimmed, baseKey * 100 + lIdx, highlights, onHighlightClick)}
            </span>
          );
        })}
      </span>
    );
  }

  return renderInlineProse(prose, baseKey, highlights, onHighlightClick);
}

// Global KaTeX render cache to eliminate re-rendering overhead and freezing
const katexCache = new Map<string, string>();
const MAX_KATEX_CACHE = 5000;

function getCachedKatex(latex: string, isBlock: boolean): string {
  const cacheKey = `${isBlock ? 'B' : 'I'}:${latex}`;
  const existing = katexCache.get(cacheKey);
  if (existing !== undefined) {
    return existing;
  }

  let cleanLatex = latex.trim();

  // Repair control character corruptions (e.g. \frac becoming ASCII 12 \x0c, \begin becoming ASCII 8 \x08)
  cleanLatex = cleanLatex
    .replace(/\x0crac/g, '\\frac')
    .replace(/\x0c/g, '\\f')
    .replace(/\x08egin/g, '\\begin')
    .replace(/\x08/g, '\\b')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Strip outer delimiters if passed to getCachedKatex
  if (cleanLatex.startsWith('$$') && cleanLatex.endsWith('$$') && cleanLatex.length > 4) {
    cleanLatex = cleanLatex.slice(2, -2).trim();
  } else if (cleanLatex.startsWith('$') && cleanLatex.endsWith('$') && cleanLatex.length > 2) {
    cleanLatex = cleanLatex.slice(1, -1).trim();
  } else if (cleanLatex.startsWith('\\[') && cleanLatex.endsWith('\\]') && cleanLatex.length > 4) {
    cleanLatex = cleanLatex.slice(2, -2).trim();
  } else if (cleanLatex.startsWith('\\(') && cleanLatex.endsWith('\\)') && cleanLatex.length > 4) {
    cleanLatex = cleanLatex.slice(2, -2).trim();
  }

  cleanLatex = cleanLatex.replace(/&lt;/g, ' \\lt ').replace(/&gt;/g, ' \\gt ');
  cleanLatex = cleanLatex.replace(/(?<!\\)</g, ' \\lt ').replace(/(?<!\\)>/g, ' \\gt ');
  cleanLatex = cleanLatex.replace(/\\lt\s*=/g, '\\le ').replace(/\\gt\s*=/g, '\\ge ');
  cleanLatex = cleanLatex.replace(/\\+(?=[0-9])/g, '');
  cleanLatex = cleanLatex.replace(/(?<!\\)%/g, '\\%');
  if (!cleanLatex.includes('\\frac') && /\b\d+\/\d+\b/.test(cleanLatex)) {
    cleanLatex = cleanLatex.replace(/\b(\d+)\/(\d+)\b/g, '\\frac{$1}{$2}');
  }

  const isMultiLine = isBlock || /\\begin\{(aligned|matrix|cases|gathered|array)\}/i.test(cleanLatex) || cleanLatex.includes('\\\\');

  try {
    const rendered = katex.renderToString(cleanLatex, {
      displayMode: isMultiLine,
      throwOnError: false,
      output: 'html',
      strict: false,
    });
    if (katexCache.size >= MAX_KATEX_CACHE) {
      const firstKey = katexCache.keys().next().value;
      if (firstKey) katexCache.delete(firstKey);
    }
    katexCache.set(cacheKey, rendered);
    return rendered;
  } catch {
    const fallback = `<span class="inline font-mono font-medium">${latex.replace(/\\(?=[0-9\s])/g, '')}</span>`;
    katexCache.set(cacheKey, fallback);
    return fallback;
  }
}

export function convertMathmlToLatex(mathml: string): string {
  if (!mathml) return '';
  let s = mathml;

  s = s.replace(/<br\s*\/?>/gi, ' ')
       .replace(/<\/?(span|strong|em|b|i|u|div|p)[^>]*>/gi, '');

  s = s.replace(/^<math[^>]*&gt;/i, '<math>')
       .replace(/^<math\s*xmlns[^>]*>/i, '<math>')
       .replace(/&gt;/g, '>');

  s = s.replace(/&amp;/g, '&')
       .replace(/&quot;/g, '"')
       .replace(/&apos;/g, "'")
       .replace(/&#177;/g, '±')
       .replace(/&#8804;/g, '≤')
       .replace(/&#8805;/g, '≥')
       .replace(/&#8800;/g, '≠')
       .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
       .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  s = s.replace(/[\u2061\u2062\u2063\u2064\u200B\uFEFF]/g, '');
  s = s.replace(/\\n/g, ' ').replace(/[\r\n]+/g, ' ');
  s = s.replace(/，/g, ', ').replace(/、/g, ', ');

  s = s.replace(/<semantics[^>]*>([\s\S]*?)<\/semantics>/gi, '$1');
  s = s.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, '');
  s = s.replace(/<mspace[^>]*>/gi, ' ');

  s = s.replace(/^<math[^>]*>/i, '').replace(/<\/math>$/i, '');

  function parseNodes(str: string): string {
    if (!str) return '';
    let res = str;

    let prevContainer = '';
    let cIter = 0;
    while (res !== prevContainer && cIter++ < 8) {
      prevContainer = res;
      res = res.replace(/<mstyle[^>]*>([\s\S]*?)<\/mstyle>/gi, '$1');
      res = res.replace(/<mpadded[^>]*>([\s\S]*?)<\/mpadded>/gi, '$1');
    }

    res = res.replace(/<mtable[^>]*>([\s\S]*?)<\/mtable>/gi, (_, inner) => {
      const rows = inner.match(/<mtr[^>]*>[\s\S]*?<\/mtr>/gi) || [inner];
      const latexRows = rows.map((r: string) => {
        const cells = r.match(/<mtd[^>]*>[\s\S]*?<\/mtd>/gi) || [r];
        return cells.map((c: string) => parseNodes(c.replace(/<\/?mtd[^>]*>/gi, ''))).join(' & ');
      }).join(' \\\\ ');
      return `\\begin{aligned} ${latexRows} \\end{aligned}`;
    });

    let prev = '';
    let fIter = 0;
    while (res !== prev && fIter++ < 8) {
      prev = res;
      res = res.replace(/<mfrac[^>]*>([\s\S]*?)<\/mfrac>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `\\frac{${parseNodes(parts[0])}}{${parseNodes(parts[1])}}`;
        }
        return `\\frac{${parseNodes(inner)}}{}`;
      });
    }

    prev = '';
    let rIter = 0;
    while (res !== prev && rIter++ < 8) {
      prev = res;
      res = res.replace(/<mroot[^>]*>([\s\S]*?)<\/mroot>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `\\sqrt[${parseNodes(parts[1])}]{${parseNodes(parts[0])}}`;
        }
        return `\\sqrt{${parseNodes(inner)}}`;
      });
    }

    res = res.replace(/<msqrt[^>]*>([\s\S]*?)<\/msqrt>/gi, (_, inner) => `\\sqrt{${parseNodes(inner)}}`);

    prev = '';
    let ssuIter = 0;
    while (res !== prev && ssuIter++ < 8) {
      prev = res;
      res = res.replace(/<msubsup[^>]*>([\s\S]*?)<\/msubsup>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 3) {
          return `{${parseNodes(parts[0])}}_{${parseNodes(parts[1])}}^{${parseNodes(parts[2])}}`;
        }
        return inner;
      });
    }

    prev = '';
    let suIter = 0;
    while (res !== prev && suIter++ < 8) {
      prev = res;
      res = res.replace(/<msup[^>]*>([\s\S]*?)<\/msup>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `{${parseNodes(parts[0])}}^{${parseNodes(parts[1])}}`;
        }
        return inner;
      });
    }

    prev = '';
    let sbIter = 0;
    while (res !== prev && sbIter++ < 8) {
      prev = res;
      res = res.replace(/<msub[^>]*>([\s\S]*?)<\/msub>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `{${parseNodes(parts[0])}}_{${parseNodes(parts[1])}}`;
        }
        return inner;
      });
    }

    res = res.replace(/<mfenced[^>]*>([\s\S]*?)<\/mfenced>/gi, (_, inner) => `\\left(${parseNodes(inner)}\\right)`);

    res = res.replace(/<mover[^>]*>([\s\S]*?)<\/mover>/gi, (_, inner) => {
      const parts = splitMathmlNodes(inner);
      if (parts.length >= 2) {
        return `\\overline{${parseNodes(parts[0])}}`;
      }
      return parseNodes(inner);
    });

    res = res.replace(/<munder[^>]*>([\s\S]*?)<\/munder>/gi, (_, inner) => {
      const parts = splitMathmlNodes(inner);
      if (parts.length >= 2) {
        const base = parseNodes(parts[0]);
        const under = parseNodes(parts[1]);
        if (under.trim() === '_' || under.trim() === '{\\_}') {
          return `\\underline{${base}}`;
        }
        return `\\underset{${under}}{${base}}`;
      }
      return parseNodes(inner);
    });

    res = res.replace(/<menclose[^>]*>([\s\S]*?)<\/menclose>/gi, (_, inner) => `\\boxed{${parseNodes(inner)}}`);

    prevContainer = '';
    let clIter = 0;
    while (res !== prevContainer && clIter++ < 8) {
      prevContainer = res;
      res = res.replace(/<mstyle[^>]*>([\s\S]*?)<\/mstyle>/gi, '$1');
      res = res.replace(/<mrow[^>]*>([\s\S]*?)<\/mrow>/gi, '$1');
      res = res.replace(/<mpadded[^>]*>([\s\S]*?)<\/mpadded>/gi, '$1');
      res = res.replace(/<mtr[^>]*>([\s\S]*?)<\/mtr>/gi, '$1');
      res = res.replace(/<mtd[^>]*>([\s\S]*?)<\/mtd>/gi, '$1');
      res = res.replace(/<math[^>]*>([\s\S]*?)<\/math>/gi, '$1');
    }

    res = res.replace(/<mtext[^>]*>([\s\S]*?)<\/mtext>/gi, (_, t) => {
      const clean = t
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/_/g, '\\_')
        .replace(/#/g, '\\#')
        .replace(/\\"/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      return `\\text{${clean}}`;
    });

    res = res.replace(/<mo[^>]*>([\s\S]*?)<\/mo>/gi, (_, t) => {
      const txt = t.replace(/<[^>]+>/g, '').trim().replace(/\\"/g, '"');
      if (txt === '≡') return ' \\equiv ';
      if (txt === '≤' || txt === '&le;' || txt === '<=') return ' \\le ';
      if (txt === '≥' || txt === '&ge;' || txt === '>=') return ' \\ge ';
      if (txt === '≠' || txt === '&ne;' || txt === '!=') return ' \\ne ';
      if (txt === '<' || txt === '&lt;') return ' \\lt ';
      if (txt === '>' || txt === '&gt;') return ' \\gt ';
      if (txt === '×') return ' \\times ';
      if (txt === '÷') return ' \\div ';
      if (txt === '±') return ' \\pm ';
      if (txt === '∓') return ' \\mp ';
      if (txt === 'π') return ' \\pi ';
      if (txt === '°') return '^\\circ ';
      if (txt === '⋅' || txt === '·') return ' \\cdot ';
      if (txt === '∗' || txt === '⋆' || txt === '*') return ' * ';
      if (txt === '−') return ' - ';
      if (txt === '–' || txt === '—') return ' - ';
      if (txt === '√') return ' \\sqrt ';
      if (txt === '∠') return ' \\angle ';
      if (txt === '△') return ' \\triangle ';
      if (txt === '∥') return ' \\parallel ';
      if (txt === '⊥') return ' \\perp ';
      if (txt === '≅') return ' \\cong ';
      if (txt === '∼') return ' \\sim ';
      if (txt === '≈') return ' \\approx ';
      if (txt === '→') return ' \\to ';
      if (txt === '⇒') return ' \\Rightarrow ';
      if (txt === '⇔') return ' \\Leftrightarrow ';
      if (txt === '∞') return ' \\infty ';
      if (txt === '{') return '\\{';
      if (txt === '}') return '\\}';
      if (txt === '$') return '\\$';
      if (txt === '%') return '\\%';
      if (txt === '_') return '{\\_}';
      if (txt === '"') return '';
      return txt;
    });

    res = res.replace(/<mi[^>]*>([\s\S]*?)<\/mi>/gi, (_, t) => {
      const txt = t.replace(/<[^>]+>/g, '').trim().replace(/\$/g, '\\$').replace(/\\"/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (txt === 'sin' || txt === 'cos' || txt === 'tan' || txt === 'log' || txt === 'ln' || txt === 'sec' || txt === 'csc' || txt === 'cot') {
        return `\\${txt} `;
      }
      if (txt === 'θ') return '\\theta ';
      if (txt === 'α') return '\\alpha ';
      if (txt === 'β') return '\\beta ';
      if (txt === 'γ') return '\\gamma ';
      if (txt === 'δ') return '\\delta ';
      if (txt === 'π') return '\\pi ';
      if (txt === 'σ') return '\\sigma ';
      if (txt === 'λ') return '\\lambda ';
      if (txt === 'μ') return '\\mu ';
      if (txt === 'ϕ' || txt === 'φ') return '\\phi ';
      if (txt === 'Δ') return '\\Delta ';
      if (txt === 'Ω') return '\\Omega ';
      if (txt === '%') return '\\%';
      if (txt === '$') return '\\$';
      if (txt === '_') return '{\\_}';
      return txt;
    });

    res = res.replace(/<mn[^>]*>([\s\S]*?)<\/mn>/gi, (_, t) => {
      return t.replace(/<[^>]+>/g, '').trim().replace(/%/g, '\\%').replace(/\$/g, '\\$').replace(/_/g, '{\\_}');
    });

    res = res.replace(/<\/?([a-z0-9]+)[^>]*>/gi, '');

    return res;
  }

  function splitMathmlNodes(xmlStr: string): string[] {
    const nodes: string[] = [];
    let depth = 0;
    let curr = '';
    for (let i = 0; i < xmlStr.length; i++) {
      const char = xmlStr[i];
      if (char === '<') {
        if (xmlStr[i + 1] === '/') {
          depth--;
        } else {
          const closeIdx = xmlStr.indexOf('>', i);
          if (closeIdx !== -1 && xmlStr[closeIdx - 1] !== '/') {
            depth++;
          }
        }
      }
      curr += char;
      if (depth === 0 && (char === '>' || i === xmlStr.length - 1)) {
        if (curr.trim()) {
          nodes.push(curr.trim());
          curr = '';
        }
      }
    }
    if (curr.trim()) nodes.push(curr.trim());
    return nodes;
  }

  let finalLatex = parseNodes(s);

  finalLatex = finalLatex
    .replace(/(?<!\\)%/g, '\\%')
    .replace(/−/g, '-')
    .replace(/∗/g, '*')
    .replace(/⋆/g, '*')
    .replace(/•/g, '\\cdot ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!finalLatex || /^[\s,\.;:\?!]+$/.test(finalLatex)) {
    return '';
  }

  return finalLatex;
}

function MathJaxMml({ mathml, isBlock = false }: { mathml: string; isBlock?: boolean }) {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  const cleanMathML = useMemo(() => {
    let s = mathml;
    s = s.replace(/<br\s*\/?>/gi, ' ')
         .replace(/<\/?(span|strong|em|b|i|u|div|p)[^>]*>/gi, '');

    s = s.replace(/&amp;/g, '&')
         .replace(/&quot;/g, '"')
         .replace(/&apos;/g, "'")
         .replace(/&#177;/g, '±')
         .replace(/&#8804;/g, '≤')
         .replace(/&#8805;/g, '≥')
         .replace(/&#8800;/g, '≠')
         .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
         .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

    if (/<math[^>]*>[\s\S]*<math[^>]*>/i.test(s)) {
      const inner = s.replace(/<\/?math[^>]*>/gi, '');
      s = '<math xmlns="http://www.w3.org/1998/Math/MathML">' + inner + '</math>';
    }

    if (!s.includes('xmlns=')) {
      s = s.replace(/<math/i, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
    }

    if (isBlock) {
      if (!s.includes('display=')) {
        s = s.replace(/<math/i, '<math display="block"');
      }
    } else {
      s = s.replace(/display="block"/gi, 'display="inline"');
    }

    return s;
  }, [mathml, isBlock]);

  React.useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const doTypeset = () => {
      if (containerRef.current && typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
        (window as any).MathJax.typesetPromise([containerRef.current]).catch(() => {});
      } else if (attempts < 10) {
        attempts++;
        timerId = setTimeout(doTypeset, 300);
      }
    };

    doTypeset();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [cleanMathML]);

  return (
    <span
      ref={containerRef}
      className={isBlock ? 'block my-2 text-center overflow-x-auto text-inherit font-serif' : 'inline-math-wrapper inline mx-0.5 align-baseline text-inherit font-serif'}
      dangerouslySetInnerHTML={{ __html: cleanMathML }}
    />
  );
}

export default function MathRenderer({ text, className = '', highlights, onHighlightClick }: MathRendererProps) {
  const isImage = useMemo(() => {
    if (!text) return false;
    return isPureImageUrl(text.trim());
  }, [text]);

  // Fast-path: If the string is purely plain text with no math, equations, or markup tokens
  const isSimpleText = useMemo(() => {
    if (!text || isImage) return false;
    // If text contains no math indicators or formatting tokens, skip heavy regex pipeline
    return !/[$`\\<>&^{}[\]|~*±≤≥≠πθ√\n\t]|https?:\/\/|data:image/i.test(text);
  }, [text, isImage]);

  const processedText = useMemo(() => {
    if (!text || isImage || isSimpleText) return '';
    let formatted = sanitizeSatText(text);
    formatted = formatMathText(formatted);
    return formatted;
  }, [text, isImage, isSimpleText]);

  if (!text) return null;

  const rawTrimmed = text.trim();

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

  // Fast-path render for plain text strings (which makes up 90% of reading passages)
  if (isSimpleText) {
    return (
      <span className={`inline-wrap leading-relaxed ${className}`}>
        {renderProseWithFormatting(text, 0, highlights, onHighlightClick)}
      </span>
    );
  }

  const renderKatex = (latex: string, isBlock = false, key: number) => {
    const html = getCachedKatex(latex, isBlock);
    const isMultiLine = isBlock || /\\begin\{(aligned|matrix|cases|gathered|array)\}/i.test(latex) || latex.includes('\\\\');

    return (
      <span
        key={key}
        className={isMultiLine ? 'block my-2 overflow-x-auto text-center text-inherit font-serif' : 'inline-block px-0.5 align-baseline text-inherit font-serif'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  const tokens: { type: 'mathml' | 'math' | 'prose'; text: string; isBlock?: boolean }[] = [];
  const mathRegex = /(<math[\s\S]*?<\/math>|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}|[^$\n]+?)(?<!\\)\$|`[^`]+?`|\\begin\{([a-z*]+)\}[\s\S]*?\\end\{\2\})/gi;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(processedText)) !== null) {
    const start = match.index;
    const fullMatch = match[0];

    if (fullMatch.startsWith('$') && fullMatch.endsWith('$') && fullMatch.length > 2) {
      const inner = fullMatch.slice(1, -1);
      if (/<u\b|<\/u>|<ins\b|<\/ins>/i.test(inner)) {
        tokens.push({ type: 'prose', text: processedText.substring(lastIdx, mathRegex.lastIndex) });
        lastIdx = mathRegex.lastIndex;
        continue;
      }
      const hasLatexSyntax = /\\[a-zA-Z]+|[=<>+\-^_\/\\\{\}\(\)]|^\d+$/.test(inner);
      if (!hasLatexSyntax) {
        const words = inner.match(/\b[a-zA-Z]{2,}\b/g) || [];
        const nonMathWords = words.filter((w) => !/^(?:sin|cos|tan|log|ln|lim|max|min|det|deg|rad|var|mod|and|or|is|if|for|all|not|ge|le|pm|times|div|frac|sqrt|pi|theta|alpha|beta|gamma|delta|sigma|lambda|mu|phi|omega)$/i.test(w));
        if (nonMathWords.length >= 2 && !inner.includes('\\begin') && !inner.includes('\\text')) {
          tokens.push({ type: 'prose', text: processedText.substring(lastIdx, mathRegex.lastIndex) });
          lastIdx = mathRegex.lastIndex;
          continue;
        }
      }
    }

    if (start > lastIdx) {
      tokens.push({ type: 'prose', text: processedText.substring(lastIdx, start) });
    }

    if (fullMatch.toLowerCase().startsWith('<math')) {
      const isMtable = /<mtable/i.test(fullMatch);
      tokens.push({ type: 'mathml', text: fullMatch, isBlock: isMtable });
    } else {
      const isBlock = (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) ||
                      (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) ||
                      (fullMatch.startsWith('\\begin{') && fullMatch.includes('\\end{'));

      tokens.push({ type: 'math', text: fullMatch, isBlock });
    }
    lastIdx = mathRegex.lastIndex;
  }

  if (lastIdx < processedText.length) {
    tokens.push({ type: 'prose', text: processedText.substring(lastIdx) });
  }

  return (
    <span className={`inline-wrap leading-relaxed ${className}`}>
      {tokens.map((token, index) => {
        if (!token.text) return null;

        if (token.type === 'mathml') {
          const convertedLatex = convertMathmlToLatex(token.text);
          if (convertedLatex) {
            return renderKatex(convertedLatex, !!token.isBlock, index);
          }
          return <MathJaxMml key={index} mathml={token.text} isBlock={!!token.isBlock} />;
        }

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