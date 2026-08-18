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

  // Support Markdown Images ![alt](url) or embedded pure image URLs
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

/**
 * Converts MathML XML markup into clean LaTeX for KaTeX rendering with robust entity & symbol decoding.
 */
export function convertMathmlToLatex(mathml: string): string {
  if (!mathml) return '';
  let s = mathml;

  // Pre-clean inline HTML formatting tags & broken wrappers inside MathML XML exported by College Board
  s = s.replace(/<br\s*\/?>/gi, ' ')
       .replace(/<\/?(span|strong|em|b|i|u|div|p)[^>]*>/gi, '');

  // Fix malformed opening math tags like `<math>xmlns="..." display="..."&gt;`
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

  // Clean zero-width and invisible math operators (invisible times U+2062, function apply U+2061, etc.)
  s = s.replace(/[\u2061\u2062\u2063\u2064\u200B\uFEFF]/g, '');
  s = s.replace(/\\n/g, ' ').replace(/[\r\n]+/g, ' ');
  s = s.replace(/，/g, ', ').replace(/、/g, ', ');

  // Clean semantics & annotations
  s = s.replace(/<semantics[^>]*>([\s\S]*?)<\/semantics>/gi, '$1');
  s = s.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, '');
  s = s.replace(/<mspace[^>]*>/gi, ' ');

  // Clean opening/closing <math> tag
  s = s.replace(/^<math[^>]*>/i, '').replace(/<\/math>$/i, '');

  function parseNodes(str: string): string {
    if (!str) return '';
    let res = str;

    // Parse mtable first before stripping row/cell wrappers
    res = res.replace(/<mtable[^>]*>([\s\S]*?)<\/mtable>/gi, (_, inner) => {
      const rows = inner.match(/<mtr[^>]*>[\s\S]*?<\/mtr>/gi) || [inner];
      const latexRows = rows.map((r: string) => {
        const cells = r.match(/<mtd[^>]*>[\s\S]*?<\/mtd>/gi) || [r];
        return cells.map((c: string) => parseNodes(c.replace(/<\/?mtd[^>]*>/gi, ''))).join(' & ');
      }).join(' \\\\ ');
      return `\\begin{matrix} ${latexRows} \\end{matrix}`;
    });

    // Recursively parse mfrac
    let prev = '';
    while (res !== prev) {
      prev = res;
      res = res.replace(/<mfrac[^>]*>([\s\S]*?)<\/mfrac>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `\\frac{${parseNodes(parts[0])}}{${parseNodes(parts[1])}}`;
        }
        return `\\frac{${parseNodes(inner)}}{}`;
      });
    }

    // Recursively parse mmsubsup
    prev = '';
    while (res !== prev) {
      prev = res;
      res = res.replace(/<msubsup[^>]*>([\s\S]*?)<\/msubsup>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 3) {
          return `{${parseNodes(parts[0])}}_{${parseNodes(parts[1])}}^{${parseNodes(parts[2])}}`;
        }
        return inner;
      });
    }

    // Recursively parse msup
    prev = '';
    while (res !== prev) {
      prev = res;
      res = res.replace(/<msup[^>]*>([\s\S]*?)<\/msup>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `{${parseNodes(parts[0])}}^{${parseNodes(parts[1])}}`;
        }
        return inner;
      });
    }

    // Recursively parse msub
    prev = '';
    while (res !== prev) {
      prev = res;
      res = res.replace(/<msub[^>]*>([\s\S]*?)<\/msub>/gi, (_, inner) => {
        const parts = splitMathmlNodes(inner);
        if (parts.length >= 2) {
          return `{${parseNodes(parts[0])}}_{${parseNodes(parts[1])}}`;
        }
        return inner;
      });
    }

    // Parse msqrt
    res = res.replace(/<msqrt[^>]*>([\s\S]*?)<\/msqrt>/gi, (_, inner) => `\\sqrt{${parseNodes(inner)}}`);

    // Parse mroot
    res = res.replace(/<mroot[^>]*>([\s\S]*?)<\/mroot>/gi, (_, inner) => {
      const parts = splitMathmlNodes(inner);
      if (parts.length >= 2) {
        return `\\sqrt[${parseNodes(parts[1])}]{${parseNodes(parts[0])}}`;
      }
      return `\\sqrt{${parseNodes(inner)}}`;
    });

    // Parse mfenced
    res = res.replace(/<mfenced[^>]*>([\s\S]*?)<\/mfenced>/gi, (_, inner) => `\\left(${parseNodes(inner)}\\right)`);

    // Parse mover
    res = res.replace(/<mover[^>]*>([\s\S]*?)<\/mover>/gi, (_, inner) => {
      const parts = splitMathmlNodes(inner);
      if (parts.length >= 2) {
        return `\\overline{${parseNodes(parts[0])}}`;
      }
      return parseNodes(inner);
    });

    // Parse munder
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

    // Parse menclose
    res = res.replace(/<menclose[^>]*>([\s\S]*?)<\/menclose>/gi, (_, inner) => `\\boxed{${parseNodes(inner)}}`);

    // Unwrap mstyle, mrow, mpadded, mtr, mtd, math wrappers AFTER splitting structural tags
    let prevContainer = '';
    while (res !== prevContainer) {
      prevContainer = res;
      res = res.replace(/<mstyle[^>]*>([\s\S]*?)<\/mstyle>/gi, '$1');
      res = res.replace(/<mrow[^>]*>([\s\S]*?)<\/mrow>/gi, '$1');
      res = res.replace(/<mpadded[^>]*>([\s\S]*?)<\/mpadded>/gi, '$1');
      res = res.replace(/<mtr[^>]*>([\s\S]*?)<\/mtr>/gi, '$1');
      res = res.replace(/<mtd[^>]*>([\s\S]*?)<\/mtd>/gi, '$1');
      res = res.replace(/<math[^>]*>([\s\S]*?)<\/math>/gi, '$1');
    }

    // Parse mtext
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

    // Parse mo (operators)
    res = res.replace(/<mo[^>]*>([\s\S]*?)<\/mo>/gi, (_, t) => {
      const txt = t.trim().replace(/\\"/g, '"');
      if (txt === '≡') return ' \\equiv ';
      if (txt === '≤' || txt === '&le;') return ' \\le ';
      if (txt === '≥' || txt === '&ge;') return ' \\ge ';
      if (txt === '≠' || txt === '&ne;') return ' \\ne ';
      if (txt === '<' || txt === '&lt;') return ' < ';
      if (txt === '>' || txt === '&gt;') return ' > ';
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

    // Parse mi (identifiers)
    res = res.replace(/<mi[^>]*>([\s\S]*?)<\/mi>/gi, (_, t) => {
      const txt = t.trim().replace(/\$/g, '\\$').replace(/\\"/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
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

    // Parse mn (numbers)
    res = res.replace(/<mn[^>]*>([\s\S]*?)<\/mn>/gi, (_, t) => {
      return t.trim().replace(/%/g, '\\%').replace(/\$/g, '\\$').replace(/_/g, '{\\_}');
    });

    // Strip any lingering XML or HTML tags cleanly
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

  // Global cleanup on resulting LaTeX
  finalLatex = finalLatex
    .replace(/(?<!\\)%/g, '\\%')
    .replace(/−/g, '-')
    .replace(/∗/g, '*')
    .replace(/⋆/g, '*')
    .replace(/•/g, '\\cdot ')
    .replace(/\s+/g, ' ')
    .trim();

  return finalLatex;
}

/**
 * Component for rendering MathML markup natively using MathJax.
 */
function MathJaxMml({ mathml, isBlock = false }: { mathml: string; isBlock?: boolean }) {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  const cleanMathML = useMemo(() => {
    let s = mathml;
    // Clean inline html tags inside mathml XML
    s = s.replace(/<br\s*\/?>/gi, ' ')
         .replace(/<\/?(span|strong|em|b|i|u|div|p)[^>]*>/gi, '');

    // Unescape character entities if present
    s = s.replace(/&amp;/g, '&')
         .replace(/&quot;/g, '"')
         .replace(/&apos;/g, "'")
         .replace(/&#177;/g, '±')
         .replace(/&#8804;/g, '≤')
         .replace(/&#8805;/g, '≥')
         .replace(/&#8800;/g, '≠')
         .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
         .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

    // Clean nested <math> tags if present
    if (/<math[^>]*>[\s\S]*<math[^>]*>/i.test(s)) {
      const inner = s.replace(/<\/?math[^>]*>/gi, '');
      s = '<math xmlns="http://www.w3.org/1998/Math/MathML">' + inner + '</math>';
    }

    // Ensure xmlns attribute is present for MathJax / browser MathML parsing
    if (!s.includes('xmlns=')) {
      s = s.replace(/<math/i, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
    }

    // Standardize display attribute
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
      className={isBlock ? 'block my-2 text-center overflow-x-auto text-black dark:text-white font-serif' : 'inline-math-wrapper inline mx-0.5 align-baseline text-black dark:text-white font-serif'}
      dangerouslySetInnerHTML={{ __html: cleanMathML }}
    />
  );
}

/**
 * High-precision MathRenderer supporting native MathML via MathJax and LaTeX via KaTeX.
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
          className={isBlock ? 'block my-2 overflow-x-auto text-center text-black dark:text-white font-serif' : 'inline-block px-0.5 align-baseline text-black dark:text-white font-serif'}
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

  // Tokenize string into MathML, KaTeX math blocks, vs plain prose
  const tokens: { type: 'mathml' | 'math' | 'prose'; text: string; isBlock?: boolean }[] = [];
  const mathRegex = /(<math[\s\S]*?<\/math>|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}|[^$\n]+?)\$|`[^`]+?`|\\begin\{([a-z*]+)\}[\s\S]*?\\end\{\2\})/gi;

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

    if (fullMatch.toLowerCase().startsWith('<math')) {
      // In College Board SAT XML, MathML tags include display="block" by default even for inline formulas.
      // We render MathML inline by default so equations inside sentences/choices flow naturally without breaking lines.
      tokens.push({ type: 'mathml', text: fullMatch, isBlock: false });
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
