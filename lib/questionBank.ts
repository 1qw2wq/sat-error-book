import { RawSATQuestion, SATExamSummary, SATErrorItem, AnswerChoice } from '@/types/sat';
import { BluebookQuestionItem } from '@/components/BluebookTestShell';
import { formatMathText, formatMathChoice } from '@/lib/mathFormatter';

export type { BluebookQuestionItem };

/**
 * Splits question text into passage (stimulus) and question prompt for SAT Reading & Writing.
 */
export function splitPassageAndPrompt(
  questionText: string,
  section?: string
): { passageText?: string; questionPrompt: string } {
  if (!questionText) {
    return { questionPrompt: '' };
  }

  const cleanText = questionText.trim();

  // If section is Math, format any math equations and return directly as prompt
  if (section === 'Math') {
    const formatted = formatMathText(cleanText);
    return { questionPrompt: formatted };
  }

  // Common prompt trigger prefixes in SAT Reading & Writing (using non-capturing groups to prevent text duplication)
  const promptTriggers = [
    /\n\n(?=(?:Which choice|Based on the text|According to the text|What is the main|The author of|It can most reasonably|As used in the text|The primary purpose|Which finding|Which quotation|Which statement))/i,
    /\n\n(?=(?:In the text,|In Text 1,|In Text 2,|With which of the following))/i,
    /\n(?=(?:Which choice completes the text|Which choice best describes|Which choice most effectively|Which choice best states|Which choice conforms))/i,
  ];

  for (const regex of promptTriggers) {
    const parts = cleanText.split(regex);
    if (parts.length >= 2) {
      const passage = parts[0].trim();
      const prompt = parts.slice(1).join('').trim();
      if (passage.length > 20 && prompt.length > 5) {
        return {
          passageText: passage,
          questionPrompt: prompt,
        };
      }
    }
  }

  // Fallback: Split on last double newline if the last paragraph looks like a question
  const doubleNewlineIdx = cleanText.lastIndexOf('\n\n');
  if (doubleNewlineIdx !== -1) {
    const candidatePassage = cleanText.substring(0, doubleNewlineIdx).trim();
    const candidatePrompt = cleanText.substring(doubleNewlineIdx + 2).trim();
    if (
      candidatePassage.length > 20 &&
      (candidatePrompt.includes('?') || candidatePrompt.toLowerCase().startsWith('which choice'))
    ) {
      return {
        passageText: candidatePassage,
        questionPrompt: candidatePrompt,
      };
    }
  }

  return { questionPrompt: cleanText };
}

/**
 * Normalizes selections into clean choice strings
 */
export function formatSelections(
  selections: string[] | null | undefined,
  isMath = false,
  graphs?: string[] | string | null
): string[] {
  // If graphs has 4 images and selections are empty or dummy letter choices ['A.', 'B.', 'C.', 'D.']
  if (
    Array.isArray(graphs) &&
    graphs.length === 4 &&
    (!selections || selections.length === 0 || selections.every(s => !s || /^[A-Da-d][.)\s]*$/.test(s.trim())))
  ) {
    return graphs;
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return [];
  }

  // If choices are dummy placeholders like ["A.", "B.", "C.", "D."], treat as empty (Grid-In numeric question)
  const isAllDummyLetters = selections.every(s => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));
  if (isAllDummyLetters) {
    return [];
  }

  return selections.map((choice) => {
    if (typeof choice !== 'string') return String(choice);
    const cleaned = choice.replace(/^[A-Da-d][.)\s]\s*/, '').trim();
    if (isMath) {
      return formatMathChoice(cleaned);
    }
    return cleaned;
  });
}

/**
 * Normalizes answer string (e.g., "B", "14", "3/4")
 */
export function normalizeAnswer(ans: string | undefined): string {
  if (!ans) return '';
  return ans.trim();
}

/**
 * Converts a RawSATQuestion into a BluebookQuestionItem for BluebookTestShell
 */
export function transformRawToBluebookQuestion(
  raw: RawSATQuestion,
  index?: number
): BluebookQuestionItem {
  const isMath = raw.section === 'Math';
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section);

  const has4GraphChoices =
    Array.isArray(raw.graphs) &&
    raw.graphs.length === 4 &&
    (!raw.selections || raw.selections.length === 0 || raw.selections.every(s => !s || /^[A-Da-d][.)\s]*$/.test(s.trim())));

  const choices = formatSelections(raw.selections, isMath, raw.graphs);
  const isGridIn = raw.question_type !== 'Single Choice' || choices.length === 0;

  // Extract diagram/graph image (only if not used as choice images)
  let graphUrl: string | undefined = undefined;
  if (!has4GraphChoices && raw.graphs) {
    if (Array.isArray(raw.graphs) && raw.graphs.length > 0) {
      graphUrl = raw.graphs[0];
    } else if (typeof raw.graphs === 'string' && raw.graphs.trim().length > 0) {
      graphUrl = raw.graphs.trim();
    }
  }

  // Determine subTopic from question or section
  let subTopic = raw.section;
  if (raw.section === 'Reading and Writing') {
    if (raw.question.toLowerCase().includes('conforms to the conventions of standard english')) {
      subTopic = 'Standard English Conventions';
    } else if (raw.question.toLowerCase().includes('logical and precise word')) {
      subTopic = 'Craft & Structure';
    } else if (raw.question.toLowerCase().includes('logical transition')) {
      subTopic = 'Expression of Ideas';
    } else {
      subTopic = 'Information & Ideas';
    }
  } else if (raw.section === 'Math') {
    if (raw.question.toLowerCase().includes('triangle') || raw.question.toLowerCase().includes('circle') || raw.question.toLowerCase().includes('angle')) {
      subTopic = 'Geometry & Trigonometry';
    } else if (raw.question.toLowerCase().includes('slope') || raw.question.toLowerCase().includes('equation') || raw.question.toLowerCase().includes('system')) {
      subTopic = 'Algebra';
    } else if (raw.question.toLowerCase().includes('function') || raw.question.toLowerCase().includes('quadratic') || raw.question.toLowerCase().includes('exponential')) {
      subTopic = 'Advanced Math';
    } else {
      subTopic = 'Problem-Solving & Data Analysis';
    }
  }

  return {
    id: `q_${raw.question_id}`,
    number: index !== undefined ? index + 1 : raw.question_no,
    passageText,
    questionPrompt,
    choices: choices.length > 0 ? choices : undefined,
    correctAnswer: normalizeAnswer(raw.answers),
    isGridIn,
    imageDataUrl: graphUrl,
    graphData: graphUrl ? { hasGraph: true, croppedGraphUrl: graphUrl } : undefined,
    explanation: raw.explanations,
    subject: raw.section === 'Reading and Writing' ? 'Reading & Writing' : 'Math',
    subTopic,
    mistakeType: 'Concept Gap',
  };
}

