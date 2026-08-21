import { RawSATQuestion, SATExamSummary, SATErrorItem, AnswerChoice, GraphData } from '@/types/sat';
import { BluebookQuestionItem } from '@/components/BluebookTestShell';
import { formatMathText, formatMathChoice, sanitizeSatText } from '@/lib/mathFormatter';

export type { BluebookQuestionItem };

/**
 * Automatically restores missing <u>...</u> tags for questions mentioning underlined portions.
 */
export function restoreUnderline(
  questionText: string,
  explanation?: string
): string {
  if (!questionText) return '';
  const normalized = sanitizeSatText(questionText);

  // If text already has valid underline tags, return directly
  if (/<u[^>]*>[\s\S]*?<\/u>|\\underline|<ins[^>]*>/i.test(normalized)) {
    return normalized;
  }

  // Only run if the question explicitly refers to an underlined element
  if (!/(?:underlined|underline|underlining)/i.test(normalized)) {
    return normalized;
  }

  const expl = explanation || '';

  // Special Case A: Two-underlined questions (e.g. Alabaster poem, Cave formations)
  if (/alabaster box/i.test(normalized) && /is my heart/i.test(normalized)) {
    let res = normalized;
    const line1 = 'Like this alabaster box whose art';
    const line1Alt = 'this alabaster box whose art';
    const line2 = 'is my heart';
    if (res.includes(line1)) res = res.replace(line1, `<u>${line1}</u>`);
    else if (res.includes(line1Alt)) res = res.replace(line1Alt, `<u>${line1Alt}</u>`);
    if (res.includes(line2)) res = res.replace(line2, `<u>${line2}</u>`);
    return res;
  }

  if (/Cave formations from about 7 million years ago/i.test(normalized)) {
    let res = normalized;
    const p1 = 'Cave formations from about 7 million years ago mainly consist of transparent columnar calcite, indicative of an underground water system regularly replenished by rainfall.';
    const p2 = 'Cave formations younger than approximately 1 million years, however, mainly consist of branching, opaque (and sometimes colorful) material, often with more frequent growth interruptions, indicating an intermittent water supply.';
    if (res.includes(p1)) res = res.replace(p1, `<u>${p1}</u>`);
    if (res.includes(p2)) res = res.replace(p2, `<u>${p2}</u>`);
    return res;
  }

  // Special Case B: Alternative-history fiction cosmonauts question (Q# 611332)
  if (/Industrial Revolution/i.test(normalized) && /Soviet cosmonauts/i.test(normalized)) {
    const target = 'What if India had started the Industrial Revolution? What if Soviet cosmonauts had been first to land on the moon?';
    if (normalized.includes(target)) {
      return normalized.replace(target, `<u>${target}</u>`);
    }
  }

  // Special Case C: Bayeux Tapestry joining process (Q# 137104)
  if (/Bayeux Tapestry/i.test(normalized) && /joining process/i.test(normalized)) {
    const target = 'It’s plausible that the workshop that produced the tapestry had never produced one so large, and some researchers claim that a close examination of the joins—the places where the panels are stitched together—suggests that the workers developed and refined their joining process over the course of production.';
    if (normalized.includes(target)) {
      return normalized.replace(target, `<u>${target}</u>`);
    }
  }

  // 1. Direct quote extraction from explanation after 划线 / 画线
  const matchPats = [
    /[划画]线(?:短语|部分|句|词|句子|内容|文本|主张|观点)?[\s\S]{0,50}?[“"']([^“”"'\n]{5,250})[”"']/g,
    /“([A-Za-z][^“”\n]{6,250})”/g,
    /"([A-Za-z][^"\n]{6,250})"/g,
  ];

  for (const pat of matchPats) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(expl)) !== null) {
      const cand = m[1].trim();
      // Candidate must contain English words and be part of normalized
      if (cand && /[A-Za-z]{3,}/.test(cand) && cand.length >= 6 && normalized.includes(cand)) {
        return normalized.replace(cand, `<u>${cand}</u>`);
      }
    }
  }

  // 2. English snippet pattern from explanation (at least 15 chars)
  const englishSnippetPat = /([A-Za-z][A-Za-z0-9\s,.'\-\–—;:!?()]{14,200})/g;
  let em: RegExpExecArray | null;
  while ((em = englishSnippetPat.exec(expl)) !== null) {
    const cand = em[1].trim();
    if (cand.length >= 15 && normalized.includes(cand)) {
      const idx = normalized.indexOf(cand);
      const promptMatch = normalized.match(/(?:Which (?:choice|finding|statement|quotation|sentence|idea|detail|claim)|Based on the|According to the)/i);
      const pIdx = promptMatch ? promptMatch.index : -1;
      if (pIdx === -1 || (pIdx !== undefined && idx < pIdx)) {
        return normalized.replace(cand, `<u>${cand}</u>`);
      }
    }
  }

  // 3. Match by sentence position in passage
  const promptMatch = normalized.match(/(?:Which (?:choice|finding|statement|quotation|sentence|idea|detail|claim|example)|Based on the|According to the|The student wants to|A student wants to)/i);
  const promptIdx = promptMatch && promptMatch.index !== undefined ? promptMatch.index : normalized.length;

  if (promptIdx > 20) {
    const passage = normalized.substring(0, promptIdx).trim();
    const sentences = passage
      .split(/(?<=[.!?])\s+(?=[A-Z“"\[0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    if (sentences.length > 0) {
      if (/第一句|首句|开头/i.test(expl)) {
        return normalized.replace(sentences[0], `<u>${sentences[0]}</u>`);
      }
      if (/第二句/i.test(expl) && sentences.length > 1) {
        return normalized.replace(sentences[1], `<u>${sentences[1]}</u>`);
      }
      if (/第三句/i.test(expl) && sentences.length > 2) {
        return normalized.replace(sentences[2], `<u>${sentences[2]}</u>`);
      }
      if (/最后一句|末句|结尾|论断|主张|观点/i.test(expl)) {
        const last = sentences[sentences.length - 1];
        return normalized.replace(last, `<u>${last}</u>`);
      }
      if (/倒数第二句/i.test(expl) && sentences.length > 1) {
        const pen = sentences[sentences.length - 2];
        return normalized.replace(pen, `<u>${pen}</u>`);
      }
      if (/然而|但是|不过|相反|却/i.test(expl)) {
        const transSent = sentences.find((s) =>
          /^(?:However|Yet|Nonetheless|Nevertheless|But|In contrast|On the other hand)\b/i.test(s)
        );
        if (transSent) {
          return normalized.replace(transSent, `<u>${transSent}</u>`);
        }
      }

      let bestSent: string | null = null;
      let maxOverlap = 0;
      for (const sent of sentences) {
        const words = sent.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        let score = 0;
        for (const w of words) {
          if (expl.toLowerCase().includes(w)) score++;
        }
        if (score > maxOverlap) {
          maxOverlap = score;
          bestSent = sent;
        }
      }

      if (bestSent && maxOverlap >= 2) {
        return normalized.replace(bestSent, `<u>${bestSent}</u>`);
      }

      const targetSentence = sentences.length > 1 ? sentences[sentences.length - 1] : sentences[0];
      if (targetSentence) {
        return normalized.replace(targetSentence, `<u>${targetSentence}</u>`);
      }
    }
  }

  return normalized;
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

  let cleanText = sanitizeSatText(questionText);
  cleanText = restoreUnderline(cleanText, explanation);

  if (section === 'Math') {
    return { questionPrompt: formatMathText(cleanText) };
  }

  // 1. Rhetorical Synthesis notes prompt check
  const notesMatch = cleanText.match(/(?:following\s+)?notes\s*[:：][\s\S]*?(?:(?:\n\s*[*•▪‣◦⁃・∙·]\s*[^\n]+)+)/i);
  if (notesMatch && notesMatch.index !== undefined) {
    const endOfNotesIdx = notesMatch.index + notesMatch[0].length;
    const passage = cleanText.substring(0, endOfNotesIdx).trim();
    const prompt = cleanText.substring(endOfNotesIdx).trim();
    if (passage.length > 20 && prompt.length > 5) {
      return {
        passageText: formatMathText(passage),
        questionPrompt: formatMathText(prompt),
      };
    }
  }

  // 2. Match standard SAT prompt patterns cleanly (even when immediately touching </u> or periods)
  const SAT_PROMPT_PREFIXES = [
    'The\\s+student\\s+wants',
    'A\\s+student\\s+wants',
    'Which\\s+choice',
    'Which\\s+finding',
    'Which\\s+quotation',
    'Which\\s+statement',
    'Which\\s+sentence',
    'Which\\s+idea',
    'Which\\s+detail',
    'Which\\s+claim',
    'Which\\s+illustration',
    'Based\\s+on\\s+the\\s+(?:text|texts|passage|passages|table|graph|chart)',
    'According\\s+to\\s+the\\s+(?:text|texts|passage|passages|table|speaker|author)',
    'According\\s+to\\s+both\\s+texts',
    'What\\s+does\\s+the\\s+(?:text|texts|speaker|author|narrator|character)',
    'What\\s+is\\s+the\\s+(?:main|primary)',
    'As\\s+used\\s+in\\s+(?:the\\s+text|line\\s+\\d+)',
    'The\\s+(?:primary|main)\\s+purpose',
    'The\\s+author(?:[\'’]s)?\\s+primary',
    'The\\s+speaker(?:[\'’]s)?\\s+primary',
    'The\\s+narrator\\s+indicates',
    'In\\s+the\\s+(?:text|passage|poem|context)[,:]?',
    'In\\s+Text\\s+[12A-B][,:]?',
    'In\\s+Passage\\s+[12A-B][,:]?',
  ];

  const promptPattern = new RegExp(
    '(?:\\n+|(?:[\\.\\!\\?]["”’\']?|<\\/u>|<\\/ins>)\\s*)(?=(?:' + SAT_PROMPT_PREFIXES.join('|') + ')\\b)',
    'i'
  );

  const match = cleanText.match(promptPattern);
  if (match && match.index !== undefined && match.index > 20) {
    const splitIndex = match.index + match[0].length;

    let passage = cleanText.substring(0, splitIndex).trim();
    let prompt = cleanText.substring(splitIndex).trim();

    // Ensure balanced underline tags
    const openU = (passage.match(/<u\b[^>]*>/gi) || []).length;
    const closeU = (passage.match(/<\/u>/gi) || []).length;
    if (openU > closeU) {
      passage += '</u>';
    }

    // Clean stray closing tags from prompt
    prompt = prompt.replace(/^<\/(?:u|ins)>/i, '').trim();

    if (passage.length > 20 && prompt.length > 5) {
      return {
        passageText: formatMathText(passage),
        questionPrompt: formatMathText(prompt),
      };
    }
  }

  return { questionPrompt: formatMathText(cleanText) };
}

/**
 * Checks if a list of choices is dummy or empty (e.g. Option A, Option B, etc.)
 */
export function isDummyChoices(choices?: AnswerChoice[] | string[] | null): boolean {
  if (!choices || choices.length === 0) return true;
  if (typeof choices[0] === 'string') {
    return (choices as string[]).every((s) => !s || /^(?:Option\s+[A-Da-d]|[A-Da-d][.)\s]*)$/i.test(s.trim()));
  }
  return (choices as AnswerChoice[]).every((c) => !c.text || /^(?:Option\s+[A-Da-d]|[A-Da-d][.)\s]*)$/i.test(c.text.trim()));
}

export function formatSelections(
  selections: string[] | null | undefined,
  isMath = false,
  graphs?: string[] | string | null
): string[] {
  const isDummySelections =
    !selections ||
    selections.length === 0 ||
    selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));

  if (Array.isArray(graphs) && graphs.length === 4 && isDummySelections) {
    return graphs;
  }
  if (Array.isArray(graphs) && graphs.length === 5 && isDummySelections) {
    return graphs.slice(1, 5);
  }
  if (!selections || !Array.isArray(selections) || selections.length === 0 || isDummySelections) {
    return [];
  }

  return selections.map((choice) => {
    if (typeof choice !== 'string') return String(choice);
    const cleaned = choice.replace(/^[A-Da-d][.)\s]\s*/, '').trim();
    return isMath ? formatMathChoice(cleaned) : formatMathText(cleaned);
  });
}

