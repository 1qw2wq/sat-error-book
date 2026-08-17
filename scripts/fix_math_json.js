/**
 * Bulletproof Math & LaTeX Transformer for Digital SAT Questions
 */

function cleanMathText(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText;

  let text = rawText.trim();

  // 1. Protect currency values like $60, $35, $840, $7.99, $2,500
  text = text.replace(/\$\s*(\d[\d,]*(?:\.\d+)?)\b/g, '__USD__$1');

  // 2. Normalize Unicode symbols
  text = text
    .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-')
    .replace(/\u00D7/g, ' \\times ')
    .replace(/\u00F7/g, ' \\div ')
    .replace(/\u2264/g, ' \\le ')
    .replace(/\u2265/g, ' \\ge ')
    .replace(/\u2260/g, ' \\ne ')
    .replace(/\u00B1/g, ' \\pm ')
    .replace(/\u03C0/g, ' \\pi ')
    .replace(/\u03B8/g, ' \\theta ')
    .replace(/\u221E/g, ' \\infty ')
    .replace(/\u2248/g, ' \\approx ')
    .replace(/\u223C/g, ' \\sim ')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // 3. Geometry symbols: △ ABC -> $\triangle ABC$, ∠ ABC -> $\angle ABC$, 58° -> $58^\circ$, D E ― -> $\overline{DE}$
  text = text.replace(/(?:△|\u25B3|\u25BD)\s*([A-Za-z]{2,4})/g, (_, name) => `$\\triangle ${name}$`);
  text = text.replace(/(?:∠|\u2220)\s*([A-Za-z0-9]+)/g, (_, name) => `$\\angle ${name}$`);
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:[∘°]|\u2218)/g, (_, deg) => `$${deg}^\\circ$`);
  text = text.replace(/([A-Z])\s+([A-Z])\s*[―—_¯]/g, (_, a, b) => `$\\overline{${a}${b}}$`);
  text = text.replace(/\b([A-Z]{2})\s*[―—_¯]/g, (_, ab) => `$\\overline{${ab}}$`);

  // 4. Standardize plane, axis, coordinate and intercept references
  text = text.replace(/\b([xyz])\s+([xyz])\s*-\s*plane\b/gi, (_, a, b) => `$${a}${b}$-plane`);
  text = text.replace(/\b([xyz])\s*-\s*plane\b/gi, (_, a) => `$${a}$-plane`);
  text = text.replace(/\b([xyz])\s*-\s*axis\b/gi, (_, a) => `$${a}$-axis`);
  text = text.replace(/\b([xyz])\s*-\s*coordinate\b/gi, (_, a) => `$${a}$-coordinate`);
  text = text.replace(/\b([xyz])\s*-\s*intercept\b/gi, (_, a) => `$${a}$-intercept`);

  // 5. Square root and radicals
  text = text.replace(/(?:√|\u221A)\s*\(\s*([^)]+)\s*\)/g, (_, inner) => `$\\sqrt{${inner.replace(/\s+/g, '')}}$`);
  text = text.replace(/(?:√|\u221A)\s*([a-zA-Z0-9]+)/g, (_, inner) => `$\\sqrt{${inner}}$`);

  // 6. Exponential OCR patterns: "11 ( 1 7 ) x" or "11 ( 1 / 7 ) x" -> "$11\left(\frac{1}{7}\right)^x$"
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*\(\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)\s*\)\s*([a-zA-Z0-9]+)\b/g, (_, c, n, d, exp) => {
    return `$${c}\\left(\\frac{${n}}{${d}}\\right)^{${exp}}$`;
  });
  text = text.replace(/\b\(\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)\s*\)\s*([a-zA-Z0-9]+)\b/g, (_, n, d, exp) => {
    return `$\\left(\\frac{${n}}{${d}}\\right)^{${exp}}$`;
  });

  // 7. Compound OCR fractions like "48 ( k + 3 ) 4 ( k + 3 )"
  text = text.replace(/\b(\d+)\s*\(\s*([a-zA-Z0-9+\-]+)\s*\)\s+(\d+)\s*\(\s*([a-zA-Z0-9+\-]+)\s*\)/g, (_, n1, expr1, n2, expr2) => {
    return `$\\frac{${n1}(${expr1.replace(/\s+/g, '')})}{${n2}(${expr2.replace(/\s+/g, '')})}$`;
  });

  // 8. Spaced variable powers: "x 2" -> "x^2", "x 3" -> "x^3", "k 2" -> "k^2", "t 2" -> "t^2"
  text = text.replace(/\b([xyzabcktnmpqrsuvwXYZ])\s+([2-9])\b(?=[\s+\-=<>,.)]|$)/g, '$1^{$2}');
  text = text.replace(/\bin\s+3\b/g, 'in$^3$');
  text = text.replace(/\bcm\s+2\b/g, 'cm$^2$');
  text = text.replace(/\bm\s+2\b/g, 'm$^2$');

  // 9. Spaced numbers with single variables: "60 x + 35 y" -> "60x + 35y", "5 x + 4" -> "5x + 4"
  text = text.replace(/(\d+(?:\.\d+)?)\s+([xyzabcktnmpqrsuvwXYZ])\b/g, '$1$2');
  // Adjacent single-letter variables: "x y" -> "xy", "4 x t y" -> "4xty"
  text = text.replace(/\b([xyzabcktnmpqrsuvw])\s+([xyzabcktnmpqrsuvw])\s+([xyzabcktnmpqrsuvw])\b/g, '$1$2$3');
  text = text.replace(/\b([xyzabcktnmpqrsuvw])\s+([xyzabcktnmpqrsuvw])\b(?=\s*[=+\-/*^<>,;)]|\s+is|\s+and|\s*$)/g, '$1$2');

  // 10. Clean spaced coordinates like "( 0 , 11 )", "( 60 , 4.32 )", "( - 3 , 4 )"
  text = text.replace(/\(\s*([-+]?\s*\d+(?:\.\d+)?)\s*,\s*([-+]?\s*\d+(?:\.\d+)?)\s*\)/g, (_, p1, p2) => {
    return `$(${p1.replace(/\s+/g, '')}, ${p2.replace(/\s+/g, '')})$`;
  });
  text = text.replace(/\(\s*([xyzabcktnmpqrsuvw])\s*,\s*([-+]?\s*\d+(?:\.\d+)?)\s*\)/g, (_, p1, p2) => {
    return `$(${p1.trim()}, ${p2.replace(/\s+/g, '')})$`;
  });
  text = text.replace(/\(\s*([xyzabcktnmpqrsuvw])\s*,\s*([xyzabcktnmpqrsuvw])\s*\)/g, (_, p1, p2) => {
    return `$(${p1.trim()}, ${p2.trim()})$`;
  });

  // 11. Function definitions: "g ( x ) = 5x + 4" -> "$g(x) = 5x + 4$"
  text = text.replace(/(?<!\$)\b([fghpqrstCFGHW])\s*\(\s*([a-zA-Z0-9\s,\-+/*.]+)\s*\)\s*=\s*([-+]?\s*[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s+[\.,;]|\s+(?:What|Which|If|Where|The|When|For|According|How)\b|[.!?]|$)/gi, (_, fn, arg, rhs) => {
    const cleanArg = arg.replace(/\s+/g, '');
    const cleanRhs = rhs.trim().replace(/,\s*$/, '');
    return `$${fn}(${cleanArg}) = ${cleanRhs}$`;
  });

  // 12. Standalone function calls like "g ( x )", "g ( 9 )", "W ( 0 )"
  text = text.replace(/(?<!\$)\b([fghpqrstCFGHW])\s*\(\s*([a-zA-Z0-9\s,\-+/*.]+)\s*\)(?!\$)/g, (match, fn, arg) => {
    const cleanArg = arg.replace(/\s+/g, '');
    return `$${fn}(${cleanArg})$`;
  });

  // 13. Equations starting at beginning of question: e.g. "60x + 35y = 840" or "y = 30x + 6"
  text = text.replace(/^(?:\s*|\n\s*)([a-zA-Z0-9()\-+/*.,\s^\\{}]+?\s*=\s*[-+]?\s*[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s+(?:The|In|If|Where|What|Which|Tom|For|A|An|Sellers|Each|According|How)\b|[.!?]|$)/i, (match, eq) => {
    if (eq.includes('$') || eq.includes('?')) return match;
    const cleanEq = eq.trim();
    if (cleanEq.length > 2 && cleanEq.includes('=')) {
      return `$${cleanEq}$ `;
    }
    return match;
  });

  // 14. Equations in clauses: "If xy = 3 and 4xty = 96 ," or "where y = g(x) ,"
  text = text.replace(/\b(If|if|where|and|equation)\s+([a-zA-Z0-9()\-+/*.,\s^\\{}]+?\s*=\s*[-+]?\s*[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s*[,;]|\s+what|\s+then|\s+find|\s+and)/gi, (match, prefix, eq) => {
    if (eq.includes('$') || eq.includes('?')) return match;
    return `${prefix} $${eq.trim()}$`;
  });

  // 15. Geometric segment equalities: "B D = A D", "B E = 7", "A C = 13"
  text = text.replace(/\b([A-Z])\s+([A-Z])\s*=\s*([A-Z])\s+([A-Z])\b/g, '$$$1$2 = $3$4$$');
  text = text.replace(/\b([A-Z])\s+([A-Z])\s*=\s*(\d+(?:\.\d+)?)\b/g, '$$$1$2 = $3$$');

  // 16. "value of t ?" or "value of 8x + 10 ?" or "value of x + y ?"
  text = text.replace(/\bvalue\s+of\s+([a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s*[?.,;]|\s+is|\s+in|\s*$)/gi, (match, expr) => {
    const trimmed = expr.trim();
    if (trimmed.length > 0 && !trimmed.includes('$') && !trimmed.includes('the') && !trimmed.includes('a') && /[a-zA-Z0-9+\-*/^]/.test(trimmed)) {
      return `value of $${trimmed}$`;
    }
    return match;
  });

  // 17. Single variables in phrases: "for x months" -> "for $x$ months", "for y months" -> "for $y$ months", "x years after" -> "$x$ years after"
  text = text.replace(/\b(for|in|where|let)\s+([xyzabcktnmpqrsuvw])\s+(months|days|hours|years|units|part|parts|seeds|plants)\b/gi, (_, prep, v, unit) => {
    return `${prep} $${v}$ ${unit}`;
  });
  text = text.replace(/\b([xyzabcktnmpqrsuvw])\s+(years|months|days|hours|plants|units)\s+after\b/gi, (_, v, unit) => {
    return `$${v}$ ${unit} after`;
  });
  text = text.replace(/\bnumber\s+([xyzabcktnmpqrsuvw])\s+of\b/gi, (_, v) => `number $${v}$ of`);

  // 18. Clean double/nested/mismatched dollar signs
  text = text.replace(/\$\$+/g, '$');
  text = text.replace(/\$(\s*)\$([^\$]+)\$(\s*)\$/g, '$$1$2$3$');

  // 19. Restore protected currency: __USD__60 -> $60
  text = text.replace(/__USD__(\d[\d,]*(?:\.\d+)?)/g, '$$$1');

  return text;
}