/**
 * Converts a RawSATQuestion into an SATErrorItem so users can 1-click add to their SAT Error Book
 */
export function transformRawToErrorItem(
  raw: RawSATQuestion,
  userNotes?: string
): SATErrorItem {
  const isMath = raw.section === 'Math';
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section);

  const has4GraphChoices =
    Array.isArray(raw.graphs) &&
    raw.graphs.length === 4 &&
    (!raw.selections || raw.selections.length === 0 || raw.selections.every(s => !s || /^[A-Da-d][.)\s]*$/.test(s.trim())));

  const choices = formatSelections(raw.selections, isMath, raw.graphs);
  const answerChoices: AnswerChoice[] = ['A', 'B', 'C', 'D'].map((label, idx) => {
    const text = choices[idx] || '';
    return { label, text: text || `Option ${label}` };
  });

  // Extract graph image (only if not 4-choice images)
  let graphUrl: string | undefined = undefined;
  if (!has4GraphChoices && raw.graphs) {
    if (Array.isArray(raw.graphs) && raw.graphs.length > 0) {
      graphUrl = raw.graphs[0];
    } else if (typeof raw.graphs === 'string' && raw.graphs.trim().length > 0) {
      graphUrl = raw.graphs.trim();
    }
  }

  const difficultyMap: Record<number, 'Easy' | 'Medium' | 'Hard'> = {
    1: 'Easy', 2: 'Easy', 3: 'Easy', 4: 'Easy',
    5: 'Medium', 6: 'Medium', 7: 'Medium',
    8: 'Hard', 9: 'Hard', 10: 'Hard',
  };

  const difficultyLevel = difficultyMap[raw.difficulty] || 'Medium';

  let subTopic = raw.section;
  if (raw.section === 'Reading and Writing') {
    if (raw.question.toLowerCase().includes('conforms to the conventions of standard english')) {
      subTopic = 'Standard English Conventions';
    } else if (raw.question.toLowerCase().includes('logical and precise word')) {
      subTopic = 'Craft & Structure';
    } else if (raw.question.toLowerCase().includes('logical transition')) {
      subTopic = 'Expression of Ideas';
    } else {
      subTopic = 'Information & Ideas';
    }
  } else {
    if (raw.question.toLowerCase().includes('triangle') || raw.question.toLowerCase().includes('circle') || raw.question.toLowerCase().includes('angle')) {
      subTopic = 'Geometry & Trigonometry';
    } else if (raw.question.toLowerCase().includes('slope') || raw.question.toLowerCase().includes('equation') || raw.question.toLowerCase().includes('system')) {
      subTopic = 'Algebra';
    } else if (raw.question.toLowerCase().includes('function') || raw.question.toLowerCase().includes('quadratic') || raw.question.toLowerCase().includes('exponential')) {
      subTopic = 'Advanced Math';
    } else {
      subTopic = 'Problem-Solving & Data Analysis';
    }
  }

  const aiTakeaway = `Official SAT ${raw.exam_name} (#${raw.question_no}) — Key concept tested: ${subTopic} with difficulty level ${raw.difficulty}/10.`;

  return {
    id: `sat_q_${raw.question_id}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    subject: raw.section === 'Reading and Writing' ? 'Reading & Writing' : 'Math',
    subTopic,
    passageText: passageText || undefined,
    questionText: questionPrompt || raw.question,
    answerChoices: answerChoices.filter(c => c.text.length > 0),
    correctAnswer: normalizeAnswer(raw.answers),
    aiTakeaway,
    explanation: raw.explanations || 'Official explanation from SAT Question Bank.',
    imageDataUrl: graphUrl,
    graphData: graphUrl ? { hasGraph: true, croppedGraphUrl: graphUrl } : undefined,
    userNotes: userNotes || `Added from Question Bank: ${raw.exam_name} (Q#${raw.question_no})`,
    mistakeType: 'Concept Gap',
    masteryStatus: 'Confused',
    masteryLevel: 0,
    nextReviewDate: new Date().toISOString(),
    reviewHistory: [],
    testSource: raw.exam_name,
    difficulty: difficultyLevel,
  };
}