export function normalizeAnswer(ans: string | undefined): string {
  if (!ans) return '';
  return ans.trim();
}

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

  let graphUrl: string | undefined = undefined;
  let finalExplanation = raw.explanations;

  const isSolutionGraphImage =
    (!raw.explanations || raw.explanations === null || raw.explanations.trim() === '') &&
    Array.isArray(raw.graphs) &&
    raw.graphs.length === 1;

  if (isSolutionGraphImage && raw.graphs) {
    finalExplanation = `![Detailed Solution](${raw.graphs[0]})`;
    graphUrl = undefined;
  } else if (has5GraphChoices && Array.isArray(raw.graphs)) {
    graphUrl = raw.graphs[0];
  } else if (!has4GraphChoices && raw.graphs) {
    if (Array.isArray(raw.graphs) && raw.graphs.length > 0) {
      graphUrl = raw.graphs[0];
    } else if (typeof raw.graphs === 'string' && raw.graphs.trim().length > 0) {
      graphUrl = raw.graphs.trim();
    }
  }

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
    explanation: finalExplanation,
    subject: raw.section === 'Reading and Writing' ? 'Reading & Writing' : 'Math',
    subTopic,
    mistakeType: 'Concept Gap',
    rawQuestion: raw,
  };
}

export function transformRawToErrorItem(
  raw: RawSATQuestion,
  userNotes?: string
): SATErrorItem {
  const isMath = raw.section === 'Math';
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section, raw.explanations);

  let parsedGraphs: string[] = [];
  let embeddedGraphData: GraphData | undefined = undefined;

  if (typeof raw.graphs === 'string' && raw.graphs.trim().length > 0) {
    const trimmed = raw.graphs.trim();
    if (trimmed.startsWith('{')) {
      try {
        embeddedGraphData = JSON.parse(trimmed);
      } catch {
        parsedGraphs = [trimmed];
      }
    } else if (trimmed.startsWith('[')) {
      try {
        parsedGraphs = JSON.parse(trimmed);
      } catch {
        parsedGraphs = [trimmed];
      }
    } else {
      parsedGraphs = [trimmed];
    }
  } else if (Array.isArray(raw.graphs)) {
    parsedGraphs = raw.graphs;
  }

  const isDummySelections =
    !raw.selections ||
    raw.selections.length === 0 ||
    raw.selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));

  const has4GraphChoices = parsedGraphs.length === 4 && isDummySelections;
  const has5GraphChoices = parsedGraphs.length === 5 && isDummySelections;

  const choices = formatSelections(raw.selections, isMath, parsedGraphs.length > 0 ? parsedGraphs : raw.graphs);
  const answerChoices: AnswerChoice[] =
    choices.length > 0
      ? choices.map((text, idx) => ({
          label: String.fromCharCode(65 + idx),
          text,
        }))
      : [];

  let graphUrl: string | undefined = undefined;
  let finalExplanation = raw.explanations;

  if (embeddedGraphData?.croppedGraphUrl) {
    graphUrl = embeddedGraphData.croppedGraphUrl;
  } else {
    const isSolutionGraphImage =
      (!raw.explanations || raw.explanations === null || raw.explanations.trim() === '') &&
      parsedGraphs.length === 1;

    if (isSolutionGraphImage) {
      finalExplanation = `![Detailed Solution](${parsedGraphs[0]})`;
      graphUrl = undefined;
    } else if (has5GraphChoices || (!has4GraphChoices && parsedGraphs.length > 0)) {
      graphUrl = parsedGraphs[0];
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
  const fullQuestionText = raw.question?.trim() || (passageText ? `${passageText}\n\n${questionPrompt}` : questionPrompt);
  const imagesList = parsedGraphs.length > 0 ? parsedGraphs : (graphUrl ? [graphUrl] : undefined);

  return {
    id: `sat_q_${raw.question_id}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    subject: raw.section === 'Reading and Writing' ? 'Reading & Writing' : 'Math',
    subTopic,
    passageText: passageText || undefined,
    questionText: fullQuestionText,
    answerChoices: answerChoices.filter((c) => c.text.length > 0),
    correctAnswer: normalizeAnswer(raw.answers),
    aiTakeaway,
    explanation: finalExplanation || 'Official explanation from SAT Question Bank.',
    imageDataUrl: graphUrl,
    imageDataUrls: imagesList,
    graphData: embeddedGraphData || (graphUrl ? { hasGraph: true, croppedGraphUrl: graphUrl } : undefined),
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

/**
 * Repairs and restores full question text, passage, choices, answers, and explanations
 * for an existing SATErrorItem using a matching RawSATQuestion, preserving all user notes and mastery.
 */
export function repairErrorItemFromRaw(
  existing: SATErrorItem,
  raw: RawSATQuestion
): SATErrorItem {
  const isMath = raw.section === 'Math';
  const { passageText, questionPrompt } = splitPassageAndPrompt(raw.question, raw.section, raw.explanations);

  let parsedGraphs: string[] = [];
  let embeddedGraphData: GraphData | undefined = undefined;

  if (typeof raw.graphs === 'string' && raw.graphs.trim().length > 0) {
    const trimmed = raw.graphs.trim();
    if (trimmed.startsWith('{')) {
      try {
        embeddedGraphData = JSON.parse(trimmed);
      } catch {
        parsedGraphs = [trimmed];
      }
    } else if (trimmed.startsWith('[')) {
      try {
        parsedGraphs = JSON.parse(trimmed);
      } catch {
        parsedGraphs = [trimmed];
      }
    } else {
      parsedGraphs = [trimmed];
    }
  } else if (Array.isArray(raw.graphs)) {
    parsedGraphs = raw.graphs;
  }

  const choices = formatSelections(raw.selections, isMath, parsedGraphs.length > 0 ? parsedGraphs : raw.graphs);
  const answerChoices: AnswerChoice[] =
    choices.length > 0
      ? choices.map((text, idx) => ({
          label: String.fromCharCode(65 + idx),
          text,
        }))
      : [];

  const fullQuestionText = raw.question?.trim() || (passageText ? `${passageText}\n\n${questionPrompt}` : questionPrompt);
  const graphUrl = embeddedGraphData?.croppedGraphUrl || (parsedGraphs.length > 0 ? parsedGraphs[0] : undefined);
  const imagesList = parsedGraphs.length > 0 ? parsedGraphs : (graphUrl ? [graphUrl] : undefined);

  return {
    ...existing,
    subject: raw.section === 'Reading and Writing' ? 'Reading & Writing' : 'Math',
    passageText: passageText || undefined,
    questionText: fullQuestionText,
    answerChoices: answerChoices.filter((c) => c.text.length > 0),
    correctAnswer: normalizeAnswer(raw.answers) || existing.correctAnswer,
    explanation: raw.explanations || existing.explanation,
    imageDataUrl: graphUrl || existing.imageDataUrl,
    imageDataUrls: imagesList || existing.imageDataUrls,
    graphData: embeddedGraphData || existing.graphData || (graphUrl ? { hasGraph: true, croppedGraphUrl: graphUrl } : undefined),
    testSource: raw.exam_name || existing.testSource,
  };
}