function cleanSelections(selections) {
  if (!Array.isArray(selections)) return selections;

  return selections.map((choice) => {
    if (typeof choice !== 'string') return choice;
    let clean = choice.trim();

    const prefixMatch = clean.match(/^([A-Da-d][.)\s]\s*)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    clean = clean.replace(/^[A-Da-d][.)\s]\s*/, '').trim();

    // Normalize dashes
    clean = clean
      .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-')
      .replace(/[\u00A0]/g, ' ')
      .replace(/%/g, '\\%');

    if (clean.startsWith('$') && clean.endsWith('$')) {
      return `${prefix}${clean}`;
    }

    // Degrees
    if (/^[-+]?\s*\d+(?:\.\d+)?\s*(?:[∘°]|\u2218)$/.test(clean)) {
      const deg = clean.replace(/\s*(?:[∘°]|\u2218)/, '');
      return `${prefix}$${deg}^\\circ$`;
    }

    // Negative fractions: "- 3 4" or "- 48 11" or "- 11 12"
    if (/^-\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)$/.test(clean)) {
      const m = clean.match(/^-\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)$/);
      return `${prefix}$-\\frac{${m[1]}}{${m[2]}}$`;
    }

    // Positive fractions: "1 8" or "4 3" or "48 11" or "216 11" or "130 9"
    if (/^(\d+)\s+(\d+)$/.test(clean)) {
      const parts = clean.split(/\s+/);
      return `${prefix}$\\frac{${parts[0]}}{${parts[1]}}$`;
    }
    if (/^(\d+)\/(\d+)$/.test(clean)) {
      const parts = clean.split('/');
      return `${prefix}$\\frac{${parts[0]}}{${parts[1]}}$`;
    }
    if (/^-\s*(\d+)\/(\d+)$/.test(clean)) {
      const m = clean.match(/^-\s*(\d+)\/(\d+)$/);
      return `${prefix}$-\\frac{${m[1]}}{${m[2]}}$`;
    }

    // Coordinates: "( 0 , 11 )"
    if (/^\(\s*[-+]?\s*\d+(?:\.\d+)?\s*,\s*[-+]?\s*\d+(?:\.\d+)?\s*\)$/.test(clean)) {
      const m = clean.match(/^\(\s*([-+]?\s*\d+(?:\.\d+)?)\s*,\s*([-+]?\s*\d+(?:\.\d+)?)\s*\)$/);
      return `${prefix}$(${m[1].replace(/\s+/g, '')}, ${m[2].replace(/\s+/g, '')})$`;
    }

    // Pure numbers
    if (/^[-+]?\s*\d+(?:\.\d+)?$/.test(clean)) {
      return `${prefix}${clean}`;
    }

    // Long sentences
    const words = clean.split(/\s+/);
    if (words.length >= 4 && /^(The|There|Both|Neither|Increases|Decreases|Each|If|When|By|For)\b/i.test(clean)) {
      return `${prefix}${clean}`;
    }

    // Mathematical expressions: e.g. "p ( x ) = 2 , 500 ( 7 ) x"
    if (/[=+\-*/^<>\\%]/.test(clean) || /\b[a-zA-Z]\b/.test(clean)) {
      let mathExpr = clean
        .replace(/(\d+(?:\.\d+)?)\s+([xyzabcktnmpqrsuvwXYZ])\b/g, '$1$2')
        .replace(/\b([xyzabcktnmpqrsuvwXYZ])\s+([2-9])\b/g, '$1^{$2}')
        .replace(/\b([xyzabcktnmpqrsuvw])\s+([xyzabcktnmpqrsuvw])\b/g, '$1$2')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/-\s+(\d+)/g, '-$1')
        .replace(/,\s*(\d{3})/g, '{,}$1')
        .replace(/\b(\d+)\s*\(\s*([0-9.]+)\s*\)\s*([xyzabcktnmpqrsuvw])/g, '$1($2)^{$3}')
        .replace(/\b(\d+)\s+(\d+)\s*([xyzabcktnmpqrsuvw])/g, '\\frac{$1}{$2}$3');
      return `${prefix}$${mathExpr}$`;
    }

    return `${prefix}${clean}`;
  });
}

