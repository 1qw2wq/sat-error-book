/**
 * SAT Math Formatter & Preprocessor
 * Passes through XML MathML tags, KaTeX LaTeX formulas, and clean text untouched.
 */

// Helper to run transformations on non-math portions if needed
export function transformProseChunks(text: string, transformFn: (prose: string) => string): string {
  if (!text) return '';
  return transformFn(text);
}

/**
 * Cleans an individual expression string without altering MathML or formulas
 */
export function cleanMathExpr(expr: string): string {
  if (!expr) return '';
  return expr.replace(/[\u200B\uFEFF]/g, '').trim();
}

/**
 * Alias for cleanMathExpr
 */
export function cleanMathEquation(eq: string): string {
  return cleanMathExpr(eq);
}

/**
 * Formats math text for display.
 * Retains MathML XML (<math>...</math>), HTML tags, and LaTeX notation untouched.
 */
export function formatMathText(rawText: string): string {
  if (!rawText) return '';
  let s = rawText
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (s.includes('\\n') && !s.includes('\n')) {
    s = s.replace(/\\n/g, '\n');
  }

  // 1. Auto line breaks before option choices (A), (B), (C), (D) or A), B), C), D) or A., B., C., D. or 选项A in prose
  // Ensures choice letters like A., B., C., D. are NOT matched inside words like "land." or "period."
  s = s.replace(/(?<=\S)\s*(\([A-Da-d]\)|(?<![a-zA-Z0-9])[A-Da-d][\.\)]|选项[A-Da-d])\s*/g, '\n$1 ');

  // 2. Auto line break before conclusions "所以选", "故选", "因此选"
  s = s.replace(/([^\n])\s*(所以选|故选|因此选)\s*/g, '$1\n$2 ');

  // 3. Auto line break before notes/stimulus bullet points (• or \u2022 or ▪)
  s = s.replace(/([^\n])\s*([•\u2022▪])\s*/g, '$1\n$2 ');
  // Ensure space after bullet point
  s = s.replace(/([•\u2022▪])([^\s])/g, '$1 $2');

  // 4. Split math dollar blocks trapped around English connector words (e.g. "$g(a) = 18and g(4)=b$" -> "$g(a) = 18$ and $g(4)=b$")
  s = s.replace(/\$([^\$\n]+?)\$/g, (match, inner) => {
    // If it's already complex LaTeX or environment, leave as is
    if (inner.includes('\\begin') || inner.includes('\\text')) {
      return match;
    }

    // Normalize attached connector words like "18and" -> "18 and", "andg(4)" -> "and g(4)", "=18and" -> "= 18 and"
    let cleanedInner = inner
      .replace(/(\d|[a-zA-Z\)\}\]>=])\s*(and|or|where|when|for|if|then|with|is)\b/gi, '$1 $2')
      .replace(/\b(and|or|where|when|for|if|then|with|is)\s*(\d|[a-zA-Z\(\{\[]|=|(?=\$))/gi, '$1 $2');

    const wordRegex = /\b(and|or|where|when|for|if|then|with|is)\b/i;
    if (wordRegex.test(cleanedInner)) {
      const parts = cleanedInner.split(/\b(and|or|where|when|for|if|then|with|is)\b/i);
      const rebuilt: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (!p) continue;
        if (/\b(and|or|where|when|for|if|then|with|is)\b/i.test(p) && p.split(/\s+/).length === 1) {
          rebuilt.push(` ${p} `);
        } else {
          rebuilt.push(`$${p}$`);
        }
      }
      return rebuilt.join('');
    }

    return match;
  });

  return s;
}

/**
 * Formats an answer choice string.
 * Strips leading choice prefixes like "A. ", "B. ", etc. and returns the clean string / MathML XML.
 */
export function formatMathChoice(choice: string): string {
  if (!choice) return '';
  let clean = choice.trim();
  // Strip prefix "A. ", "B. ", "C) ", "D) " if present
  clean = clean.replace(/^[A-Da-d][.)\s]\s*/, '').trim();
  return clean;
}
