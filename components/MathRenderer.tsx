'use client';

import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * High-precision MathRenderer using KaTeX with zero-crash fallback.
 * Formats inline math ($...$), block math ($$...$$), LaTeX commands (\frac, \sqrt, \le, etc.),
 * and converts unformatted algebraic expressions like (3/4)x or x^2 into clean math.
 */
export default function MathRenderer({ text, className = '' }: MathRendererProps) {
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
        return <span key={index}>{renderProseWithInlineMath(part, index)}</span>;
      })}
    </span>
  );
}

function renderProseWithInlineMath(prose: string, baseKey: number) {
  // Matches expressions like y = -3x + 4, x^2 - 4x + 3 = 0, f(x), (2, -1), x^2
  const exprRegex = /(\b(?:[a-zA-Z]\([a-zA-Z0-9\s,\+-]+\)|[a-zA-Z0-9_-]+\^[0-9a-zA-Z]+|\d*x\^2|\b[a-zA-Z]\s*=\s*[-+\d\/\*\.\(\)a-zA-Z]+|\b\d+[a-zA-Z]\s*[\+-]\s*\d+[a-zA-Z]\s*=\s*\d+)\b)/g;

  const subParts = prose.split(exprRegex);
  if (subParts.length <= 1) return prose;

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
        return <span key={`sub-${baseKey}-${i}`}>{sub}</span>;
      }
    }
    return <span key={`sub-${baseKey}-${i}`}>{sub}</span>;
  });
}