function cleanExplanation(rawExp) {
  if (!rawExp || typeof rawExp !== 'string') return rawExp;

  let exp = rawExp.trim();

  // Normalize symbols
  exp = exp
    .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-')
    .replace(/\u00D7/g, ' \\times ')
    .replace(/\u00F7/g, ' \\div ')
    .replace(/\u2264/g, ' \\le ')
    .replace(/\u2265/g, ' \\ge ')
    .replace(/\u2260/g, ' \\ne ')
    .replace(/\u00B1/g, ' \\pm ')
    .replace(/\u03C0/g, ' \\pi ')
    .replace(/\u03B8/g, ' \\theta ')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Fix spaced variables and numbers: "60 x + 35 y = 840" -> "60x + 35y = 840"
  exp = exp.replace(/(\d+(?:\.\d+)?)\s+([xyzabcktnmpqrsuvwXYZ])\b/g, '$1$2');
  exp = exp.replace(/\b([xyzabcktnmpqrsuvwXYZ])\s+([2-9])\b(?=[\s+\-=<>,.)]|$)/g, '$1^{$2}');

  // Geometry: △ XYZ -> $\triangle XYZ$, ∠ X -> $\angle X$, etc.
  exp = exp.replace(/(?:△|\u25B3|\u25BD)\s*([A-Za-z]{2,4})/g, (_, name) => `$\\triangle ${name}$`);
  exp = exp.replace(/(?:∠|\u2220)\s*([A-Za-z0-9]+)/g, (_, name) => `$\\angle ${name}$`);
  exp = exp.replace(/([A-Z])\s+([A-Z])\s*[―—_¯]/g, (_, a, b) => `$\\overline{${a}${b}}$`);

  return exp;
}

module.exports = {
  cleanMathText,
  cleanSelections,
  cleanExplanation,
};
