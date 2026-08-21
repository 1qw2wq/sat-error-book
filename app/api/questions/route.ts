import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RawSATQuestion, SATExamSummary, SATCombinedExamSummary, SATErrorItem } from '@/types/sat';
import { SAT_DOMAINS, classifyQuestionDomain } from '@/lib/satDomains';
import { repairErrorItemFromRaw, isDummyChoices } from '@/lib/questionBank';

// Server-side in-memory cache
let cachedQuestions: RawSATQuestion[] | null = null;
let cachedExamSummaries: SATExamSummary[] | null = null;
let cachedCombinedExams: SATCombinedExamSummary[] | null = null;

function loadQuestions(): RawSATQuestion[] {
  if (cachedQuestions) {
    return cachedQuestions;
  }
  try {
    const filePath = path.join(process.cwd(), 'all_questions.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      cachedQuestions = JSON.parse(raw) as RawSATQuestion[];
    } else {
      console.warn('all_questions.json not found at', filePath);
      cachedQuestions = [];
    }
  } catch (err) {
    console.error('Failed to load all_questions.json:', err);
    cachedQuestions = [];
  }
  return cachedQuestions;
}

function getExamBaseKey(name: string): string {
  return name
    .replace(/(?:阅读语法|数学|阅读|语法|Math|Reading and Writing|Reading & Writing|RW)[\s\S]*$/i, '')
    .trim();
}

function computeCombinedExams(exams: SATExamSummary[]): SATCombinedExamSummary[] {
  if (cachedCombinedExams) return cachedCombinedExams;

  const rwExams = exams.filter((e) => e.section === 'Reading and Writing');
  const mathExams = exams.filter((e) => e.section === 'Math');

  const combined: SATCombinedExamSummary[] = [];
  const seenIds = new Set<string>();

  // Extract all unique base keys
  const baseKeys = Array.from(
    new Set([
      ...rwExams.map((e) => getExamBaseKey(e.exam_name)),
      ...mathExams.map((e) => getExamBaseKey(e.exam_name)),
    ])
  ).filter(Boolean);

  baseKeys.forEach((baseKey) => {
    // Select the best (most complete) RW exam for this baseKey
    const candidateRWs = rwExams
      .filter((e) => getExamBaseKey(e.exam_name) === baseKey)
      .sort((a, b) => b.totalQuestions - a.totalQuestions);

    // Select the best (most complete) Math exam for this baseKey
    const candidateMaths = mathExams
      .filter((e) => getExamBaseKey(e.exam_name) === baseKey)
      .sort((a, b) => b.totalQuestions - a.totalQuestions);

    if (candidateRWs.length > 0 && candidateMaths.length > 0) {
      const rw = candidateRWs[0];
      const matchingMath = candidateMaths[0];
      const avgDiff =
        Math.round(
          ((rw.avgDifficulty * rw.totalQuestions + matchingMath.avgDifficulty * matchingMath.totalQuestions) /
            (rw.totalQuestions + matchingMath.totalQuestions)) *
            10
        ) / 10;

      let id = `full_${encodeURIComponent(baseKey)}`;
      let counter = 1;
      while (seenIds.has(id)) {
        id = `full_${encodeURIComponent(baseKey)}_${counter++}`;
      }
      seenIds.add(id);

      combined.push({
        id,
        title: `${baseKey} Complete Digital SAT Exam (Reading, Writing & Math)`,
        baseName: baseKey,
        category: rw.category || 'Official Past Exam',
        totalQuestions: rw.totalQuestions + matchingMath.totalQuestions,
        readingWritingExamName: rw.exam_name,
        readingWritingTotal: rw.totalQuestions,
        readingWritingM1: rw.module1Count,
        readingWritingM2: rw.module2Count,
        mathExamName: matchingMath.exam_name,
        mathTotal: matchingMath.totalQuestions,
        mathM1: matchingMath.module1Count,
        mathM2: matchingMath.module2Count,
        avgDifficulty: avgDiff,
        hasGraphs: rw.hasGraphs || matchingMath.hasGraphs,
      });
    }
  });

  cachedCombinedExams = combined;
  return cachedCombinedExams;
}

