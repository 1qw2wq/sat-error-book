/**
 * Normalizes mathematical Unicode characters (such as mathematical italic letters,
 * minus signs, operators) to standard characters for reliable KaTeX/HTML rendering.
 */
export function normalizeMathUnicode(text: string): string {
  if (!text) return '';
  let s = text;

  // Mathematical Italic Small & Capital letters (e.g. 𝑥, 𝑦, 𝑘, ℎ, 𝑎, 𝑏)
  s = s.replace(/[\u{1D434}-\u{1D44D}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D434 + 65));
  s = s.replace(/[\u{1D44E}-\u{1D467}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D44E + 97));
  s = s.replace(/[\u{1D468}-\u{1D481}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D468 + 65));
  s = s.replace(/[\u{1D482}-\u{1D49B}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D482 + 97));
  s = s.replace(/[\u{1D5D4}-\u{1D5ED}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D5D4 + 65));
  s = s.replace(/[\u{1D5EE}-\u{1D607}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D5EE + 97));
  s = s.replace(/[\u{1D7CE}-\u{1D7D7}]/gu, (c) => String.fromCharCode(c.codePointAt(0)! - 0x1D7CE + 48));

  // Common special math unicode symbols
  s = s.replace(/ℎ/g, 'h')
       .replace(/ℯ/g, 'e')
       .replace(/ℊ/g, 'g')
       .replace(/ℴ/g, 'o')
       .replace(/𝜋/g, '\\pi ')
       .replace(/−/g, '-')
       .replace(/[–—]/g, '-')
       .replace(/×/g, '\\times ')
       .replace(/÷/g, '\\div ')
       .replace(/≤/g, '\\le ')
       .replace(/≥/g, '\\ge ')
       .replace(/≠/g, '\\ne ')
       .replace(/±/g, '\\pm ');

  return s;
}

/**
 * Detects and reconstructs flattened SAT tables (2D contingency tables, frequency tables, x/y tables)
 * into clean standard Markdown tables.
 */
