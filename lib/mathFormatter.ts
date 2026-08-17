/**
 * Intelligent SAT Math Formatter & Preprocessor
 * Preprocesses raw OCR and plain text SAT math questions, prompts, choices, and explanations
 * into standard, pristine LaTeX notation for KaTeX rendering.
 */

// Helper to run replacements ONLY on non-math portions of a string
export function transformProseChunks(text: string, transformFn: (prose: string) => string): string {
  if (!text) return '';
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i]) {
      parts[i] = transformFn(parts[i]);
    }
  }
  return parts.join('');
}

/**
 * Cleans an individual algebraic or arithmetic expression / equation for LaTeX rendering
 */
export function cleanMathExpr(expr: string): string {
  if (!expr) return '';
  let clean = expr.trim();

  // If this is an image URL or media asset, return untouched
  if (
    /^https?:\/\//i.test(clean) ||
    clean.includes('/upload/image/') ||
    /\.(png|jpg|jpeg|webp|gif|svg)/i.test(clean) ||
    clean.startsWith('data:image/')
  ) {
    return clean;
  }

  // Normalize Unicode invisible characters, Chinese punctuation, quotes
  clean = clean
    .replace(/[\u2061\u200B\uFEFF\u00A0]/g, ' ')
    .replace(/\uFF1F/g, '?')
    .replace(/\uFF0C/g, ', ')
    .replace(/\uFF0E/g, '.')
    .replace(/\uFF08/g, '(')
    .replace(/\uFF09/g, ')')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/%/g, '\\%');

  // Normalize operators & signs
  clean = clean
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
    .replace(/\u2248/g, ' \\approx ');

  // Spaced parentheses: "( x - 5 )" -> "(x - 5)"
  clean = clean.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

  // Commas in coordinates: "0 , 11" -> "0, 11"
  clean = clean.replace(/\s*,\s*/g, ', ');

  // 1. Quadratic radical / plus-minus special OCR forms:
  // Pattern 1: "x = 3 4 \pm 15 4" or "x = - 3 4 \pm 33 4" -> "x = \frac{3}{4} \pm \frac{\sqrt{15}}{4}"
  clean = clean.replace(
    /([-+]?\s*\d+)\s+(\d+)\s*\\pm\s*(\d+)\s+(\d+)/g,
    (_, num1, den1, rad, den2) => {
      const n1 = num1.replace(/\s+/g, '');
      return `\\frac{${n1}}{${den1}} \\pm \\frac{\\sqrt{${rad}}}{${den2}}`;
    }
  );

  // Pattern 2: "x = 9 \pm 133 2" or "- 13 \pm 133 2" or "7 \pm k 2"
  clean = clean.replace(
    /([-+]?\s*[a-zA-Z0-9]+)\s*\\pm\s*([a-zA-Z0-9]+)\s+(\d+)/g,
    (_, lead, rad, den) => {
      const l = lead.replace(/\s+/g, '');
      return `\\frac{${l} \\pm \\sqrt{${rad}}}{${den}}`;
    }
  );

  // Pattern 3: "\pm 6d - 5c" -> "\pm \sqrt{6d - 5c}"
  clean = clean.replace(
    /\\pm\s+([0-9a-zA-Z]+(?:\s*[-+]\s*[0-9a-zA-Z]+)+)/g,
    (_, inner) => `\\pm \\sqrt{${inner.replace(/\s+/g, '')}}`
  );

  // 2. Single variable followed by 2-digit number (e.g. 'c 26' -> '\frac{c}{26}', 'h 31' -> '\frac{h}{31}')
  clean = clean.replace(/(?<!\d\s*)\b([a-zA-Z])\s+(\d{2,})\b/g, '\\frac{$1}{$2}');

  // 3. Coefficients: "5 x" -> "5x", "0.0018 x" -> "0.0018x", "60 x" -> "60x", "26 c" -> "26c"
  clean = clean.replace(/(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\b/g, '$1$2');

  // 4. Multi-variable names: "x y" -> "xy", "a b" -> "ab"
  clean = clean.replace(/\b([a-zA-Z])\s+([a-zA-Z])\b/g, '$1$2');

  // 5. Fractional OCR in choices / expressions:
  // Pattern A: 'c 9 ( 5 - 7 c )' -> '\frac{c}{9(5 - 7c)}'
  clean = clean.replace(/\b([a-zA-Z])\s+(\d+)\s*\(([^)]+)\)/g, (_, c, d, inner) => {
    return `\\frac{${c}}{${d}(${cleanMathExpr(inner)})}`;
  });
  // Pattern B: '9 ( 5 - 7 c ) c' -> '\frac{9(5 - 7c)}{c}'
  clean = clean.replace(/\b(\d+)\s*\(([^)]+)\)\s*([a-zA-Z])\b/g, (_, d, inner, c) => {
    return `\\frac{${d}(${cleanMathExpr(inner)})}{${c}}`;
  });
  // Pattern C: '9c 5 - 7c' -> '\frac{9c}{5 - 7c}' (where top has variable and bottom is linear expr)
  clean = clean.replace(/\b([a-zA-Z0-9]+)\s+(\d+\s*[-+]\s*[a-zA-Z0-9]+)\b/g, (m, top, bot) => {
    if (/^[-+/*=]/.test(top) || /[-+/*=]$/.test(top)) return m;
    return `\\frac{${top}}{${cleanMathExpr(bot)}}`;
  });
  // Pattern D: '5 - 7c 9c' -> '\frac{5 - 7c}{9c}' (where top is linear expr and bottom has variable)
  clean = clean.replace(/\b(\d+\s*[-+]\s*[a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\b/g, (m, top, bot) => {
    if (/^[-+/*=]/.test(bot) || /[-+/*=]$/.test(bot)) return m;
    return `\\frac{${cleanMathExpr(top)}}{${bot}}`;
  });
  // Pattern E: '10xy 10y - 9x + 1' -> '\frac{10xy}{10y - 9x + 1}'
  clean = clean.replace(/\b(\d+[a-zA-Z]+)\s+(\d+[a-zA-Z]\s*[-+]\s*\d+[a-zA-Z]\s*[-+]\s*\d+)\b/g, (m, top, bot) => {
    return `\\frac{${top}}{${cleanMathExpr(bot)}}`;
  });

  // 6. Parenthesized fraction or power with denominator: '( p + 25 ) 2 12' -> '\frac{(p + 25)^2}{12}'
  clean = clean.replace(/\(([^)]+)\)\s*([2-9])\s+(\d+)\b/g, '\\frac{($1)^{$2}}{$3}');

  // 7. Linear expression followed by denominator: "6d - 5c 2" -> "\frac{6d - 5c}{2}", 'p + 25 12' -> '\frac{p + 25}{12}'
  clean = clean.replace(
    /([0-9a-zA-Z]+(?:\s*[-+]\s*[0-9a-zA-Z]+)+)\s+(\d+)\b(?!\s*[-+/*=])/g,
    (_, num, den) => `\\frac{${cleanMathExpr(num)}}{${den}}`
  );

  // 8. Variable formulas with decimal denominator: 'A R 0.45' -> '\frac{AR}{0.45}'
  clean = clean.replace(/\b([A-Z]\s+[A-Z])\s+(\d+(?:\.\d+)?)\b/g, (_, vars, den) => {
    return `\\frac{${vars.replace(/\s+/g, '')}}{${den}}`;
  });

  // 9. Specific rational equation fix: '5 c - 9 d = 7'
  clean = clean.replace(/^5\s*c\s*-\s*9\s*d\s*=\s*7$/i, '\\frac{5}{c} - \\frac{9}{d} = 7');

  // 10. Powers: ONLY variable/parenthesis/bracket followed by number (never digits before the space!)
  clean = clean.replace(/([a-zA-Z\)\}\]])\s+([2-9])\b(?=[\s+\-=<>,.)]|$)/g, '$1^{$2}');

  // Negative signs: "- 12 x" -> "-12x", "- 3" -> "-3"
  clean = clean.replace(/-\s+(\d+)/g, '-$1');
  clean = clean.replace(/-\s+([a-zA-Z])/g, '-$1');

  // Parenthesized fraction with exponent: "( 1 7 ) x" -> "(\frac{1}{7})^x"
  clean = clean.replace(/\(\s*(\d+)\s+(\d+)\s*\)\s*([a-zA-Z0-9]+)/g, '(\\frac{$1}{$2})^{$3}');

  // Standalone fractions: "1 7" or "1 / 7" -> "\frac{1}{7}", "3 4" -> "\frac{3}{4}", "70 185" -> "\frac{70}{185}"
  clean = clean.replace(/(\b\d+)\s*\/\s*(\d+\b)/g, '\\frac{$1}{$2}');
  clean = clean.replace(/(?<=[(=\s])(\d+)\s+(\d+)(?=[)\s,]|$)/g, '\\frac{$1}{$2}');

  // Spaced thousands: "2 , 500" -> "2{,}500", "2,500" -> "2{,}500"
  clean = clean.replace(/(\d+)\s*,\s*(\d{3})\b/g, '$1{,}$2');

  // Function args: "g(x)", "f(x)"
  clean = clean.replace(/\b([fghpqrstCFGHW])\s*\(\s*([^)]+)\s*\)/g, (_, fn, arg) => `${fn}(${arg.replace(/\s+/g, '')})`);

  // Spacing around binary operators
  clean = clean.replace(/\s*([=+\-<>≤≥])\s*/g, ' $1 ');
  clean = clean.replace(/\s*\\le\s*/g, ' \\le ');
  clean = clean.replace(/\s*\\ge\s*/g, ' \\ge ');
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Backward compatibility alias for cleanMathExpr
 */
export function cleanMathEquation(eq: string): string {
  return cleanMathExpr(eq);
}

/**
 * Converts plain text math expressions in a passage/prompt into LaTeX wrapped in $...$ or $$...$$
 */
export function formatMathText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // 1. Replace Chinese fullwidth punctuation & normalize basic symbols
  text = text
    .replace(/\uFF1F/g, '?')
    .replace(/\uFF0C/g, ', ')
    .replace(/\uFF0E/g, '. ')
    .replace(/\uFF08/g, '(')
    .replace(/\uFF09/g, ')')
    .replace(/\uFF1A/g, ': ')
    .replace(/\uFF1B/g, '; ')
    .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // 2. Protect currency in prose chunks only: $60, $35, $840, $7.99
  text = transformProseChunks(text, p => {
    return p.replace(/\$\s*(\d[\d,]*(?:\.\d+)?)\b/g, (_, amt) => `__USD__${amt}`);
  });

  // 3. Geometry symbols & line segments
  text = transformProseChunks(text, p => {
    p = p.replace(/(?:△|\u25B3|\u25BD)\s*([A-Z]{2,4})/g, (_, name) => `$\\triangle ${name}$`);
    p = p.replace(/(?:∠|\u2220)\s*([A-Z0-9]+)/g, (_, name) => `$\\angle ${name}$`);
    p = p.replace(/(\d+(?:\.\d+)?)\s*(?:[∘°]|\u2218)\s*(F|C)?\b/g, (_, deg, unit) => {
      return unit ? `$${deg}^\\circ\\text{${unit}}$` : `$${deg}^\\circ$`;
    });
    p = p.replace(/([A-Z])\s+([A-Z])\s*[―—_¯]/g, (_, a, b) => `$\\overline{${a}${b}}$`);
    return p;
  });

  // 4. Reference words: xy-plane, x-axis, etc.
  text = transformProseChunks(text, p => {
    p = p.replace(/\b([xyz])\s+([xyz])\s*-\s*plane\b/gi, (_, a, b) => `$${a.toLowerCase()}${b.toLowerCase()}$-plane`);
    p = p.replace(/\b([xyz])\s*-\s*plane\b/gi, (_, a) => `$${a.toLowerCase()}$-plane`);
    p = p.replace(/\b([xyz])\s*-\s*axis\b/gi, (_, a) => `$${a.toLowerCase()}$-axis`);
    p = p.replace(/\b([xyz])\s*-\s*coordinate\b/gi, (_, a) => `$${a.toLowerCase()}$-coordinate`);
    p = p.replace(/\b([xyz])\s*-\s*intercept\b/gi, (_, a) => `$${a.toLowerCase()}$-intercept`);
    return p;
  });

  // 5. Square roots: √(x + 5) or √16
  text = transformProseChunks(text, p => {
    p = p.replace(/(?:√|\u221A)\s*\(\s*([^)]+)\s*\)/g, (_, inner) => `$\\sqrt{${cleanMathExpr(inner)}}$`);
    p = p.replace(/(?:√|\u221A)\s*([a-zA-Z0-9]+)/g, (_, inner) => `$\\sqrt{${inner}}$`);
    return p;
  });

  // 6. Handle leading system of 2 equations: e.g. "y = - 12 x + 16 y = - 20 x + 24 What is..."
  text = text.replace(
    /^([a-zA-Z0-9()\-+/*.,\s^\\{}]+?=[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)\s+([a-zA-Z0-9()\-+/*.,\s^\\{}]+?=[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s+(?:What|Which|In|If|Where|The|For|A|An|How)\b|[.!?]|$)/i,
    (match, eq1, eq2) => {
      const proseCheck = /\b(?:if|when|suppose|let|consider|the|function|defined|triangle|estimates|represents|equation|table|graph|each|total|where|point)\b/i;
      if (proseCheck.test(eq1) || proseCheck.test(eq2)) return match;
      return `$$\\begin{aligned} ${cleanMathExpr(eq1)} \\\\ ${cleanMathExpr(eq2)} \\end{aligned}$$\n\n`;
    }
  );

  // 7. Handle single leading equation: e.g. "60 x + 35 y = 840 Tom saved..." or "y = 30 x + 6 Which table..." or "g ( x ) = 11 ( 1 7 ) x If the given..."
  text = text.replace(
    /^([a-zA-Z0-9()\-+/*.,\s^\\{}]+?(?:=|<=|>=|<|>)[a-zA-Z0-9()\-+/*.,\s^\\{}]+?)(?=\s+(?:What|Which|In|If|Where|The|For|A|An|How|Tom|Sellers|Each|According)\b|[.!?]|$)/i,
    (match, eq) => {
      if (eq.includes('$$') || eq.includes('$')) return match;
      const proseCheck = /\b(?:if|when|suppose|let|consider|the|function|defined|triangle|estimates|represents|equation|table|graph|each|total|where|point|sample|estimate)\b/i;
      if (proseCheck.test(eq)) return match;
      const clean = cleanMathExpr(eq);
      if (clean.length >= 3 && /[=<>≤≥]/.test(clean)) {
        return `$$${clean}$$\n\n`;
      }
      return match;
    }
  );

  // 8. In-text function definitions: "g ( x ) = 5 x + 4" or "C ( x ) = 0.0018 x 2 - 0.238 x + 12.12"
  text = transformProseChunks(text, p => {
    return p.replace(/\b([fghpqrstCFGHW])\s*\(\s*([a-zA-Z0-9\s,\-+/*.]+)\s*\)\s*=\s*([a-zA-Z0-9()\-+/*,\s^\\{}.]+?)(?=\s*(?:[;!?]|\.(?!\d)|,(?!\d))|\s+(?:What|Which|If|Where|The|When|For|According|and)\b|$)/gi, (_, fn, arg, rhs) => {
      const cleanArg = arg.replace(/\s+/g, '');
      const cleanRhs = cleanMathExpr(rhs.trim());
      return `$${fn}(${cleanArg}) = ${cleanRhs}$`;
    });
  });

  // 9. In-text standalone equations: e.g. "If 3 x 2 - 11 = 27 2 - 11 , what" or "If x y = 3 and 4 x t y = 96 , what"
  text = transformProseChunks(text, p => {
    return p.replace(/\b(If|where|and)\s+([a-zA-Z0-9()\-+/*,\s^\\{}.]+?(?:=|<=|>=|<|>)[a-zA-Z0-9()\-+/*,\s^\\{}.]+?)(?=\s*(?:[;!?]|\.(?!\d)|,(?!\d))|\s+(?:what|which|then|and|where)\b|$)/gi, (m, kw, eq) => {
      const proseCheck = /\b(?:the|function|triangle|estimates|equation|graph)\b/i;
      if (proseCheck.test(eq)) return m;
      const clean = cleanMathExpr(eq);
      return `${kw} $${clean}$`;
    });
  });

  // 10. In-text function calls: "g ( 9 )", "f ( 0 )", "p ( x )"
  text = transformProseChunks(text, p => {
    return p.replace(/\b([fghpqrstCFGHW])\s*\(\s*([a-zA-Z0-9\s,\-+/*.]+)\s*\)/g, (_, fn, arg) => {
      const cleanArg = arg.replace(/\s+/g, '');
      return `$${fn}(${cleanArg})$`;
    });
  });

  // 11. Coordinates: "( 0 , 11 )", "( 60 , 4.32 )", "( v , − 7 )"
  text = transformProseChunks(text, p => {
    return p.replace(/\(\s*([-+]?\s*[a-zA-Z0-9.]+(?:\s+[a-zA-Z0-9.]+)?)\s*,\s*([-+]?\s*[a-zA-Z0-9.]+(?:\s+[a-zA-Z0-9.]+)?)\s*\)/g, (_, p1, p2) => {
      const c1 = cleanMathExpr(p1);
      const c2 = cleanMathExpr(p2);
      return `$(${c1}, ${c2})$`;
    });
  });

  // 12. Short standalone algebraic expressions like "what is the value of 3 x ?"
  text = transformProseChunks(text, p => {
    return p.replace(/\b(value of|length of|solutions? to|equation defines)\s+([0-9]+\s+[a-zA-Z]+|[a-zA-Z]\s+[2-9])(?=\s*[,;?!]|\s+is\b|\s+are\b|$)/gi, (_, phrase, term) => {
      const cleanTerm = cleanMathExpr(term);
      return `${phrase} $${cleanTerm}$`;
    });
  });

  // 13. Restore USD safely
  text = text.replace(/__USD__(\d[\d,]*(?:\.\d+)?)/g, (_, amt) => `$${amt}`);

  return text;
}

/**
 * Formats an answer choice string so that choices like "A. y = - 7 2 x - 2" or "A. 130 9" or "A. 25 135"
 * are rendered with proper LaTeX math, while keeping text and currency choices intact.
 */
export function formatMathChoice(choice: string): string {
  if (!choice) return '';
  let clean = choice.trim();

  // Strip prefix "A. ", "B. ", etc.
  const prefixMatch = clean.match(/^([A-Da-d][.)\s]\s*)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  clean = clean.replace(/^[A-Da-d][.)\s]\s*/, '').trim();

  if (!clean) return prefix.trim();

  if (
    clean.startsWith('http') ||
    clean.includes('/upload/image/') ||
    /\.(png|jpg|jpeg|webp|gif|svg)/i.test(clean) ||
    clean.startsWith('data:image/')
  ) {
    return `${prefix}${clean}`;
  }

  // Normalize minus & quotes
  clean = clean
    .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-')
    .replace(/[\u2061\u200B\uFEFF\u00A0]/g, ' ')
    .replace(/\uFF08/g, '(')
    .replace(/\uFF09/g, ')')
    .replace(/\uFF0E/g, '.')
    .replace(/[\u2018\u2019]/g, "'");

  if (clean.startsWith('$') && clean.endsWith('$')) {
    return `${prefix}${clean}`;
  }

  // Currency values: "$60", "$8.75", "$1,308.75"
  if (/^\$\s*[\d,]+(?:\.\d+)?$/.test(clean)) {
    return `${prefix}${clean.replace(/\s+/g, '')}`;
  }

  // Degrees: "35 ∘" or "35°"
  if (/^[-+]?\s*\d+(?:\.\d+)?\s*(?:[∘°]|\u2218)$/.test(clean)) {
    const deg = clean.replace(/\s*(?:[∘°]|\u2218)/, '');
    return `${prefix}$${deg}^\\circ$`;
  }

  // Negative fraction: "- 48 11" or "- 3/4"
  if (/^-\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)$/.test(clean)) {
    const m = clean.match(/^-\s*(\d+)\s+(?:[\/ ]\s*)?(\d+)$/);
    if (m) {
      return `${prefix}$-\\frac{${m[1]}}{${m[2]}}$`;
    }
  }

  // Positive fraction: "70 185" or "1 8" or "4/3"
  if (/^(\d+)\s+(\d+)$/.test(clean)) {
    const parts = clean.split(/\s+/);
    return `${prefix}$\\frac{${parts[0]}}{${parts[1]}}$`;
  }
  if (/^(\d+)\/(\d+)$/.test(clean)) {
    const parts = clean.split('/');
    return `${prefix}$\\frac{${parts[0]}}{${parts[1]}}$`;
  }

  // Coordinates: "( 0 , 11 )" or "( 4 , 3 )"
  if (/^\(\s*[-+]?\s*[a-zA-Z0-9.]+(?:\s+[a-zA-Z0-9.]+)?\s*,\s*[-+]?\s*[a-zA-Z0-9.]+(?:\s+[a-zA-Z0-9.]+)?\s*\)$/.test(clean)) {
    const m = clean.match(/^\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/);
    if (m) {
      return `${prefix}$(${cleanMathExpr(m[1])}, ${cleanMathExpr(m[2])})$`;
    }
  }

  // Pure numbers: "60", "24", "-3", "1,080", "213.75"
  if (/^[-+]?\s*[\d,]+(?:\.\d+)?$/.test(clean)) {
    return `${prefix}${clean}`;
  }

  // English phrases & words: if it contains words with mostly english letters and no math operators
  if (
    /^[a-zA-Z\s,.'’\-–—]+$/.test(clean) &&
    !/[=<>≤≥\\/^_]/.test(clean) &&
    !/\b[xyzabc]\b/i.test(clean)
  ) {
    return `${prefix}${clean}`;
  }

  // English sentence choices (e.g. starts with The, There, Both, Increases, etc.)
  if (/^(The|There|Both|Neither|Increases|Decreases|Each|If|When|By|For|At|In|Every|No solution|Infinitely)\b/i.test(clean)) {
    return `${prefix}${clean}`;
  }

  // Two equations/inequalities in a choice (e.g. "c + h = 19 c 26 + h 31 = 570")
  const relationCount = (clean.match(/(=|<=|>=|<|>|\\le|\\ge)/g) || []).length;
  if (relationCount === 2) {
    const eqParts = clean.match(/^(.+?(?:=|<=|>=|<|>|\\le|\\ge)\s*\S+)\s+(.+)$/);
    if (eqParts) {
      const eq1 = cleanMathExpr(eqParts[1]);
      const eq2 = cleanMathExpr(eqParts[2]);
      return `${prefix}$\\begin{cases} ${eq1} \\\\ ${eq2} \\end{cases}$`;
    }
  }

  const formattedExpr = cleanMathExpr(clean);
  return `${prefix}$${formattedExpr}$`;
}

