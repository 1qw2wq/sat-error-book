import { RawSATQuestion, SATExamSummary, SATErrorItem, AnswerChoice } from '@/types/sat';
import { BluebookQuestionItem } from '@/components/BluebookTestShell';
import { formatMathText, formatMathChoice } from '@/lib/mathFormatter';

export type { BluebookQuestionItem };

/**
 * Splits text into grammatical sentences without falsely splitting on abbreviations or decimals.
 */
function splitEnglishSentences(text: string): string[] {
  if (!text) return [];
  const safe = text
    .replace(/\b(e\.g\.|i\.e\.|etc\.|vs\.|al\.|Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)/gi, (m) => m.replace(/\./g, '@DOT@'))
    .replace(/(\d)\.(\d)/g, '$1@DOT@$2');

  const chunks = safe.split(/(?<=[.!?])\s+(?=[A-Z“"\[])/);
  return chunks.map((c) => c.replace(/@DOT@/g, '.').trim()).filter(Boolean);
}

/**
 * Automatically restores missing <u>...</u> tags for questions mentioning underlined portions/sentences.
 */
export function restoreUnderline(
  questionText: string,
  explanation?: string
): string {
  if (!questionText || /<u[\s>]|\\underline|<ins[\s>]/i.test(questionText)) {
    return questionText;
  }

  // Only run if the question explicitly refers to an underlined element
  if (!/underlined/i.test(questionText)) {
    return questionText;
  }

  const explStr = explanation || '';

  // 1. Direct quote extraction from explanation after 划线 / 画线
  const matchPats = [
    /[划画]线(?:短语|部分|句|词|句子|内容|文本)?[\s\S]{0,60}?[“"']([^“”"'\n]{3,180})[”"']/g,
    /[“"']([a-zA-Z0-9\s,.'\-\–—;:!?()\[\]]{6,150})[”"']/g,
  ];

  for (const pat of matchPats) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(explStr)) !== null) {
      const cand = m[1].trim();
      if (cand && cand.length >= 4 && questionText.includes(cand)) {
        const idx = questionText.indexOf(cand);
        const promptIdx = questionText.toLowerCase().lastIndexOf('which choice');
        if (promptIdx === -1 || idx < promptIdx) {
          return questionText.replace(cand, `<u>${cand}</u>`);
        }
      }
    }
  }

  // 2. Sentence-level heuristics when prompt specifically asks about sentence or portion
  const promptIdx = questionText.toLowerCase().lastIndexOf('which choice');
  const passage = (promptIdx > 20 ? questionText.substring(0, promptIdx) : questionText).trim();
  const sentences = splitEnglishSentences(passage);

  if (sentences.length > 0) {
    // If explanation explicitly mentions transition / contrast or specific sentence keywords
    if (
      /[划画]线[\s\S]{0,30}?(?:然而|但是|不过|相反|却|第二句|第三句)/i.test(explStr) ||
      /“然而”|“但是”/i.test(explStr)
    ) {
      const transSent = sentences.find((s) =>
        /^(?:However|Yet|Nonetheless|Nevertheless|But|In contrast|On the other hand)\b/i.test(s)
      );
      if (transSent) {
        return questionText.replace(transSent, `<u>${transSent}</u>`);
      }
    }

    if (/[划画]线[\s\S]{0,30}?(?:第一句|首句|首先)/i.test(explStr)) {
      return questionText.replace(sentences[0], `<u>${sentences[0]}</u>`);
    }

    const transSent = sentences.find((s) =>
      /^(?:However|Yet|Nonetheless|Nevertheless|But|In contrast|On the other hand)\b/i.test(s)
    );
    if (transSent && /然而|但是|不过|转折/i.test(explStr)) {
      return questionText.replace(transSent, `<u>${transSent}</u>`);
    }

    // Default to the last sentence of stimulus if prompt asks for "underlined sentence"
    const lastSentence = sentences[sentences.length - 1];
    if (lastSentence) {
      return questionText.replace(lastSentence, `<u>${lastSentence}</u>`);
    }
  }

  return questionText;
}

/**
 * Splits question text into passage (stimulus) and question prompt for SAT Reading & Writing.
 */
export function splitPassageAndPrompt(
  questionText: string,
  section?: string,
  explanation?: string
): { passageText?: string; questionPrompt: string } {
  if (!questionText) {
    return { questionPrompt: '' };
  }

  const restoredText = restoreUnderline(questionText, explanation);
  const cleanText = restoredText.trim();

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
  const isDummySelections =
    !selections ||
    selections.length === 0 ||
    selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));

  // Case 1: graphs has 4 images and selections are empty/dummy letters
  if (Array.isArray(graphs) && graphs.length === 4 && isDummySelections) {
    return graphs;
  }

  // Case 2: graphs has 5 images (item 0 is stem diagram, items 1-4 are choice images)
  if (Array.isArray(graphs) && graphs.length === 5 && isDummySelections) {
    return graphs.slice(1, 5);
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return [];
  }

  // If choices are dummy placeholders like ["A.", "B.", "C.", "D."], treat as empty (Grid-In numeric question)
  if (isDummySelections) {
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
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section, raw.explanations);

  const isDummySelections =
    !raw.selections ||
    raw.selections.length === 0 ||
    raw.selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));

  const has4GraphChoices = Array.isArray(raw.graphs) && raw.graphs.length === 4 && isDummySelections;
  const has5GraphChoices = Array.isArray(raw.graphs) && raw.graphs.length === 5 && isDummySelections;

  const choices = formatSelections(raw.selections, isMath, raw.graphs);
  const isGridIn = raw.question_type !== 'Single Choice' || choices.length === 0;

  // Extract diagram/graph image for the question stem
  let graphUrl: string | undefined = undefined;
  if (has5GraphChoices && Array.isArray(raw.graphs)) {
    graphUrl = raw.graphs[0];
  } else if (!has4GraphChoices && raw.graphs) {
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
    rawQuestion: raw,
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
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section, raw.explanations);

  const isDummySelections =
    !raw.selections ||
    raw.selections.length === 0 ||
    raw.selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));

  const has4GraphChoices = Array.isArray(raw.graphs) && raw.graphs.length === 4 && isDummySelections;
  const has5GraphChoices = Array.isArray(raw.graphs) && raw.graphs.length === 5 && isDummySelections;

  const choices = formatSelections(raw.selections, isMath, raw.graphs);
  const answerChoices: AnswerChoice[] = ['A', 'B', 'C', 'D'].map((label, idx) => {
    const text = choices[idx] || '';
    return { label, text: text || `Option ${label}` };
  });

  // Extract graph image (only if not 4-choice images)
  let graphUrl: string | undefined = undefined;
  if (has5GraphChoices && Array.isArray(raw.graphs)) {
    graphUrl = raw.graphs[0];
  } else if (!has4GraphChoices && raw.graphs) {
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
