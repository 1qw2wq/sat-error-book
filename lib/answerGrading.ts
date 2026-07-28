/**
 * Helper utility for grading student-produced responses (grid-in answers)
 * and comparing user-typed input against official correct answers.
 */

export function parseNumericOrFraction(input: string): number | null {
  if (!input) return null;
  const clean = input.trim().replace(/\s+/g, '');

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

  // Single letter match e.g. "A" or "a" if correctAnswer is "A"
  if (
    userClean.length === 1 &&
    correctClean.length === 1 &&
    userClean.toUpperCase() === correctClean.toUpperCase()
  ) {
    return {
      isCorrect: true,
      normalizedUser: userClean.toUpperCase(),
      normalizedCorrect: correctClean.toUpperCase(),
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
