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

  // 1. Protect standalone currency amounts (e.g. $50, $1,200, $3.99) so they don't pair into math delimiters
  // We temporarily escape them as \$ so regex matching for $...$ ignores them
  s = s.replace(/(?<!\\)\$(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?!\$)/g, '\\$$1');

  // 2. Fix period-without-space between sentence end and capital letter (e.g. "Erdoes.At the center" -> "Erdoes. At the center", "Bee.”An" -> "Bee.” An")
  // Exclude common abbreviations like e.g., i.e., U.S., A.M., P.M., Dr., Mr., etc.
  s = s.replace(/(?<!\b(?:e\.g|i\.e|U\.S|A\.M|P\.M|Dr|Mr|Mrs|Ms|vs|St|Vol|No|Fig|approx))\b([a-z0-9"'\)]+)\.([A-Z])/g, '$1. $2');
  s = s.replace(/([\.\!\?]["”'])([A-Z])/g, '$1 $2');

  // 3. Spacing around HTML underline / formatting tags (e.g. "</u>Without" -> "</u> Without")
  s = s.replace(/<\/u>([A-Za-z0-9])/g, '</u> $1');
  s = s.replace(/([A-Za-z0-9])<u>/g, '$1 <u>');

  // 4. Paired Texts (Text 1 / Text 2, Passage 1 / Passage 2) separation and formatting
  // ONLY match when it is genuinely a passage header, NOT inside prompts (e.g. "author of Text 2 most likely")
  // Text 1 at the very start of text:
  s = s.replace(/^(?:\s*|\n*)(Text\s*1|Passage\s*1|Text\s*A|Passage\s*A)(?:\s*[:\-–]?\s*)([A-Z"“])/g, (match, title, nextChar) => {
    const cleanTitle = title.replace(/\s+/g, ' ').trim();
    return `**${cleanTitle}**\n\n${nextChar}`;
  });

  // Text 2 following end of Text 1 sentence (period / exclamation / question / </u>), never preceded by prepositions (of, in, to, for, etc.)
  s = s.replace(/(?<!\b(?:of|in|to|from|between|both|and|about|with|for|than|author|claim|view|response|mention|mentions|states|discusses|passage|text|read|see|into)\s+)(?:[\.\!\?]["”']?\s*|<\/u>\s*)(Text\s*2|Passage\s*2|Text\s*B|Passage\s*B)(?:\s*[:\-–]?\s*)([A-Z"“])/g, (match, title, nextChar) => {
    const cleanTitle = title.replace(/\s+/g, ' ').trim();
    return `.\n\n**${cleanTitle}**\n\n${nextChar}`;
  });

  // Standalone lines with only Text 1 / Text 2 / Passage 1 / Passage 2
  s = s.replace(/(?:^|\n)\s*(Text\s*[12AB]|Passage\s*[12AB])(?:\s*[:\-–]?\s*)(?:\n+|$)/g, (match, title) => {
    const cleanTitle = title.replace(/\s+/g, ' ').trim();
    return `\n\n**${cleanTitle}**\n\n`;
  });

  // 5. Separate SAT introductory lead-in sentences into their own paragraph (\n\n)
  // Handles:
  // - "The following text is adapted from Richard Connell’s 1923 short story “The Man Who Could Imitate a Bee.”An ornithologist"
  // - "The following text is from Mary Crow Dog's 1990 autobiography... At the center"
  // - "This passage is excerpted from Jane Austen's 1813 novel Pride and Prejudice. It is a truth..."
  s = s.replace(
    /(^|\n\n|\n)((?:The following (?:text|passage)|This (?:text|passage)|Excerpt|Adapted from|In the following (?:text|passage))\s+(?:is|was|has been|from|adapted|excerpted|taken)[^\n]+?[\.\?!]["”']?)\s*(?=[A-Z"“])/gi,
    '$1$2\n\n'
  );

  // 6. Separate copyright / source attributions at the end of passages into their own paragraph (\n\n)
  s = s.replace(/([^\n])\s*([©\u00A9]|\([cC]\)|Copyright\b)/gi, '$1\n\n$2');
  s = s.replace(/([^\n])\s*(\b\d{4}\s+by\s+[A-Z])/g, '$1\n\n$2');

  // 7. Auto line breaks before option choices (A), (B), (C), (D) or A), B), C), D) or A., B., C., D. in prose explanations
  s = s.replace(/(?<=\S)\s*(\([A-Da-d]\)|(?<![a-zA-Z0-9])[A-Da-d][\.\)]|选项[A-Da-d])\s*/g, '\n$1 ');

  // 8. Auto line break before conclusions "所以选", "故选", "因此选"
  s = s.replace(/([^\n])\s*(所以选|故选|因此选)\s*/g, '$1\n$2 ');

  // 9. Format student research notes and bullet points (•, ·, \u00B7, ▪, etc.) into clean Markdown list items
  // Format "following notes:·" -> "following notes:\n\n* "
  s = s.replace(/((?:following\s+)?notes\s*[:：])\s*(?:\n\s*)?(?:[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*)?/gi, '$1\n\n* ');
  // Format any bullet point character preceded by sentence end or non-digit into "\n\n* "
  s = s.replace(/([^\n\d])\s*[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*([A-Za-z0-9"“])/g, '$1\n\n* $2');
  // Format leading bullet symbol at line start (NEVER include asterisk *)
  s = s.replace(/(?:^|\n)\s*[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*/g, '\n\n* ');

  // 8. Fix trailing commas/periods trapped inside math blocks (e.g. "$x = 4,$" -> "$x = 4$,")
  s = s.replace(/\$([^\$\n]+?)([\,\.\;\:])\$/g, '$$$1$$$2');

  // 9. Unwrap question prompts trapped inside math blocks
  // e.g. "$g(4)=b. What is the value of a+b?$" -> "$g(4)=b$. What is the value of $a+b$?"
  s = s.replace(/\$([^\$\n]+?\b(?:What is|Which of the following|Find the value|What value|Calculate|Solve for)\b[^\$\n]*)\$/gi, (match, inner) => {
    return inner.replace(/\b(What is|Which of the following|Find the value|What value|Calculate|Solve for)\b/gi, '$$ $1');
  });

  // 10. Clean and split math dollar blocks trapped around English connector words
  // (e.g. "$g(a) = 18and g(4)=b$" -> "$g(a) = 18$ and $g(4)=b$")
  s = s.replace(/\$([^\$\n]+?)\$/g, (match, inner) => {
    // If it's already complex LaTeX or environment, leave as is
    if (inner.includes('\\begin') || inner.includes('\\text') || inner.includes('\\frac') || inner.includes('\\sqrt')) {
      return match;
    }

    // Convert raw inequality symbols inside math expressions
    let cleanInner = inner
      .replace(/>=/g, '\\ge ')
      .replace(/<=/g, '\\le ')
      .replace(/!=/g, '\\neq ')
      .replace(/\+-/g, '\\pm ');

    // Only split on true math connectors: and, or, where, when, for, if
    const connectorRegex = /\b(and|or|where|when|for|if)\b/i;
    if (connectorRegex.test(cleanInner)) {
      // Normalize attached connector words like "18and" -> "18 and", "andg(4)" -> "and g(4)"
      let cleaned = cleanInner
        .replace(/(\d|[a-zA-Z\)\}\]>=])\s*(and|or|where|when|for|if)\b/gi, '$1 $2')
        .replace(/\b(and|or|where|when|for|if)\s*(\d|[a-zA-Z\(\{\[]|=|(?=\$))/gi, '$1 $2');

      const parts = cleaned.split(/\b(and|or|where|when|for|if)\b/i);
      const rebuilt: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        let p = parts[i].trim();
        if (!p) continue;
        if (/\b(and|or|where|when|for|if)\b/i.test(p) && p.split(/\s+/).length === 1) {
          rebuilt.push(` ${p} `);
        } else {
          // If p contains a period followed by English text (e.g. "b. What is the value of a + b?")
          if (/\.\s+[A-Z]/.test(p)) {
            const [mathPart, ...proseParts] = p.split(/\.\s+(?=[A-Z])/);
            const prose = proseParts.join('. ');
            if (mathPart) rebuilt.push(`$${mathPart.replace(/^\$+|\$+$/g, '').trim()}$. `);
            // In prose, wrap simple math expressions like "a + b" in math delimiters
            const formattedProse = prose.replace(/\b([a-zA-Z]\s*[\+\-\*\/]\s*[a-zA-Z0-9]+)\b/g, '$$$1$$');
            rebuilt.push(formattedProse);
          } else if (/^[a-zA-Z\s,]+$/.test(p) && p.split(/\s+/).length > 2 && !/[0-9=\+\-\*\/\^\\<>]/.test(p)) {
            // If p is purely English prose without math operators/symbols, don't wrap in dollar signs
            rebuilt.push(` ${p} `);
          } else {
            const cleanP = p.replace(/^\$+|\$+$/g, '').trim();
            if (cleanP) {
              rebuilt.push(`$${cleanP}$`);
            }
          }
        }
      }
      return rebuilt.join('');
    }

    return `$${cleanInner}$`;
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