export function reconstructTablesFromText(text: string): string {
  if (!text) return '';

  // If text already contains pipe tables, ensure formatting is clean
  if (text.includes('|') && /\|[^\n]+\|/.test(text)) {
    return text;
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return text;

  const isNumericValue = (s: string) => {
    const clean = s.replace(/[\$,%]/g, '').trim();
    return /^[\-+]?\d+(?:\.\d+)?$/.test(clean) || /^\d+\/\d+$/.test(clean);
  };

  const isRowLabel = (s: string) => {
    if (!s) return false;
    if (s.length > 50) return false;
    if (s.endsWith('?')) return false;
    if (/^(The|Which|What|How|If|For|In|Adapted|Excerpt)\s+/i.test(s)) return false;
    return true;
  };

  const isRowValue = (s: string) => {
    if (!s) return false;
    if (isNumericValue(s)) return true;
    if (s.length <= 30 && !s.endsWith('?') && !s.endsWith('.')) return true;
    return false;
  };

  // 1. Detect flattened 2D contingency tables (Row Label + N numbers per row)
  for (let i = 0; i < lines.length; i++) {
    const rows: { label: string; values: string[] }[] = [];
    let currIdx = i;

    while (currIdx < lines.length) {
      const label = lines[currIdx];
      if (!isRowLabel(label) || isNumericValue(label)) {
        break;
      }

      let valIdx = currIdx + 1;
      const vals: string[] = [];
      while (valIdx < lines.length && isNumericValue(lines[valIdx])) {
        vals.push(lines[valIdx]);
        valIdx++;
      }

      if (vals.length >= 2) {
        if (rows.length === 0 || rows[0].values.length === vals.length) {
          rows.push({ label, values: vals });
          currIdx = valIdx;
          continue;
        }
      }
      break;
    }

    if (rows.length >= 2) {
      const numCols = rows[0].values.length;
      const colHeaders: string[] = [];
      let headerStartIdx = i - 1;

      while (headerStartIdx >= 0 && colHeaders.length < numCols) {
        const h = lines[headerStartIdx];
        if (h.endsWith('?') || (h.split(' ').length > 12 && h.endsWith('.'))) break;
        colHeaders.unshift(h);
        headerStartIdx--;
      }

      if (colHeaders.length === numCols) {
        let rowHeaderTitle = 'Category';
        let superHeader = '';

        if (headerStartIdx >= 0 && !lines[headerStartIdx].endsWith('.') && !lines[headerStartIdx].endsWith('?')) {
          const possibleTitle = lines[headerStartIdx];
          headerStartIdx--;
          if (headerStartIdx >= 0 && !lines[headerStartIdx].endsWith('.') && !lines[headerStartIdx].endsWith('?')) {
            rowHeaderTitle = lines[headerStartIdx];
            superHeader = possibleTitle;
          } else {
            rowHeaderTitle = possibleTitle;
          }
        }

        let mdTable = '\n\n';
        if (superHeader) {
          mdTable += `**${superHeader}**\n\n`;
        }
        mdTable += `| ${rowHeaderTitle} | ${colHeaders.join(' | ')} |\n`;
        mdTable += `| :--- | ${colHeaders.map(() => ':---').join(' | ')} |\n`;
        for (const row of rows) {
          mdTable += `| ${row.label} | ${row.values.join(' | ')} |\n`;
        }
        mdTable += '\n\n';

        const beforeText = lines.slice(0, headerStartIdx + 1).join('\n\n');
        const afterText = lines.slice(currIdx).join('\n\n');

        return (beforeText ? beforeText + '\n\n' : '') + mdTable.trim() + (afterText ? '\n\n' + afterText : '');
      }
    }
  }

  // 2. Detect 2-column key-value / x-y / Frequency tables
  for (let i = 0; i < lines.length - 3; i++) {
    const h1 = lines[i];
    const h2 = lines[i + 1];
    if (
      isRowLabel(h1) &&
      isRowLabel(h2) &&
      !isNumericValue(h1) &&
      !isNumericValue(h2)
    ) {
      let valIdx = i + 2;
      const pairs: [string, string][] = [];
      while (
        valIdx + 1 < lines.length &&
        isRowLabel(lines[valIdx]) &&
        isRowValue(lines[valIdx + 1])
      ) {
        pairs.push([lines[valIdx], lines[valIdx + 1]]);
        valIdx += 2;
      }
      if (pairs.length >= 2) {
        let mdTable = `\n\n| ${h1} | ${h2} |\n| :--- | :--- |\n`;
        for (const [x, y] of pairs) {
          mdTable += `| ${x} | ${y} |\n`;
        }
        mdTable += '\n\n';

        const beforeText = lines.slice(0, i).join('\n\n');
        const afterText = lines.slice(valIdx).join('\n\n');
        return (beforeText ? beforeText + '\n\n' : '') + mdTable.trim() + (afterText ? '\n\n' + afterText : '');
      }
    }
  }

  return text;
}

/**
 * Valid LaTeX command whitelist pattern
 */
const VALID_LATEX_COMMANDS = /\\(?:frac|sqrt|left|right|begin|end|alpha|beta|gamma|delta|theta|pi|sigma|lambda|mu|phi|Delta|Omega|text|textbf|textit|underline|boxed|le|ge|ne|neq|equiv|pm|mp|times|div|cdot|circ|angle|triangle|parallel|perp|cong|sim|approx|to|Rightarrow|Leftrightarrow|infty|sum|int|lim|sin|cos|tan|log|ln|sec|csc|cot|matrix|aligned|cases|gathered|array|overline|underset|[\$\%_\#\&\{\}])/;

/**
 * Sanitizes and normalizes SAT text from OCR/scraped databases.
 */
export function sanitizeSatText(text: string): string {
  if (!text) return '';
  let s = text.replace(/[\u200B\uFEFF]/g, '').replace(/[\u00A0\u202F\u2007]/g, ' ');

  // Normalize mathematical unicode (𝑥 -> x, − -> -, etc.)
  s = normalizeMathUnicode(s);

  // 1. Decode HTML XML entities
  s = s.replace(/&(?:#36|#x24|dollar);/gi, '$');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&(?:#39|apos);/g, "'");

  // Remove leading question numbering like "1. Text 1" -> "Text 1"
  s = s.replace(/^\d+[\.\s\-]+\s*(?=(?:Text\s*[12AB]|Passage\s*[12AB]|The following|Adapted|In the|Excerpt))/i, '');

  // 2. Strip XML/Word processing junk tags
  s = s.replace(/<\?xml[^>]*\?>/gi, '');
  s = s.replace(/<!DOCTYPE[^>]*>/gi, '');
  s = s.replace(/<w:[^>]+>[\s\S]*?<\/w:[^>]+>/gi, '');
  s = s.replace(/<\/?(?:w|m|o|v):[^>]*>/gi, '');
  s = s.replace(/<mml:([a-zA-Z]+)[^>]*>/gi, '<$1>');
  s = s.replace(/<\/mml:([a-zA-Z]+)>/gi, '</$1>');

  // 3. Clean broken corrupted tags like </</ or <</ or </u</u
  s = s.replace(/<\/\s*<\s*\/?/g, '</');
  s = s.replace(/<+\s*<+\s*\/?/g, '<');
  s = s.replace(/<\/u\s*<\/u>/gi, '</u>');
  s = s.replace(/<u\s*<u\s*>/gi, '<u>');

  // Prevent Text 1 / Text 2 headers from being enclosed inside <u>
  s = s.replace(/(?:^|\n)\s*<u>\s*(Text\s*[12AB]|Passage\s*[12AB])\s*<\/u>/gi, '$1');
  s = s.replace(/(?:^|\n)\s*<u>\s*(Text\s*[12AB]|Passage\s*[12AB])\b/gi, '$1 <u>');

  // 4. Remove stray OCR dollar signs embedded in English words (e.g. "Which$ choice" -> "Which choice")
  s = s.replace(/\b([A-Za-z]+)\$([A-Za-z]*)\b/g, '$1 $2').replace(/[ \t]+/g, ' ');

  // 5. Remove stray backslashes before numbers, spaces, or OCR typos
  s = s.replace(/\\+\s+(?=[0-9A-Za-z<>=])/g, '');
  s = s.replace(/\\+(?=[0-9])/g, '');
  s = s.replace(/\\+(?=\s*[,.\?!:;])/g, '');

  // 6. Remove isolated backslashes that are not part of valid LaTeX commands
  s = s.replace(/\\(?![a-zA-Z\$\%_\#\&\{\}])/g, '');

  // 7. Fix OCR punctuation spacing
  s = s.replace(/[ \t]+([,\.\;\:\?\!])/g, '$1');
  s = s.replace(/,([A-Za-z0-9])/g, ', $1');

  // Fix missing space after sentence-ending punctuation
  s = s.replace(/(?<!\b(?:e\.g|i\.e|U\.S|A\.M|P\.M|Dr|Mr|Mrs|Ms|vs|St|Vol|No|Fig|approx)\.)([.!?]["”’']?)(?=[A-Za-z"“‘])/g, '$1 ');

  // 8. Safely normalize underline and ins tags
  s = s.replace(/<[\s\r\n\\]*\/\s*(?:u|ins)[\s\r\n\\]*>/gi, '</u>');
  s = s.replace(/<[\s\r\n\\]*(?:u|ins)\b[^>]*>/gi, '<u>');
  s = s.replace(/<[\/\\]+u\b[^>]*>/gi, '</u>');

  // Clean empty and duplicate tags
  s = s.replace(/<u>\s*<\/u>/gi, '');
  s = s.replace(/(?:<u>\s*)+<u>/gi, '<u>');
  s = s.replace(/(?:<\/u>\s*)+<\/u>/gi, '</u>');

  // Ensure whitespace around underline tags
  s = s.replace(/([^ \n\t"“'‘(\[{])<u\b([^>]*)>/gi, '$1 <u$2>');
  s = s.replace(/<\/u\s*>([A-Za-z0-9"“'‘(\[{])/gi, '</u> $1');

  // 9. Reconstruct tables
  s = reconstructTablesFromText(s);

  // 10. Balance unclosed or stray tags
  const openCount = (s.match(/<u\b[^>]*>/gi) || []).length;
  const closeCount = (s.match(/<\/u>/gi) || []).length;
  if (openCount > closeCount) {
    s = s + '</u>';
  }

  // Final cleanup of any lingering broken tags
  s = s.replace(/<\/\s*<\s*\/?/g, '</');
  s = s.replace(/<+\s*<+\s*\/?/g, '<');

  return s.trim();
}

export function normalizeUnderlineTags(text: string): string {
  return sanitizeSatText(text);
}

export function cleanMathExpr(expr: string): string {
  if (!expr) return '';
  return normalizeMathUnicode(expr).replace(/[\u200B\uFEFF]/g, '').trim();
}

export function cleanMathEquation(eq: string): string {
  return cleanMathExpr(eq);
}

export function splitEquationsInBlock(text: string): string {
  if (!text) return text;
  if (text.includes('\\begin') || text.includes('\\text') || text.includes('\\frac') || text.includes('\\sqrt') || text.includes('\\matrix')) {
    return `$${text}$`;
  }

  let s = text
    .replace(/>=/g, '\\ge ')
    .replace(/<=/g, '\\le ')
    .replace(/!=/g, '\\neq ')
    .replace(/\+-/g, '\\pm ');

  s = s
    .replace(/(\d|[\)\}\]>=]|\\\$)\s*\b(and|or|where|when|for|if)\b/gi, '$1 $2')
    .replace(/\b(and|or|where|when|for|if)\b\s*(\d|[\(\{\[]|=)/gi, '$1 $2');

  if (/\b(?:and|or|where|when|for|if)\b/i.test(s)) {
    const parts = s.split(/\b(and|or|where|when|for|if)\b/i);
    return parts.map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/\b(?:and|or|where|when|for|if)\b/i.test(trimmed)) return ` ${trimmed} `;
      return splitEquationsInBlock(trimmed);
    }).join('');
  }

  return `$${s}$`;
}

/**
 * Formats math text safely and correctly preserves currency numbers ($44, $4, $560).
 */
export function formatMathText(rawText: string): string {
  if (!rawText) return '';
  let s = sanitizeSatText(rawText);

  if (s.includes('\\n') && !s.includes('\n')) {
    s = s.replace(/\\n/g, '\n');
  }

  // Reconstruct flattened table structures into markdown tables
  s = reconstructTablesFromText(s);

  // 1. Protect currency dollar amounts with exact captured values
  s = s.replace(/(?<!\\)\$(\d+(?:,\d{3})*(?:\.\d{1,2})?)\b/g, (_, amt) => `\\$${amt}`);

  // 2. Spacing around HTML underline tags
  s = s.replace(/<\/u>([A-Za-z0-9])/g, '</u> $1');
  s = s.replace(/([A-Za-z0-9])<u>/g, '$1 <u>');

  // 3. Paired passage headers (Text 1, Text 2, Passage 1, Passage 2)
  s = s.replace(/(?:^|\n\n|\n)\s*(?:<u>\s*)?(Text\s*[12AB]|Passage\s*[12AB])(?:\s*<\/u>)?(?:\s*[:\-–]?\s*)([A-Za-z0-9"“'‘<])/g, (_, title, nextChar) => {
    return `\n\n**${title.trim()}**\n\n${nextChar}`;
  });
  s = s.trim();

  // If <u> sits right before **Text 1**, move <u> after **Text 1**
  s = s.replace(/<u>\s*(\*\*(?:Text\s*[12AB]|Passage\s*[12AB])\*\*)\s*/gi, '$1\n\n<u>');

  // 4. Separate SAT introductory lead-in sentences
  s = s.replace(
    /(^|\n\n|\n)((?:The following (?:text|passage)|This (?:text|passage)|Excerpt|Adapted from|In the following (?:text|passage))\s+(?:is|was|has been|from|adapted|excerpted|taken)[^\n]+?[\.\?!]["”']?)\s*(?=[A-Z"“])/gi,
    '$1$2\n\n'
  );

  // 5. Separate copyright notes
  s = s.replace(/([^\n])\s*((?:[©\u00A9]|\([cC]\)|Copyright\b)[^\n]*)/gi, '$1\n\n$2');

  // 6. Bullet points for student notes
  s = s.replace(/((?:following\s+)?notes\s*[:：])\s*/gi, '$1\n\n');
  s = s.replace(/(?:^|\n)\s*[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*/g, '\n* ');
  s = s.replace(/([^\n])\s+[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*/g, '$1\n* ');

  // 7. Unwrap entire OCR question prompts mistakenly wrapped in single outer $ ... $
  s = s.replace(/^\s*\$([^\$]+?\b(?:What is|Which of the following|Find the value|What value|Calculate|Solve for|How many)\b[^\$]+)\$\s*$/i, (match, inner) => {
    if (inner.includes('\\begin') || inner.includes('\\text')) return match;
    return inner.trim();
  });

  // 8. Format & isolate GFM markdown tables with double newlines around table block and single newlines inside
  if (s.includes('|')) {
    // A. Remove multiple blank lines between consecutive table rows
    s = s.replace(/(\|[^\n]*\|)(?:\s*\n\s*)+(\|[^\n]*\|)/g, (match) => {
      let res = match;
      while (/(\|[^\n]*\|)\s*\n\s*(\|[^\n]*\|)/.test(res)) {
        res = res.replace(/(\|[^\n]*\|)\s*\n\s*(\|[^\n]*\|)/g, '$1\n$2');
      }
      return res;
    });

    // B. Ensure alignment separator row exists after the first header row if missing
    s = s.replace(/(\|[^\n]+\|)\n(\|[^\n]+\|)/g, (match, r1, r2) => {
      const cleanR2 = r2.replace(/[^|\-:]/g, '');
      if (/^\|[\s:\-]+\|$/.test(cleanR2)) {
        return match;
      }
      const r1Cells = r1.slice(1, -1).split('|').length;
      const separator = '| ' + Array(r1Cells).fill(':---').join(' | ') + ' |';
      return `${r1}\n${separator}\n${r2}`;
    });

    // C. Isolate table block from prose text before and after with double newlines
    s = s.replace(/([^\n|])\n*(\|[^\n]+\|)/g, '$1\n\n$2');
    s = s.replace(/(\|[^\n]+\|)\n*([^\n|])/g, '$1\n\n$2');
  }

  // 9. Fix OCR stripped inequality choices & prompts
  s = s.replace(/\bg\(x\)\s*f\(x\)\b/g, '$g(x) \\lt f(x)$');
  s = s.replace(/^x\s+h$/i, '$x \\lt h$');
  s = s.replace(/^h\s+x\s+k$/i, '$h \\lt x \\lt k$');
  s = s.replace(/\bx\s*>\s*k\s*or\s*x\s*<\s*h\b/gi, '$x \\gt k \\text{ or } x \\lt h$');
  s = s.replace(/\bx\s*<\s*h\s*or\s*x\s*>\s*k\b/gi, '$x \\lt h \\text{ or } x \\gt k$');

  // Fix missing inequality symbols in OCR/scraped math prompts
  s = s.replace(/\bwhere\s+10\s*n\s*50\b/gi, 'where $10 \\le n \\le 50$');
  s = s.replace(/\b10\s*n\s*50\b/gi, '$10 \\le n \\le 50$');

  // 10. Format standalone inequalities like "x > k", "x < h", "h < x < k" into math if not already wrapped
  s = s.replace(/^([A-Za-z0-9_]+)\s*([<>]=?|\\(?:le|ge|ne|neq))\s*([A-Za-z0-9_]+)$/g, (_, v1, op, v2) => {
    let cleanOp = op === '<' ? '\\lt ' : op === '>' ? '\\gt ' : op;
    return `$${v1} ${cleanOp} ${v2}$`;
  });
  s = s.replace(/^([A-Za-z0-9_]+)\s*([<>]=?|\\(?:le|ge))\s*([A-Za-z0-9_]+)\s*([<>]=?|\\(?:le|ge))\s*([A-Za-z0-9_]+)$/g, (_, v1, op1, v2, op2, v3) => {
    let cleanOp1 = op1 === '<' ? '\\lt ' : op1 === '>' ? '\\gt ' : op1;
    let cleanOp2 = op2 === '<' ? '\\lt ' : op2 === '>' ? '\\gt ' : op2;
    return `$${v1} ${cleanOp1} ${v2} ${cleanOp2} ${v3}$`;
  });

  // 11. Protect KaTeX math blocks ($...$) by replacing raw < and > with \\lt and \\gt to prevent rehypeRaw HTML tag stripping
  s = s.replace(/\$([^\$]+)\$/g, (_, inner) => {
    const cleanInner = inner.replace(/</g, '\\lt ').replace(/>/g, '\\gt ');
    return `$${cleanInner}$`;
  });

  // Auto-wrap LaTeX relational expressions outside $ ... $ into inline math
  s = s.replace(/(?<!\$)(?<!\$\S)\b(?:[a-zA-Z0-9\(\)]+\s*)?\\(?:le|ge|ne|neq)\s*(?:[a-zA-Z0-9\(\)]+)(?!\$)/g, (m) => `$${m.trim()}$`);

  return s;
}

export function formatMathChoice(choice: string): string {
  if (!choice) return '';
  let clean = choice.trim();
  clean = clean.replace(/^[A-Da-d][.)\s]\s*/, '').trim();
  clean = sanitizeSatText(clean);
  return formatMathText(clean);
}