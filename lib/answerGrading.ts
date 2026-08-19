/**
 * Helper utility for grading student-produced responses (grid-in answers)
 * and comparing user-typed or selected choices against official SAT answers.
 */

export function cleanTextForComparison(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\$/g, '') // remove LaTeX math $ delimiters or currency signs
    .replace(/%/g, '') // remove percentage signs
    .replace(/\\text\{([^}]*)\}/g, '$1') // remove \text{...}
    .replace(/\\left|\\right/g, '') // remove LaTeX left/right
    .replace(/[{}\\]/g, '') // remove stray braces and slashes
    .replace(/^[A-Da-d][).:]\s*/, '') // remove option prefix like "A) " or "B: "
    .trim()
    .toLowerCase();
}

/**
 * Parses numeric or fractional representations including LaTeX fractions,
 * percentages, currency, positive signs, leading/trailing zeros.
 */
export function parseNumericOrFraction(input: string): number | null {
  if (!input) return null;
  let clean = input
    .trim()
    .replace(/[\$,]/g, '')
    .replace(/%/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2') // convert \frac{a}{b} to a/b
    .replace(/\s+/g, '');

  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }

  // Handle fractions like "4/3", "-5/2", "1/2", "145/12"
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }

  // Handle standard decimals or integers e.g. "0.75", ".75", "-12.08"
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

/**
 * Compares two numeric or fraction strings for exact value, float equivalence,
 * and standard SAT repeating decimal rounding/truncation rules (e.g. 2/3 = 0.666 or 0.667).
 */
