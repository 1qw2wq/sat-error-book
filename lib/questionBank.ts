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

  let expl = explanation || '';
  let explAnalysis = expl;
  if (/中文解析|【解析】|解析[：:]/i.test(expl)) {
    explAnalysis = expl.substring(expl.search(/中文解析|【解析】|解析[：:]/i));
  }

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

  // Find passage & prompt split
  const promptMatch = normalized.match(/(?:Which (?:choice|finding|statement|quotation|sentence|idea|detail|claim|example)|Based on the|According to the|The student wants to|A student wants to)/i);
  const promptIdx = promptMatch && promptMatch.index !== undefined ? promptMatch.index : normalized.length;
  let passage = normalized.substring(0, promptIdx).trim();

  // If prompt asks about Text 1 vs Text 2
  const asksAboutText1 = /underlined\s+(?:portion|sentence|claim|words?|phrase|statement|idea|part)\s+(?:of|in)\s+Text\s*1/i.test(normalized);
  const asksAboutText2 = /underlined\s+(?:portion|sentence|claim|words?|phrase|statement|idea|part)\s+(?:of|in)\s+Text\s*2/i.test(normalized);

  let targetPassage = passage;
  if (asksAboutText1) {
    const t2Match = passage.match(/(?:\n\n|\n|\.\s+)(?:\*\*)?(?:Text\s*2|Passage\s*2)(?:\*\*)?/i);
    if (t2Match && t2Match.index !== undefined) {
      targetPassage = passage.substring(0, t2Match.index).trim();
    }
  } else if (asksAboutText2) {
    const t2Match = passage.match(/(?:\n\n|\n|\.\s+)(?:\*\*)?(?:Text\s*2|Passage\s*2)(?:\*\*)?[\s:\-–]*/i);
    if (t2Match && t2Match.index !== undefined) {
      targetPassage = passage.substring(t2Match.index + t2Match[0].length).trim();
    }
  }

  // Strip intro line from targetPassage for sentence extraction
  const cleanPassage = targetPassage.replace(/^(?:The following (?:text|passage)|This (?:text|passage)|Excerpt|Adapted from|In the following (?:text|passage))\s+(?:is|was|has been|from|adapted|excerpted|taken)[^\n]+?[\.\?!]["”']?\s*/i, '');

  // 1. Direct quote extraction in Chinese explanation: e.g. 划线...“...” or “...” with >= 15 chars
  const quotes: string[] = [];
  const quoteRegex = /[“"']([^“”"'\n]{6,250})[”"']/g;
  let qm: RegExpExecArray | null;
  while ((qm = quoteRegex.exec(explAnalysis)) !== null) {
    const qStr = qm[1].trim();
    if (qStr && /[A-Za-z]{3,}/.test(qStr)) {
      quotes.push(qStr);
    }
  }

  for (const qStr of quotes) {
    if (targetPassage.includes(qStr)) {
      if (qStr.length >= 20 || qStr.split(/\s+/).length >= 4) {
        return normalized.replace(qStr, `<u>${qStr}</u>`);
      }
      if (qStr.length >= 10 && (explAnalysis.includes('划线') || explAnalysis.includes('画线'))) {
        return normalized.replace(qStr, `<u>${qStr}</u>`);
      }
    }
  }

  // 2. Extract and match sentences
  const sentences = cleanPassage
    .split(/(?<=[.!?]["”']?)\s+(?=[A-Z“"\[0-9])/)
    .map((s) => s.replace(/^(?:\*\*)?(?:Text\s*[12AB]|Passage\s*[12AB])(?:\*\*)?[\s:\-–]*/i, '').trim())
    .filter((s) => s.length > 10 && targetPassage.includes(s));

  if (sentences.length > 0) {
    if (asksAboutText1) {
      if (/文本\s*1\s*(?:的)?(?:第一句|首句|开头)/i.test(explAnalysis)) {
        return normalized.replace(sentences[0], `<u>${sentences[0]}</u>`);
      }
      const last = sentences[sentences.length - 1];
      return normalized.replace(last, `<u>${last}</u>`);
    }
    if (asksAboutText2) {
      if (/文本\s*2\s*(?:的)?(?:第一句|首句|开头)/i.test(explAnalysis)) {
        return normalized.replace(sentences[0], `<u>${sentences[0]}</u>`);
      }
      const last = sentences[sentences.length - 1];
      return normalized.replace(last, `<u>${last}</u>`);
    }

    if (/第一句|首句|开头|第一句话/i.test(explAnalysis)) {
      return normalized.replace(sentences[0], `<u>${sentences[0]}</u>`);
    }
    if (/第二句|第二句话/i.test(explAnalysis) && sentences.length > 1) {
      return normalized.replace(sentences[1], `<u>${sentences[1]}</u>`);
    }
    if (/第三句|第三句话/i.test(explAnalysis) && sentences.length > 2) {
      return normalized.replace(sentences[2], `<u>${sentences[2]}</u>`);
    }
    if (/倒数第二句/i.test(explAnalysis) && sentences.length > 1) {
      const pen = sentences[sentences.length - 2];
      return normalized.replace(pen, `<u>${pen}</u>`);
    }
    if (/最后划线句子|最后一句|末句|结尾|最后一句话/i.test(explAnalysis)) {
      const last = sentences[sentences.length - 1];
      return normalized.replace(last, `<u>${last}</u>`);
    }

    if (/然而|但是|不过|转折|相反|却/i.test(explAnalysis)) {
      const turnSent = sentences.find((s) => /^(?:However|Yet|But|Nevertheless|Nonetheless|Conversely|In contrast|Despite|Although)\b/i.test(s));
      if (turnSent) {
        return normalized.replace(turnSent, `<u>${turnSent}</u>`);
      }
    }

    let bestSent: string | null = null;
    let maxScore = 0;
    for (const sent of sentences) {
      const words = sent.match(/\b[A-Za-z]{4,}\b/g) || [];
      let score = 0;
      for (const w of words) {
        if (explAnalysis.includes(w)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestSent = sent;
      }
    }

    if (bestSent && maxScore >= 2) {
      return normalized.replace(bestSent, `<u>${bestSent}</u>`);
    }

    const turnSent = sentences.find((s) => /^(?:However|Yet|But|Nevertheless|Nonetheless|Conversely|In contrast|Despite|Although)\b/i.test(s));
    if (turnSent) {
      return normalized.replace(turnSent, `<u>${turnSent}</u>`);
    }

    const last = sentences[sentences.length - 1];
    return normalized.replace(last, `<u>${last}</u>`);
  }

  return normalized;
}

/**
 * Ensures that if a passage ends with a student goal statement (e.g. "The student wants to...", "A student wants to..."),
 * that goal statement is cleaned, extracted from passageText, and attached to questionPrompt.
 */
export function ensureStudentGoalInPrompt(
  passage?: string,
  prompt?: string
): { passageText?: string; questionPrompt: string } {
  let displayPassage = passage?.trim() || '';
  let displayPrompt = prompt?.trim() || '';

  if (displayPassage) {
    const studentWantsMatch = displayPassage.match(
      /(?:\n+|(?:(?<=[\.\!\?]["”’']?)\s+)|(?:\s+))((?:[Tt]?he|A)\s+student(?:[\x27\u2019]s\s+goal\s+is\s+to|\s+(?:wants|intends|aims|would\s+like|wishes|is\s+trying))\b[\s\S]*)$/i
    );
    if (studentWantsMatch && studentWantsMatch.index !== undefined) {
      const passageClean = displayPassage.substring(0, studentWantsMatch.index).trim();
      let promptPrefix = studentWantsMatch[1].trim();
      promptPrefix = promptPrefix
        .replace(/^([hH]e|student)\s+student\b/i, 'The student')
        .replace(/^[hH]e\s+student\b/i, 'The student');

      if (passageClean.length > 15) {
        displayPassage = passageClean;
        if (!displayPrompt.toLowerCase().includes(promptPrefix.toLowerCase().slice(0, 20))) {
          displayPrompt = displayPrompt ? `${promptPrefix}\n\n${displayPrompt}` : promptPrefix;
        }
      }
    }
  }

  // Fix typos like "he student wants" -> "The student wants"
  displayPrompt = displayPrompt
    .replace(/^([hH]e|student)\s+student\b/i, 'The student')
    .replace(/^[hH]e\s+student\b/i, 'The student');

  return { passageText: displayPassage || undefined, questionPrompt: displayPrompt };
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

  // If cleanText starts with a Student Goal statement, it is purely a question prompt
  if (/^(?:(?:[Tt]?he|A)\s+student\s+(?:wants|intends|aims|would\s+like|wishes|is\s+trying)|(?:[Tt]?he|A)\s+student[\x27\u2019]?s\s+goal)\b/i.test(cleanText)) {
    return { questionPrompt: formatMathText(cleanText) };
  }

  // 1. First Priority: Detect Student Goal statement (e.g. "The student wants to...", "A student wants to...", "he student wants to...")
  const studentGoalPattern = /(?:\n+|(?:[\.\!\?]["”’\x27]?|<\/u>|<\/ins>|[-_–—]+\s*)\s*|\s+)(?=(?:(?:[Tt]?he|A)\s+student\s+(?:wants|intends|aims|would\s+like|wishes|is\s+trying)|(?:[Tt]?he|A)\s+student[\x27\u2019]?s\s+goal)\b)/i;

  const goalMatch = cleanText.match(studentGoalPattern);
  if (goalMatch && goalMatch.index !== undefined && goalMatch.index > 30) {
    let passage = cleanText.substring(0, goalMatch.index).trim();
    let prompt = cleanText.substring(goalMatch.index + goalMatch[0].length).trim();

    prompt = prompt
      .replace(/^([hH]e|student)\s+student\b/i, 'The student')
      .replace(/^[hH]e\s+student\b/i, 'The student');

    if (passage.length > 20 && prompt.length > 5) {
      return {
        passageText: formatMathText(passage),
        questionPrompt: formatMathText(prompt),
      };
    }
  }

  // 2. Rhetorical Synthesis notes prompt check (with comprehensive bullet list matching)
  const notesMatch = cleanText.match(/(?:following\s+)?notes\s*[:：][\s\S]*?(?:(?:\n\s*[*•▪‣◦⁃・∙·●■\u2022\u25cf\u2013\u2014\u25a0\u25a1\u25aa\u25ab\-–—]\s*[^\n]+)+)/i);
  if (notesMatch && notesMatch.index !== undefined) {
    const endOfNotesIdx = notesMatch.index + notesMatch[0].length;
    let passage = cleanText.substring(0, endOfNotesIdx).trim();
    let prompt = cleanText.substring(endOfNotesIdx).trim();

    const promptGoalMatch = prompt.match(/((?:[Tt]?he|A)\s+student\s+(?:wants|intends|aims|would\s+like|wishes)[\s\S]*)/i);
    if (promptGoalMatch) {
      prompt = promptGoalMatch[1].trim();
      prompt = prompt.replace(/^[hH]e\s+student\b/i, 'The student');
    }

    if (passage.length > 20 && prompt.length > 5) {
      return {
        passageText: formatMathText(passage),
        questionPrompt: formatMathText(prompt),
      };
    }
  }

  // 3. Match standard SAT prompt patterns cleanly (even when touching underscores, </u>, or punctuation)
  const promptPattern = /(?:\n+|(?:[\.\!\?]["”’']?|<\/u>|<\/ins>|[-_–—]+\s*)\s*)(?=(?:The\s+student\s+wants|A\s+student\s+wants|Which\s+choice|Which\s+finding|Which\s+quotation|Which\s+statement|Which\s+sentence|Which\s+idea|Which\s+detail|Which\s+claim|Which\s+illustration|Which\s+(?:of\s+the\s+following|option|phrase|word|excerpt|two)|Based\s+on\s+the\s+(?:text|texts|passage|passages|table|graph|chart)|According\s+to\s+the\s+(?:text|texts|passage|passages|table|speaker|author)|According\s+to\s+both\s+texts|What\s+does\s+the\s+(?:text|texts|speaker|author|narrator|character)|What\s+is\s+the\s+(?:main|primary|function|purpose)|What\s+best\s+describes|How\s+does\s+(?:the\s+author|the\s+speaker|the\s+text|Text\s+[12A-B])|Why\s+does\s+(?:the\s+author|the\s+speaker|the\s+character)|As\s+used\s+in\s+(?:the\s+text|line\s+\d+)|The\s+(?:primary|main)\s+purpose|The\s+author(?:['’]s)?\s+primary|The\s+speaker(?:['’]s)?\s+primary|The\s+narrator\s+indicates|In\s+the\s+(?:text|passage|poem|context)[,:]?|In\s+Text\s+[12A-B][,:]?|In\s+Passage\s+[12A-B][,:]?)\b)/i;

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

    const ensured = ensureStudentGoalInPrompt(passage, prompt);
    passage = ensured.passageText || passage;
    prompt = ensured.questionPrompt;

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
 * Extracts embedded choices (e.g. (A) ... (B) ... (C) ... (D) ...) from a question prompt.
 */
export function extractEmbeddedChoices(text: string): { cleanedPrompt: string; choices: string[] } {
  if (!text) return { cleanedPrompt: '', choices: [] };

  // Remove horizontal dividers like -----------------------------
  const cleanInput = text.replace(/(?:\r?\n\s*[-_=—~]{3,}\s*)+(?=(?:\r?\n|\s*\([A-D]\)|\s*[A-D][.)]))/g, '\n');

  // Check if choices section exists (starts with (A) or A. or A))
  const aMatch = cleanInput.search(/(?:^|\n)\s*(?:\([Aa]\)|[Aa][.)])\s+/);
  if (aMatch === -1) {
    return { cleanedPrompt: text, choices: [] };
  }

  const promptPart = cleanInput.substring(0, aMatch).trim();
  const choicesPart = cleanInput.substring(aMatch).trim();

  const choices: string[] = [];
  const regex = /(?:^|\n)\s*(?:\(([A-D])\)|([A-D])[.)])\s+([\s\S]+?)(?=(?:\n\s*(?:\([A-D]\)|[A-D][.)])\s+)|$)/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(choicesPart)) !== null) {
    const content = m[3].replace(/[-_=—~]{3,}/g, '').trim();
    if (content) {
      choices.push(content);
    }
  }

  if (choices.length >= 3 && promptPart.length > 10) {
    return {
      cleanedPrompt: promptPart,
      choices,
    };
  }

  return { cleanedPrompt: text, choices: [] };
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
