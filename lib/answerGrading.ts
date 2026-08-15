/**
 * Helper utility for grading student-produced responses (grid-in answers)
 * and comparing user-typed or selected choices against official SAT answers.
 */

export function cleanTextForComparison(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\$/g, '') // remove LaTeX math $ delimiters
    .replace(/\\text\{([^}]*)\}/g, '$1') // remove \text{...}
    .replace(/\\left|\\right/g, '') // remove LaTeX left/right
    .replace(/[{}\\]/g, '') // remove stray braces and slashes
    .replace(/^[A-Da-d][).:]\s*/, '') // remove option prefix like "A) " or "B: "
    .trim()
    .toLowerCase();
}

export function parseNumericOrFraction(input: string): number | null {
  if (!input) return null;
  const clean = input
    .trim()
    .replace(/\$/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2') // convert \frac{a}{b} to a/b
    .replace(/\s+/g, '');

  // Handle fractions like "4/3", "-5/2", "1/2"
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

  // Handle standard decimals or integers e.g. "0.75", ".75", "-12"
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
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

  // Exact string match (case insensitive, space trimmed)
  if (userClean.toLowerCase() === correctClean.toLowerCase()) {
    return {
      isCorrect: true,
      normalizedUser: userClean,
      normalizedCorrect: correctClean,
    };
  }

  // Cleaned text match (ignoring markdown, latex, punctuation)
  const cleanU = cleanTextForComparison(userClean);
  const cleanC = cleanTextForComparison(correctClean);
  if (cleanU.length > 0 && cleanU === cleanC) {
    return {
      isCorrect: true,
      normalizedUser: userClean,
      normalizedCorrect: correctClean,
    };
  }

  // Single letter match e.g. "A" or "a" if correctAnswer is "A" or "A) ..."
  const singleLetterU = userClean.match(/^[A-Da-d]$/);
  const singleLetterC = correctClean.match(/^[A-Da-d]$/);
  if (singleLetterU && singleLetterC) {
    if (singleLetterU[0].toUpperCase() === singleLetterC[0].toUpperCase()) {
      return {
        isCorrect: true,
        normalizedUser: userClean.toUpperCase(),
        normalizedCorrect: correctClean.toUpperCase(),
      };
    }
  }

  // Letter with parenthesis / period prefix e.g. "A)" vs "A"
  const prefixU = userClean.match(/^[A-Da-d][).:]?/);
  const prefixC = correctClean.match(/^[A-Da-d][).:]?/);
  if (prefixU && prefixC && prefixU[0][0].toUpperCase() === prefixC[0][0].toUpperCase()) {
    return {
      isCorrect: true,
      normalizedUser: userClean,
      normalizedCorrect: correctClean,
    };
  }

  // Numeric or fraction evaluation
  const userNum = parseNumericOrFraction(userClean);
  const correctNum = parseNumericOrFraction(correctClean);

  if (userNum !== null && correctNum !== null) {
    // Check if close enough within 0.0001 precision or 4 decimal places
    const diff = Math.abs(userNum - correctNum);
    if (diff < 0.0001) {
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