export function areNumericallyEquivalent(userStr: string, officialStr: string): boolean {
  const u = parseNumericOrFraction(userStr);
  const o = parseNumericOrFraction(officialStr);
  if (u === null || o === null) return false;

  // Float equivalence within high precision tolerance
  if (Math.abs(u - o) < 0.0005) return true;

  // Normalized string equality (e.g. "0.75" vs ".75", "+5" vs "5")
  const uNorm = userStr.trim().replace(/^0\./, '.').replace(/^\+/, '');
  const oNorm = officialStr.trim().replace(/^0\./, '.').replace(/^\+/, '');
  if (uNorm === oNorm) return true;

  // Repeating decimal checks (e.g. College Board allows 0.666 or 0.667 or .666 or .667 for 2/3)
  const oVal = parseNumericOrFraction(officialStr);
  if (oVal !== null) {
    const truncated3 = Math.trunc(oVal * 1000) / 1000;
    const rounded3 = Math.round(oVal * 1000) / 1000;
    const truncated4 = Math.trunc(oVal * 10000) / 10000;
    const rounded4 = Math.round(oVal * 10000) / 10000;
    if (
      Math.abs(u - truncated3) < 0.0001 ||
      Math.abs(u - rounded3) < 0.0001 ||
      Math.abs(u - truncated4) < 0.0001 ||
      Math.abs(u - rounded4) < 0.0001
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Splits a composite official answer string (e.g. "0.25, .25, 1/4" or "12.08, 145/12" or "3/4 or .75")
 * into distinct candidate accepted answers.
 */
export function splitOfficialAnswerCandidates(officialAns: string): string[] {
  if (!officialAns) return [];
  const candidates = officialAns
    .split(/[,;|]|\s+or\s+|\s+OR\s+|，|、/i)
    .map((c) => c.trim())
    .filter(Boolean);

  return candidates.length > 0 ? candidates : [officialAns.trim()];
}

export function gradeStudentResponse(
  userTyped: string,
  correctAnswer: string
): {
  isCorrect: boolean;
  normalizedUser: string;
  normalizedCorrect: string;
} {
  const userClean = (userTyped || '').trim();
  const correctClean = (correctAnswer || '').trim();

  if (!userClean) {
    return {
      isCorrect: false,
      normalizedUser: '',
      normalizedCorrect: correctClean,
    };
  }

  // Get all acceptable candidate forms from the official answer
  const candidates = splitOfficialAnswerCandidates(correctClean);

  for (const cand of candidates) {
    // 1. Exact string match (case-insensitive)
    if (userClean.toLowerCase() === cand.toLowerCase()) {
      return {
        isCorrect: true,
        normalizedUser: userClean,
        normalizedCorrect: correctClean,
      };
    }

    // 2. Cleaned text match (ignoring markdown, LaTeX, punctuation)
    const cleanU = cleanTextForComparison(userClean);
    const cleanC = cleanTextForComparison(cand);
    if (cleanU.length > 0 && cleanU === cleanC) {
      return {
        isCorrect: true,
        normalizedUser: userClean,
        normalizedCorrect: correctClean,
      };
    }

    // 3. Single letter match e.g. "A" or "a" if candidate is "A" or "A) ..."
    const singleLetterU = userClean.match(/^[A-Da-d]$/);
    const singleLetterC = cand.match(/^[A-Da-d]$/);
    if (singleLetterU && singleLetterC) {
      if (singleLetterU[0].toUpperCase() === singleLetterC[0].toUpperCase()) {
        return {
          isCorrect: true,
          normalizedUser: userClean.toUpperCase(),
          normalizedCorrect: correctClean.toUpperCase(),
        };
      }
    }

    // 4. Letter with parenthesis/colon prefix e.g. "A)" vs "A"
    const prefixU = userClean.match(/^[A-Da-d][).:]?/);
    const prefixC = cand.match(/^[A-Da-d][).:]?/);
    if (prefixU && prefixC && prefixU[0][0].toUpperCase() === prefixC[0][0].toUpperCase()) {
      return {
        isCorrect: true,
        normalizedUser: userClean,
        normalizedCorrect: correctClean,
      };
    }

    // 5. Numerical / Fraction / Decimal equivalence check
    if (areNumericallyEquivalent(userClean, cand)) {
      return {
        isCorrect: true,
        normalizedUser: userClean,
        normalizedCorrect: correctClean,
      };
    }
  }

  return {
    isCorrect: false,
    normalizedUser: userClean,
    normalizedCorrect: correctClean,
  };
}

/**
 * Universal SAT grader that handles both Multiple Choice (with choice labels or text)
 * and Student-Produced Response / Grid-in questions.
 */
export function evaluateSATQuestionAnswer(
  userAns: string,
  officialAns: string,
  choices?: string[] | { label: string; text: string }[]
): boolean {
  if (!userAns || !officialAns) return false;

  // 1. Direct grade check
  if (gradeStudentResponse(userAns, officialAns).isCorrect) {
    return true;
  }

  // Normalize choices array to string array
  const rawChoiceTexts: string[] = choices
    ? choices.map((c) => (typeof c === 'string' ? c : c.text))
    : [];

  const choiceLabels = ['A', 'B', 'C', 'D'];
  const uTrim = userAns.trim();
  const oTrim = officialAns.trim();
  const uUpper = uTrim.toUpperCase();
  const oUpper = oTrim.toUpperCase();

  // If user selected A/B/C/D
  const uIdx = choiceLabels.indexOf(uUpper);
  // If official is A/B/C/D
  const oIdx = choiceLabels.indexOf(oUpper);

  if (uIdx !== -1 && oIdx !== -1) {
    return uIdx === oIdx;
  }

  if (rawChoiceTexts.length > 0) {
    // Case 1: user selected choice letter ('A'), official answer is text (e.g. '$23$')
    if (uIdx >= 0 && rawChoiceTexts[uIdx]) {
      if (gradeStudentResponse(rawChoiceTexts[uIdx], officialAns).isCorrect) {
        return true;
      }
    }

    // Case 2: user typed text (e.g. '$23$'), official answer is choice letter ('B')
    if (oIdx >= 0 && rawChoiceTexts[oIdx]) {
      if (gradeStudentResponse(userAns, rawChoiceTexts[oIdx]).isCorrect) {
        return true;
      }
    }

    // Case 3: check if official answer starts with letter prefix e.g. "B) $23$"
    if (uIdx >= 0) {
      const matchPrefix = officialAns.match(/^([A-Da-d])[).:]/);
      if (matchPrefix && matchPrefix[1].toUpperCase() === choiceLabels[uIdx]) {
        return true;
      }
    }
  }

  return false;
}
