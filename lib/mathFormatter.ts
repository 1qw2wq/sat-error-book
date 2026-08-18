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
  return rawText
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
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
