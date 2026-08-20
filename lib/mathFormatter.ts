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
  s = s.replace(/([^\n])\s*(\([A-Da-d]\)|[A-Da-d]\)|[A-Da-d]\.|选项[A-Da-d])\s*/g, '$1\n$2 ');

  // 2. Auto line break before conclusions "所以选", "故选", "因此选"
  s = s.replace(/([^\n])\s*(所以选|故选|因此选)\s*/g, '$1\n$2 ');

  // 3. Split math dollar blocks trapped around English connector words (e.g. "$g(a) = 18 and g(4)=b$" -> "$g(a) = 18$ and $g(4)=b$")
  s = s.replace(/\$([^\$\n]+?)\$/g, (match, inner) => {
    if (/\b(and|or|where|when|for|if)\b/i.test(inner)) {
      let fixed = inner.replace(/\s+\b(and|or|where|when|for|if)\b\s+/gi, (m: string, word: string) => `$ ${word} $`);
      return `$${fixed}$`;
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