function computeExamSummaries(questions: RawSATQuestion[]): SATExamSummary[] {
  if (cachedExamSummaries) {
    return cachedExamSummaries;
  }

  const map = new Map<
    string,
    {
      exam_name: string;
      section: string;
      category: string;
      total: number;
      m1: number;
      m2: number;
      diffs: number[];
      hasGraphs: boolean;
    }
  >();

  for (const q of questions) {
    const key = q.exam_name || 'General SAT Test';
    let entry = map.get(key);
    if (!entry) {
      entry = {
        exam_name: key,
        section: q.section,
        category: q.category || '历年考题',
        total: 0,
        m1: 0,
        m2: 0,
        diffs: [],
        hasGraphs: false,
      };
      map.set(key, entry);
    }
    entry.total += 1;
    if (q.module === 'Module 1') entry.m1 += 1;
    if (q.module === 'Module 2') entry.m2 += 1;
    if (typeof q.difficulty === 'number') entry.diffs.push(q.difficulty);
    if (q.graphs && (Array.isArray(q.graphs) ? q.graphs.length > 0 : Boolean(q.graphs))) {
      entry.hasGraphs = true;
    }
  }

  cachedExamSummaries = Array.from(map.values()).map((e) => {
    const avgDiff = e.diffs.length > 0 ? e.diffs.reduce((a, b) => a + b, 0) / e.diffs.length : 7;
    return {
      exam_name: e.exam_name,
      section: e.section === 'Reading and Writing' || e.section === 'Math' ? e.section : 'Mixed',
      category: e.category,
      totalQuestions: e.total,
      module1Count: e.m1,
      module2Count: e.m2,
      avgDifficulty: Math.round(avgDiff * 10) / 10,
      difficulties: e.diffs,
      hasGraphs: e.hasGraphs,
    };
  });

  return cachedExamSummaries;
}

