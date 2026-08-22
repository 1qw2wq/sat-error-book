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

  const clean = normalizeMathUnicode(text);
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return text;

  const isPureNumber = (s: string) => {
    if (!s) return false;
    const cleanStr = s.replace(/[\$,%\u00A0\s]/g, '').replace(/,/g, '').trim();
    return /^[\-+]?\d+(?:\.\d+)?$/.test(cleanStr) || /^\d+\/\d+$/.test(cleanStr);
  };

  const isNumericOrMathValue = (s: string) => {
    if (!s) return false;
    const cleanStr = s.replace(/[\$,%\u00A0\s]/g, '').replace(/,/g, '').trim();
    if (/^[\-+]?\d+(?:\.\d+)?$/.test(cleanStr) || /^\d+\/\d+$/.test(cleanStr)) return true;
    if (/^[a-zA-Z]$/.test(cleanStr)) return true; // single variable like a, b, k, n, x, y
    if (/^[\-+]?\d*[a-zA-Z](?:[\+\-]\d+)?$/.test(cleanStr)) return true; // e.g. 2x, -3k
    if (/^[\-+]?\d+(?:\.\d+)?%?$/.test(cleanStr)) return true;
    return false;
  };

  const isRowLabel = (s: string) => {
    if (!s) return false;
    if (s.length > 60) return false;
    if (s.endsWith('?')) return false;
    if (/^(The|Which|What|How|If|For|In|Adapted|Excerpt|According to)\s+/i.test(s)) return false;
    return true;
  };

  const isRowValue = (s: string) => {
    if (!s) return false;
    if (isNumericOrMathValue(s)) return true;
    if (s.length <= 30 && !s.endsWith('?') && !s.endsWith('.')) return true;
    return false;
  };

  // 1. Detect flattened 2D contingency tables (Row Label + N numbers/values per row)
  for (let i = 0; i < lines.length; i++) {
    const rows: { label: string; values: string[] }[] = [];
    let currIdx = i;

    while (currIdx < lines.length) {
      const label = lines[currIdx];
      if (!isRowLabel(label) || isPureNumber(label)) {
        break;
      }

      let valIdx = currIdx + 1;
      const vals: string[] = [];
      while (valIdx < lines.length && isNumericOrMathValue(lines[valIdx])) {
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
      !isPureNumber(h1) &&
      !isPureNumber(h2)
    ) {
      let valIdx = i + 2;
      const pairs: [string, string][] = [];
      while (
        valIdx + 1 < lines.length &&
        isRowValue(lines[valIdx]) &&
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
 * Converts MathML elements (<math>, <mrow>, <mfrac>, <msqrt>, <msup>, etc.) into standard KaTeX LaTeX syntax.
 */
export function convertMathmlToLatex(mathml: string): string {
  if (!mathml) return '';
  let s = mathml;

  s = s.replace(/<br\s*\/?>/gi, ' ')
       .replace(/<\/?(span|strong|em|b|i|u|div|p)[^>]*>/gi, '');

  s = s.replace(/^<math[^>]*&gt;/i, '<math>')
       .replace(/^<math\s*xmlns[^>]*>/i, '<math>')
       .replace(/&gt;/g, '>')
       .replace(/&lt;/g, '<');

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

  function splitMathmlNodes(html: string): string[] {
    if (!html) return [];
    const results: string[] = [];
    let depth = 0;
    let current = '';
    const regex = /(<\/?([a-zA-Z0-9]+)[^>]*>|[^<]+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const token = match[0];
      const tag = match[2];
      const isClose = token.startsWith('</');
      const isSelfClosing = token.endsWith('/>');

      if (tag && !isSelfClosing) {
        if (isClose) {
          depth--;
          current += token;
          if (depth === 0) {
            results.push(current.trim());
            current = '';
          }
        } else {
          depth++;
          current += token;
        }
      } else if (depth > 0) {
        current += token;
      } else if (token.trim()) {
        results.push(token.trim());
      }
    }

    if (current.trim()) {
      results.push(current.trim());
    }

    return results.filter(Boolean);
  }

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
        return `\\underline{${parseNodes(parts[0])}}`;
      }
      return parseNodes(inner);
    });

    res = res.replace(/<mrow[^>]*>([\s\S]*?)<\/mrow>/gi, (_, inner) => parseNodes(inner));

    res = res.replace(/<mo[^>]*>([\s\S]*?)<\/mo>/gi, (_, text) => {
      const t = text.trim();
      if (t === '±') return '\\pm ';
      if (t === '≤' || t === '&le;') return '\\le ';
      if (t === '≥' || t === '&ge;') return '\\ge ';
      if (t === '≠' || t === '&ne;') return '\\neq ';
      if (t === '×') return '\\times ';
      if (t === '÷') return '\\div ';
      if (t === '·' || t === '⋅') return '\\cdot ';
      if (t === '−') return '-';
      if (t === '°') return '^\\circ ';
      if (t === 'π') return '\\pi ';
      if (t === 'θ') return '\\theta ';
      if (t === '√') return '\\sqrt{}';
      if (t === '<' || t === '&lt;') return ' \\lt ';
      if (t === '>' || t === '&gt;') return ' \\gt ';
      if (t === '%') return '\\%';
      if (t === '$') return '\\$';
      if (t === '△') return '\\triangle ';
      if (t === '∠') return '\\angle ';
      return t;
    });

    res = res.replace(/<mi[^>]*>([\s\S]*?)<\/mi>/gi, (_, text) => {
      const t = text.trim();
      if (t === 'π') return '\\pi ';
      if (t === 'θ') return '\\theta ';
      if (t === 'α') return '\\alpha ';
      if (t === 'β') return '\\beta ';
      if (t === 'λ') return '\\lambda ';
      if (t === 'μ') return '\\mu ';
      if (t === 'Δ') return '\\Delta ';
      if (t === '%') return '\\%';
      if (t === '$') return '\\$';
      if (t === '△') return '\\triangle ';
      if (t === '∠') return '\\angle ';
      if (t === 'Ⅰ') return '\\text{I}';
      if (t === 'Ⅱ') return '\\text{II}';
      if (t === 'Ⅲ') return '\\text{III}';
      if (t === 'Ⅳ') return '\\text{IV}';
      return t;
    });

    res = res.replace(/<mn[^>]*>([\s\S]*?)<\/mn>/gi, (_, text) => text.trim().replace(/(?<!\\)%/g, '\\%').replace(/(?<!\\)\$/g, '\\$'));
    res = res.replace(/<mtext[^>]*>([\s\S]*?)<\/mtext>/gi, (_, text) => `\\text{${text.replace(/(?<!\\)\$/g, '\\$').replace(/(?<!\\)%/g, '\\%')}}`);
    res = res.replace(/<[^>]+>/g, '');

    return res.trim();
  }

  let result = parseNodes(s);
  result = result
    .replace(/&lt;/g, ' \\lt ')
    .replace(/&gt;/g, ' \\gt ')
    .replace(/(?<!\\)</g, ' \\lt ')
    .replace(/(?<!\\)>/g, ' \\gt ')
    .replace(/\\lt\s*=/g, '\\le ')
    .replace(/\\gt\s*=/g, '\\ge ')
    .replace(/(?<!\\)%/g, '\\%')
    .replace(/(?<!\\)\$/g, '\\$')
    .replace(/△/g, '\\triangle ')
    .replace(/∠/g, '\\angle ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .trim();

  return result;
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

  // Normalize XML namespaces & MathML blocks to standard <math>...</math>
  s = s.replace(/<mml:([a-zA-Z]+)[^>]*>/gi, '<$1>').replace(/<\/mml:([a-zA-Z]+)>/gi, '</$1>');
  s = s.replace(/<m:([a-zA-Z]+)[^>]*>/gi, '<$1>').replace(/<\/m:([a-zA-Z]+)>/gi, '</$1>');

  // 1. Convert MathML immediately FIRST before stripping tags
  if (s.includes('<math')) {
    s = s.replace(/<math[\s\S]*?<\/math>/gi, (m) => {
      const latex = convertMathmlToLatex(m);
      return `$${latex}$`;
    });
  }

  // Repair control character corruptions (e.g. \frac becoming ASCII 12 \x0c, \begin becoming ASCII 8 \x08)
  s = s.replace(/\x0crac/g, '\\frac').replace(/\x0c/g, '\\f');
  s = s.replace(/\x08egin/g, '\\begin').replace(/\x08/g, '\\b');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 2. Decode HTML XML entities
  s = s.replace(/&(?:#36|#x24|dollar);/gi, '$');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&(?:#39|apos);/g, "'");

  // Remove leading question numbering like "1. Text 1" -> "Text 1"
  s = s.replace(/^\d+[\.\s\-]+\s*(?=(?:Text\s*[12AB]|Passage\s*[12AB]|The following|Adapted|In the|Excerpt))/i, '');

  // 3. Strip XML/Word processing junk tags
  s = s.replace(/<\?xml[^>]*\?>/gi, '');
  s = s.replace(/<!DOCTYPE[^>]*>/gi, '');
  s = s.replace(/<w:[^>]+>[\s\S]*?<\/w:[^>]+>/gi, '');
  s = s.replace(/<\/?(?:w|o|v):[^>]*>/gi, '');

  // 4. Clean broken corrupted tags like </</ or <</ or </u</u or spaced tags < u >
  s = s.replace(/<[\s\\]*u[\s\\]*>/gi, '<u>');
  s = s.replace(/<[\s\\]*\/\s*u[\s\\]*>/gi, '</u>');
  s = s.replace(/<\/\s*<\s*\/?/g, '</');
  s = s.replace(/<+\s*<+\s*\/?/g, '<');
  s = s.replace(/<\/u\s*<\/u>/gi, '</u>');
  s = s.replace(/<u\s*<u\s*>/gi, '<u>');

  // Prevent Text 1 / Text 2 headers from being enclosed inside <u>
  s = s.replace(/(?:^|\n)\s*<u>\s*(Text\s*[12AB]|Passage\s*[12AB])\s*<\/u>/gi, '$1');
  s = s.replace(/(?:^|\n)\s*<u>\s*(Text\s*[12AB]|Passage\s*[12AB])\b/gi, '$1 <u>');

  // 5. Fix double dollar currency typos (e.g. "$$ 6.50$", "$$ 300$", "$$ 1.50$") and $\text{$70.00}$
  s = s.replace(/(?<!\\)\$[ \t]*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\b/g, (_, amt) => `\\$${amt}`);
  s = s.replace(/\\text\{\$([0-9]+(?:\,[0-9]+)*(?:\.[0-9]+)?)\}/g, (m, amt) => '\\text{\\\$' + amt + '}');

  // Remove stray OCR dollar signs embedded in English words (e.g. "Which$ choice" -> "Which choice")
  s = s.replace(/\b([A-Za-z]+)\$(?!\d)([A-Za-z]*)\b/g, '$1 $2').replace(/[ \t]+/g, ' ');

  // Automatically detect and escape currency dollar signs (e.g., $79, $8.75, $100, $1,200.50, $28 million)
  let currencyChanged = true;
  let currencyPasses = 0;
  while (currencyChanged && currencyPasses < 10) {
    currencyChanged = false;
    currencyPasses++;
    s = s.replace(/(?<!\\)\$[ \t]*([0-9]+(?:\,[0-9]+)*(?:\.[0-9]+)?[\s\S]*?)(?<!\\)\$/g, (full, inner) =>  {
      const startNumMatch = inner.match(/^([0-9]+(?:\,[0-9]+)*(?:\.[0-9]+)?)([\s\S]*)/);
      if (startNumMatch) {
        const rest = startNumMatch[2];
        const hasMathSyntax = /[\\=\^_\{\}\+\-\*\/\<\>]/.test(rest);
        const words = rest.match(/\b[a-zA-Z]{2,}\b/g) || [];
        if (!hasMathSyntax && words.length >= 1) {
          currencyChanged = true;
          return '\\$' + inner + '$';
        }
      }
      return full;
    });
  }

  // Escape unescaped currency dollar signs before numbers (e.g. $79, $8.75, $100) not followed by math delimiters
  s = s.replace(/(?<!\\)\$[ \t]*([0-9]+(?:\,[0-9]+)*(?:\.[0-9]+)?\b)(?!\$|\s*\\|\s*[\+\-\*\/\=\^\_\{\}\(<=>])/g, (m, g1) => {
    return '\\$' + g1;
  });
  // Protect double backslash LaTeX linebreaks (\\\\ or \\) before stripping stray single backslashes
  s = s.replace(/\\\\/g, '___LATEX_LINEBREAK___');

  // 6. Remove stray backslashes before numbers, spaces, or OCR typos outside math commands
  s = s.replace(/\\+\s+(?=[0-9A-Za-z<>=])/g, '');
  s = s.replace(/\\+(?=[0-9])/g, '');
  s = s.replace(/\\+(?=\s*[,.\?!:;])/g, '');

  // 7. Remove isolated backslashes that are not part of valid LaTeX commands
  s = s.replace(/\\(?![a-zA-Z\$\%_\#\&\{\}])/g, '');

  // Restore LaTeX double backslash linebreaks
  s = s.replace(/___LATEX_LINEBREAK___/g, ' \\\\ ');

  // 8. Fix OCR punctuation spacing
  s = s.replace(/[ \t]+([,\.\;\:\?\!])/g, '$1');
  s = s.replace(/,([A-Za-z0-9])/g, ', $1');

  // Fix missing space after sentence-ending punctuation
  s = s.replace(/(?<!\b(?:e\.g|i\.e|U\.S|A\.M|P\.M|Dr|Mr|Mrs|Ms|vs|St|Vol|No|Fig|approx)\.)([.!?]["”’']?)(?=[A-Za-z"“‘])/g, '$1 ');

  // 9. Safely normalize underline and ins tags
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

  // 10. Reconstruct tables
  s = reconstructTablesFromText(s);

  // 11. Balance unclosed or stray tags
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

  // 1. Convert any remaining MathML blocks directly into LaTeX
  if (s.includes('<math')) {
    s = s.replace(/<math[\s\S]*?<\/math>/gi, (m) => {
      const latex = convertMathmlToLatex(m);
      return `$${latex}$`;
    });
  }

  // 2. Protect existing math blocks ($...$ and $$...$$) before prose/inequality operations
  const protectedMath: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[^\$\n]+?(?<!\\)\$)/g, (match) => {
    protectedMath.push(match);
    return `___SAT_MATH_BLOCK_${protectedMath.length - 1}___`;
  });

  // Reconstruct flattened table structures into markdown tables
  s = reconstructTablesFromText(s);

  // 3. Protect currency dollar amounts with exact captured values
  s = s.replace(/(?<!\\)\$(\d+(?:,\d{3})*(?:\.\d{1,2})?)\b/g, (_, amt) => `\\$${amt}`);

  // 4. Spacing around HTML underline tags
  s = s.replace(/<\/u>([A-Za-z0-9])/g, '</u> $1');
  s = s.replace(/([A-Za-z0-9])<u>/g, '$1 <u>');

  // 5. Paired passage headers (Text 1, Text 2, Passage 1, Passage 2)
  s = s.replace(/(?:^|\n\n|\n)\s*(?:<u>\s*)?(Text\s*[12AB]|Passage\s*[12AB])(?:\s*<\/u>)?(?:\s*[:\-–]?\s*)([A-Za-z0-9"“'‘<])/g, (_, title, nextChar) => {
    return `\n\n**${title.trim()}**\n\n${nextChar}`;
  });
  s = s.trim();

  // If <u> sits right before **Text 1**, move <u> after **Text 1**
  s = s.replace(/<u>\s*(\*\*(?:Text\s*[12AB]|Passage\s*[12AB])\*\*)\s*/gi, '$1\n\n<u>');

  // 6. Separate SAT introductory lead-in sentences
  s = s.replace(
    /(^|\n\n|\n)((?:The following (?:text|passage)|This (?:text|passage)|Excerpt|Adapted from|In the following (?:text|passage))\s+(?:is|was|has been|from|adapted|excerpted|taken)[^\n]+?[\.\?!]["”']?)\s*(?=[A-Z"“])/gi,
    '$1$2\n\n'
  );

  // 7. Separate copyright notes
  s = s.replace(/([^\n])\s*((?:[©\u00A9]|\([cC]\)|Copyright\b)[^\n]*)/gi, '$1\n\n$2');

  // 8. Bullet points for student notes
  s = s.replace(/((?:following\s+)?notes\s*[:：])\s*/gi, '$1\n\n');
  s = s.replace(/(?:^|\n)\s*[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*/g, '\n* ');
  s = s.replace(/([^\n])\s+[•\u2022▪\u25AA‣\u2023◦\u25E6⁃\u2043・\u30FB∙\u2219·\u00B7]\s*/g, '$1\n* ');

  // 9. Unwrap entire OCR question prompts mistakenly wrapped in single outer $ ... $
  s = s.replace(/^\s*\$([^\$]+?\b(?:What is|Which of the following|Find the value|What value|Calculate|Solve for|How many)\b[^\$]+)\$\s*$/i, (match, inner) => {
    if (inner.includes('\\begin') || inner.includes('\\text')) return match;
    return inner.trim();
  });

  // 10. Format & normalize GFM markdown tables with proper spacing
  if (s.includes('|')) {
    s = s.replace(/(?<=\|[^\n]*)\n\s*\n+(?=\s*\|)/g, '\n');
    s = s.replace(/^(\|(?::?---+:?\|)+)$/gm, (match) => match);
  }

  // 11. Fix OCR stripped inequality choices & prompts in prose
  s = s.replace(/\bg\(x\)\s*f\(x\)\b/g, '$g(x) \\lt f(x)$');
  s = s.replace(/^x\s+h$/i, '$x \\lt h$');
  s = s.replace(/^h\s+x\s+k$/i, '$h \\lt x \\lt k$');
  s = s.replace(/\bx\s*>\s*k\s*or\s*x\s*<\s*h\b/gi, '$x \\gt k \\text{ or } x \\lt h$');
  s = s.replace(/\bx\s*<\s*h\s*or\s*x\s*>\s*k\b/gi, '$x \\lt h \\text{ or } x \\gt k$');

  // Fix missing inequality symbols in OCR/scraped math prompts
  s = s.replace(/\bwhere\s+10\s*n\s*50\b/gi, 'where $10 \\le n \\le 50$');
  s = s.replace(/\b10\s*n\s*50\b/gi, '$10 \\le n \\le 50$');

  // 12. Format compound inequalities like "2 < x < 5", "-3 < 2x + 1 < 7", "h < x < k", "0 <= a <= b <= 1" into math
  const compoundInequalityPattern = /(?<![\$a-zA-Z0-9\\])(?:[\-+]?\d+(?:\.\d+)?|[a-zA-Z0-9_\(\)]+)\s*(?:<=|>=|<|>|\\le|\\ge)\s*(?:[\-+]?\d*(?:[a-zA-Z0-9_]|\([^\)]+\))*(?:\s*[\+\-]\s*[a-zA-Z0-9_]+)?|[a-zA-Z0-9_\(\)]+)\s*(?:<=|>=|<|>|\\le|\\ge)\s*(?:[\-+]?\d+(?:\.\d+)?|[a-zA-Z0-9_\(\)]+)(?:\s*(?:<=|>=|<|>|\\le|\\ge)\s*(?:[\-+]?\d+(?:\.\d+)?|[a-zA-Z0-9_\(\)]+))?(?![\$a-zA-Z0-9\\])/g;

  s = s.replace(compoundInequalityPattern, (m) => {
    let clean = m.trim();
    clean = clean.replace(/<=/g, ' \\le ').replace(/>=/g, ' \\ge ').replace(/</g, ' \\lt ').replace(/>/g, ' \\gt ');
    clean = clean.replace(/\s+/g, ' ');
    return `$${clean}$`;
  });

  // 13. Format standalone simple inequalities like "x > k", "x < h", "y >= -2" into math if not already wrapped
  const mathVars = 'x|y|z|a|b|c|k|h|m|n|p|q|r|s|t|u|v|w|f\\(x\\)|g\\(x\\)|h\\(x\\)|p\\(x\\)';
  const simpleIneqRegex = new RegExp(`(?<![\\$a-zA-Z0-9\\\\])\\b(${mathVars}|[\\-+]?\\d+(?:\\.\\d+)?)\\s*([<>]=?|\\\\(?:le|ge|ne|neq))\\s*(${mathVars}|[\\-+]?\\d+(?:\\.\\d+)?)\\b(?![\\$a-zA-Z0-9\\\\])`, 'gi');

  s = s.replace(simpleIneqRegex, (_, v1, op, v2) => {
    let cleanOp = op === '<' ? '\\lt ' : op === '>' ? '\\gt ' : op === '<=' ? '\\le ' : op === '>=' ? '\\ge ' : op;
    return `$${v1} ${cleanOp} ${v2}$`;
  });

  // 14. Restore protected math blocks
  s = s.replace(/___SAT_MATH_BLOCK_(\d+)___/g, (_, idx) => protectedMath[parseInt(idx, 10)] || '');

  // Ensure systems of equations have line breaks \\ between equations in \begin{aligned}
  s = s.replace(/(\\begin\{(?:aligned|cases|array)\}[\s\S]*?\\end\{(?:aligned|cases|array)\})/gi, (block) => {
    const lines = block.split(/\\\\/);
    const updatedLines = lines.map((line) => {
      return line.replace(/([0-9a-zA-Z\)\}\]\$\+\-\*\/])\s+([a-zA-Z0-9_\(\)]+\s*(?:&=|=))/g, '$1 \\\\ $2');
    });
    return updatedLines.join(' \\\\ ');
  });

  if (!s.includes('\\begin{aligned}') && /\b[fghp]\(x\)\s*=\s*[^\n]+?\b[fghp]\(x\)\s*=\s*/i.test(s)) {
    s = s.replace(/(\b[fghp]\(x\)\s*=\s*[^\n]+?)\s+(\b[fghp]\(x\)\s*=\s*[^\n]+)/gi, '$$\\begin{aligned} $1 \\\\ $2 \\end{aligned}$$');
  }

  // Un-embed <u> and </u> tags from inside math blocks so HTML tags are never converted to KaTeX \lt u \gt
  s = s.replace(/\$([^\$]*?)<u\b[^>]*>([\s\S]*?)<\/u>([^\$]*?)\$/gi, (_, p1, inner, p2) => {
    const cleanP1 = p1.trim() ? `$${p1.trim()}$ ` : '';
    const cleanP2 = p2.trim() ? ` $${p2.trim()}$` : '';
    return `${cleanP1}<u>${inner}</u>${cleanP2}`;
  });

  // 15. Protect KaTeX math blocks ($...$) by replacing raw < and > with \\lt and \\gt to prevent HTML/KaTeX parse errors
  s = s.replace(/\$([^\$]+)\$/g, (_, inner) => {
    if (/<u\b|<\/u>/i.test(inner)) {
      return `$${inner}$`;
    }
    let cleanInner = inner.replace(/&lt;/g, ' \\lt ').replace(/&gt;/g, ' \\gt ');
    cleanInner = cleanInner.replace(/(?<!\\)</g, ' \\lt ').replace(/(?<!\\)>/g, ' \\gt ');
    cleanInner = cleanInner.replace(/\\lt\s*=/g, '\\le ').replace(/\\gt\s*=/g, '\\ge ');
    return `$${cleanInner}$`;
  });

  return s;
}

export function formatMathChoice(choice: string): string {
  if (!choice) return '';
  let clean = choice.trim();
  clean = clean.replace(/^[A-Da-d][.)\s]\s*/, '').trim();
  clean = sanitizeSatText(clean);
  return formatMathText(clean);
}