function matchesFilters(
  q: RawSATQuestion,
  filters: {
    section?: string | null;
    domain?: string | null;
    module?: string | null;
    year?: string | null;
    exam_name?: string | null;
    minDiff?: number | null;
    maxDiff?: number | null;
    type?: string | null;
    hasGraphs?: boolean | null;
  }
): boolean {
  if (filters.section && filters.section !== 'All' && q.section !== filters.section) {
    return false;
  }

  if (filters.domain && filters.domain !== 'All') {
    const qDomain = classifyQuestionDomain(q);
    if (qDomain !== filters.domain) {
      return false;
    }
  }

  if (filters.module && filters.module !== 'All' && q.module !== filters.module) {
    return false;
  }

  if (filters.year && filters.year !== 'All') {
    const examName = q.exam_name || '';
    if (!examName.includes(filters.year)) {
      return false;
    }
  }

  if (filters.exam_name && filters.exam_name !== 'All' && q.exam_name !== filters.exam_name) {
    return false;
  }

  if (filters.minDiff !== undefined && filters.minDiff !== null) {
    if (q.difficulty < filters.minDiff) return false;
  }

  if (filters.maxDiff !== undefined && filters.maxDiff !== null) {
    if (q.difficulty > filters.maxDiff) return false;
  }

  if (filters.type && filters.type !== 'All' && q.question_type !== filters.type) {
    return false;
  }

  if (filters.hasGraphs) {
    const hasG = q.graphs && (Array.isArray(q.graphs) ? q.graphs.length > 0 : Boolean(q.graphs));
    if (!hasG) return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'summary';
  const questions = loadQuestions();

  if (action === 'summary' || action === 'stats') {
    const exams = computeExamSummaries(questions);
    const rwCount = questions.filter((q) => q.section === 'Reading and Writing').length;
    const mathCount = questions.filter((q) => q.section === 'Math').length;
    const graphCount = questions.filter(
      (q) => q.graphs && (Array.isArray(q.graphs) ? q.graphs.length > 0 : Boolean(q.graphs))
    ).length;

    return NextResponse.json({
      success: true,
      totalQuestions: questions.length,
      readingWritingCount: rwCount,
      mathCount: mathCount,
      withGraphsCount: graphCount,
      totalExams: exams.length,
      exams,
    });
  }

  if (action === 'domains') {
    const rwQuestions = questions.filter((q) => q.section === 'Reading and Writing');
    const mathQuestions = questions.filter((q) => q.section === 'Math');

    const rwDomainCounts = new Map<string, number>();
    const mathDomainCounts = new Map<string, number>();

    for (const q of rwQuestions) {
      const domain = classifyQuestionDomain(q);
      rwDomainCounts.set(domain, (rwDomainCounts.get(domain) || 0) + 1);
    }

    for (const q of mathQuestions) {
      const domain = classifyQuestionDomain(q);
      mathDomainCounts.set(domain, (mathDomainCounts.get(domain) || 0) + 1);
    }

    const rwDomains = SAT_DOMAINS.filter((d) => d.section === 'Reading and Writing').map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      count: rwDomainCounts.get(d.name) || 0,
    }));

    const mathDomains = SAT_DOMAINS.filter((d) => d.section === 'Math').map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      count: mathDomainCounts.get(d.name) || 0,
    }));

    return NextResponse.json({
      success: true,
      rwDomains,
      mathDomains,
    });
  }

  if (action === 'pool_count') {
    const section = searchParams.get('section');
    const domain = searchParams.get('domain');
    const moduleFilter = searchParams.get('module');
    const year = searchParams.get('year');
    const examName = searchParams.get('exam_name');
    const minDiff = parseInt(searchParams.get('minDiff') || '1', 10);
    const maxDiff = parseInt(searchParams.get('maxDiff') || '10', 10);
    const type = searchParams.get('type');
    const hasGraphs = searchParams.get('hasGraphs') === 'true';

    const count = questions.filter((q) =>
      matchesFilters(q, {
        section,
        domain,
        module: moduleFilter,
        year,
        exam_name: examName,
        minDiff,
        maxDiff,
        type,
        hasGraphs,
      })
    ).length;

    return NextResponse.json({
      success: true,
      poolCount: count,
    });
  }

  if (action === 'exams') {
    const exams = computeExamSummaries(questions);
    const sectionFilter = searchParams.get('section');
    const filtered = sectionFilter
      ? exams.filter((e) => e.section === sectionFilter)
      : exams;
    return NextResponse.json({
      success: true,
      exams: filtered,
    });
  }

  if (action === 'combined_exams') {
    const exams = computeExamSummaries(questions);
    const combined = computeCombinedExams(exams);
    return NextResponse.json({
      success: true,
      combinedExams: combined,
    });
  }

  if (action === 'get_combined_exam') {
    const baseName = searchParams.get('base_name');
    const rwName = searchParams.get('rw_exam_name');
    const mathName = searchParams.get('math_exam_name');

    let rwQuestions: RawSATQuestion[] = [];
    let mathQuestions: RawSATQuestion[] = [];

    if (rwName) {
      rwQuestions = questions.filter((q) => q.exam_name === rwName);
    } else if (baseName) {
      rwQuestions = questions.filter(
        (q) => q.section === 'Reading and Writing' && getExamBaseKey(q.exam_name) === baseName
      );
    }

    if (mathName) {
      mathQuestions = questions.filter((q) => q.exam_name === mathName);
    } else if (baseName) {
      mathQuestions = questions.filter(
        (q) => q.section === 'Math' && getExamBaseKey(q.exam_name) === baseName
      );
    }

    // Sort RW: Module 1 first then Module 2, then question_no
    rwQuestions.sort((a, b) => {
      if (a.module !== b.module) return (a.module || '').localeCompare(b.module || '');
      return a.question_no - b.question_no;
    });

    // Sort Math: Module 1 first then Module 2, then question_no
    mathQuestions.sort((a, b) => {
      if (a.module !== b.module) return (a.module || '').localeCompare(b.module || '');
      return a.question_no - b.question_no;
    });

    const fullTest = [...rwQuestions, ...mathQuestions];

    return NextResponse.json({
      success: true,
      title: `${baseName || rwName || 'SAT'} Complete Exam`,
      total: fullTest.length,
      rwCount: rwQuestions.length,
      mathCount: mathQuestions.length,
      questions: fullTest,
    });
  }

  if (action === 'get_exam') {
    const examName = searchParams.get('exam_name');
    const moduleFilter = searchParams.get('module');

    if (!examName) {
      return NextResponse.json({ success: false, error: 'exam_name is required' }, { status: 400 });
    }

    let examQuestions = questions.filter((q) => q.exam_name === examName);
    if (moduleFilter) {
      examQuestions = examQuestions.filter((q) => q.module === moduleFilter);
    }

    // Sort by question_no ascending
    examQuestions.sort((a, b) => {
      if (a.module !== b.module) {
        return (a.module || '').localeCompare(b.module || '');
      }
      return a.question_no - b.question_no;
    });

    return NextResponse.json({
      success: true,
      exam_name: examName,
      total: examQuestions.length,
      questions: examQuestions,
    });
  }

  if (action === 'get_by_id') {
    const idParam = searchParams.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Valid id parameter required' }, { status: 400 });
    }

    const question = questions.find((q) => q.question_id === id);
    if (!question) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question });
  }

  if (action === 'pool_count') {
    const section = searchParams.get('section');
    const domain = searchParams.get('domain');
    const moduleFilter = searchParams.get('module');
    const year = searchParams.get('year');
    const examName = searchParams.get('exam_name');
    const minDiff = parseInt(searchParams.get('minDiff') || '5', 10);
    const maxDiff = parseInt(searchParams.get('maxDiff') || '10', 10);
    const type = searchParams.get('type');
    const hasGraphs = searchParams.get('hasGraphs') === 'true';
    const excludeParam = searchParams.get('excludeIds');

    const excludeSet = new Set<number>();
    if (excludeParam) {
      excludeParam.split(',').forEach((idStr) => {
        const idNum = parseInt(idStr.trim(), 10);
        if (!isNaN(idNum)) excludeSet.add(idNum);
      });
    }

    const pool = questions.filter((q) =>
      matchesFilters(q, {
        section,
        domain,
        module: moduleFilter,
        year,
        exam_name: examName,
        minDiff,
        maxDiff,
        type,
        hasGraphs,
      })
    );

    const unpracticedPool = pool.filter((q) => !excludeSet.has(q.question_id));

    return NextResponse.json({
      success: true,
      poolCount: pool.length,
      unpracticedCount: unpracticedPool.length,
    });
  }

  if (action === 'random' || action === 'builder_drill') {
    const count = Math.min(100, Math.max(1, parseInt(searchParams.get('count') || '20', 10)));
    const section = searchParams.get('section');
    const domain = searchParams.get('domain');
    const moduleFilter = searchParams.get('module');
    const year = searchParams.get('year');
    const examName = searchParams.get('exam_name');
    const minDiff = parseInt(searchParams.get('minDiff') || '5', 10);
    const maxDiff = parseInt(searchParams.get('maxDiff') || '10', 10);
    const type = searchParams.get('type');
    const hasGraphs = searchParams.get('hasGraphs') === 'true';
    const excludeParam = searchParams.get('excludeIds');

    const excludeSet = new Set<number>();
    if (excludeParam) {
      excludeParam.split(',').forEach((idStr) => {
        const idNum = parseInt(idStr.trim(), 10);
        if (!isNaN(idNum)) excludeSet.add(idNum);
      });
    }

    const pool = questions.filter((q) =>
      matchesFilters(q, {
        section,
        domain,
        module: moduleFilter,
        year,
        exam_name: examName,
        minDiff,
        maxDiff,
        type,
        hasGraphs,
      })
    );

    // Prioritize unpracticed questions:
    // If the user has not completed all questions from this filter, serve only unpracticed questions.
    // If all matching questions have been finished (or unpracticed < count), fill remaining with practiced questions.
    const unpracticedPool = pool.filter((q) => !excludeSet.has(q.question_id));
    const practicedPool = pool.filter((q) => excludeSet.has(q.question_id));

    // Fisher-Yates shuffle helper
    const shuffleArray = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledUnpracticed = shuffleArray(unpracticedPool);
    const shuffledPracticed = shuffleArray(practicedPool);

    let selected: RawSATQuestion[] = [];
    if (shuffledUnpracticed.length >= count) {
      // Plenty of unpracticed questions available
      selected = shuffledUnpracticed.slice(0, count);
    } else if (shuffledUnpracticed.length > 0) {
      // Take all remaining unpracticed questions, fill the rest from practiced questions
      const needed = count - shuffledUnpracticed.length;
      selected = [...shuffledUnpracticed, ...shuffledPracticed.slice(0, needed)];
    } else {
      // All questions in this filter have been completed by the user: recycle the pool
      selected = shuffledPracticed.slice(0, count);
    }

    return NextResponse.json({
      success: true,
      count: selected.length,
      totalAvailable: pool.length,
      unpracticedCount: unpracticedPool.length,
      questions: selected,
    });
  }

  if (action === 'search') {
    const qQuery = (searchParams.get('q') || '').trim().toLowerCase();
    const section = searchParams.get('section');
    const moduleFilter = searchParams.get('module');
    const examName = searchParams.get('exam_name');
    const difficultyParam = searchParams.get('difficulty');
    const typeParam = searchParams.get('type');
    const onlyGraphs = searchParams.get('hasGraphs') === 'true';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const filtered = questions.filter((q) => {
      if (section && section !== 'All' && q.section !== section) return false;
      if (moduleFilter && moduleFilter !== 'All' && q.module !== moduleFilter) return false;
      if (examName && examName !== 'All' && q.exam_name !== examName) return false;
      if (difficultyParam && difficultyParam !== 'All') {
        const diffNum = parseInt(difficultyParam, 10);
        if (!isNaN(diffNum) && q.difficulty !== diffNum) return false;
      }
      if (typeParam && typeParam !== 'All' && q.question_type !== typeParam) return false;
      if (onlyGraphs) {
        if (!q.graphs || (Array.isArray(q.graphs) && q.graphs.length === 0)) return false;
      }
      if (qQuery) {
        const matchId = String(q.question_id).includes(qQuery);
        const matchQuestion = q.question.toLowerCase().includes(qQuery);
        const matchExam = (q.exam_name || '').toLowerCase().includes(qQuery);
        const matchExpl = (q.explanations || '').toLowerCase().includes(qQuery);
        if (!matchId && !matchQuestion && !matchExam && !matchExpl) return false;
      }
      return true;
    });

    const totalMatches = filtered.length;
    const startIndex = (page - 1) * limit;
    const paged = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      total: totalMatches,
      page,
      limit,
      totalPages: Math.ceil(totalMatches / limit),
      questions: paged,
    });
  }

  if (action === 'lookup') {
    const idParam = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    if (idParam) {
      const targetId = parseInt(idParam, 10);
      const found = questions.find((q) => q.question_id === targetId);
      return NextResponse.json({ success: true, question: found || null });
    }
    if (idsParam) {
      const targetIds = new Set(
        idsParam
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((n) => !isNaN(n))
      );
      const foundList = questions.filter((q) => targetIds.has(q.question_id));
      return NextResponse.json({ success: true, questions: foundList });
    }
    return NextResponse.json({ success: false, error: 'No id or ids provided' }, { status: 400 });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, question, items } = body;

    if (action === 'update_question' && question && question.question_id) {
      const questions = loadQuestions();
      const idx = questions.findIndex((q) => q.question_id === question.question_id);
      if (idx !== -1) {
        questions[idx] = { ...questions[idx], ...question };
      } else {
        questions.push(question);
      }

      // Persist to all_questions.json
      const filePath = path.join(process.cwd(), 'all_questions.json');
      fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');

      // Invalidate caches
      cachedQuestions = questions;
      cachedExamSummaries = null;
      cachedCombinedExams = null;

      return NextResponse.json({ success: true, question });
    }

    if (action === 'restore_error_items' && Array.isArray(items)) {
      const errorItems = items as SATErrorItem[];
      const questions = loadQuestions();
      const questionMap = new Map<number, RawSATQuestion>();
      for (const q of questions) {
        questionMap.set(q.question_id, q);
      }

      let restoredCount = 0;
      const updatedItems = errorItems.map((item) => {
        let matchedRaw: RawSATQuestion | undefined = undefined;

        // 1. Direct ID match in item.id
        const idMatch = item.id.match(/(?:sat_q_|err-?)(\d+)/i);
        if (idMatch) {
          const parsed = parseInt(idMatch[1], 10);
          if (questionMap.has(parsed)) {
            matchedRaw = questionMap.get(parsed);
          }
        }

        // 2. ID match in userNotes or testSource
        if (!matchedRaw && item.userNotes) {
          const notesIdMatch = item.userNotes.match(/(?:sat_q_|Q#\s*|question_id\s*:\s*)(\d+)/i);
          if (notesIdMatch) {
            const parsed = parseInt(notesIdMatch[1], 10);
            if (questionMap.has(parsed)) {
              matchedRaw = questionMap.get(parsed);
            }
          }
        }

        // 3. Robust word overlap matching across bank
        if (!matchedRaw && item.questionText) {
          const cleanItem = item.questionText
            .replace(/<[^>]+>/g, ' ')
            .replace(/[$_\\{}]/g, ' ')
            .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

          const words = cleanItem.split(' ').filter((w) => w.length > 3);

          if (words.length >= 3) {
            let maxScore = 0;
            let candidate: RawSATQuestion | undefined = undefined;

            for (const q of questions) {
              const cleanQ = q.question
                .replace(/<[^>]+>/g, ' ')
                .replace(/[$_\\{}]/g, ' ')
                .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

              let matchCount = 0;
              for (const w of words) {
                if (cleanQ.includes(w)) matchCount++;
              }
              const score = matchCount / words.length;
              if (score > maxScore && score >= 0.5) {
                maxScore = score;
                candidate = q;
              }
            }

            if (candidate) {
              matchedRaw = candidate;
            }
          }
        }

        if (matchedRaw) {
          restoredCount++;
          return repairErrorItemFromRaw(item, matchedRaw);
        }

        // Clean up dummy choices if present
        if (isDummyChoices(item.answerChoices)) {
          return {
            ...item,
            answerChoices: [],
          };
        }

        return item;
      });

      return NextResponse.json({
        success: true,
        restoredCount,
        items: updatedItems,
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported POST action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
