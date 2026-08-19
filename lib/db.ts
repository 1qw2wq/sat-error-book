import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SATErrorItem, ReviewLog, UserStats, VocabItem } from '@/types/sat';

interface SatBookDB extends DBSchema {
  errors: {
    key: string;
    value: SATErrorItem;
    indexes: {
      'by-subject': string;
      'by-subTopic': string;
      'by-masteryStatus': string;
      'by-nextReviewDate': string;
    };
  };
  review_logs: {
    key: string;
    value: ReviewLog;
    indexes: {
      'by-errorId': string;
    };
  };
  user_stats: {
    key: string;
    value: UserStats;
  };
  vocab: {
    key: string;
    value: VocabItem;
    indexes: {
      'by-word': string;
      'by-createdAt': string;
    };
  };
}

const DB_NAME = 'SatErrorBookDatabase';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SatBookDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<SatBookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Errors Store
        if (!db.objectStoreNames.contains('errors')) {
          const errorStore = db.createObjectStore('errors', { keyPath: 'id' });
          errorStore.createIndex('by-subject', 'subject');
          errorStore.createIndex('by-subTopic', 'subTopic');
          errorStore.createIndex('by-masteryStatus', 'masteryStatus');
          errorStore.createIndex('by-nextReviewDate', 'nextReviewDate');
        }

        // Review Logs Store
        if (!db.objectStoreNames.contains('review_logs')) {
          const logStore = db.createObjectStore('review_logs', { keyPath: 'id' });
          logStore.createIndex('by-errorId', 'errorId');
        }

        // User Stats Store
        if (!db.objectStoreNames.contains('user_stats')) {
          db.createObjectStore('user_stats', { keyPath: 'id' });
        }

        // Vocab Store
        if (!db.objectStoreNames.contains('vocab')) {
          const vocabStore = db.createObjectStore('vocab', { keyPath: 'id' });
          vocabStore.createIndex('by-word', 'word');
          vocabStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export function createDefaultSeedVocab(): VocabItem[] {
  return [
    {
      id: 'seed-vocab-1',
      word: 'Eminent',
      definition: 'Famous, respected, or prominent within a particular sphere or profession.',
      partOfSpeech: 'adjective',
      exampleSentence: 'The panel featured an eminent scientist known for pioneering research in cellular biology.',
      synonyms: ['Distinguished', 'Renowned', 'Prominent', 'Prestigious'],
      satTip: 'Do not confuse with "Imminent" (about to happen) or "Immanent" (inherent).',
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      masteryStatus: 'Learning',
    },
    {
      id: 'seed-vocab-2',
      word: 'Imminent',
      definition: 'About to happen; impending or fast approaching.',
      partOfSpeech: 'adjective',
      exampleSentence: 'Dark storm clouds gathered over the horizon, signaling that rainfall was imminent.',
      synonyms: ['Impending', 'Approaching', 'Looming', 'Unavoidable'],
      satTip: 'Often used in SAT reading passages describing sudden environmental shifts or urgent political crises.',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      masteryStatus: 'Confused',
    },
    {
      id: 'seed-vocab-3',
      word: 'Equivocal',
      definition: 'Open to more than one interpretation; ambiguous or misleading.',
      partOfSpeech: 'adjective',
      exampleSentence: 'The candidate gave an equivocal response when asked about tax policy, avoiding a direct stance.',
      synonyms: ['Ambiguous', 'Evasive', 'Vague', 'Noncommittal'],
      satTip: 'Root "equi-" (equal) + "voc" (voice) = speaking with equal voices so neither side is clear.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      masteryStatus: 'Learning',
    },
    {
      id: 'seed-vocab-4',
      word: 'Pragmatic',
      definition: 'Dealing with things sensibly and realistically based on practical considerations rather than theoretical ones.',
      partOfSpeech: 'adjective',
      exampleSentence: 'Taking a pragmatic approach, the architect prioritized structural durability over ornate decoration.',
      synonyms: ['Practical', 'Utilitarian', 'Sensible', 'Down-to-earth'],
      satTip: 'Frequently appears when contrast is drawn between idealistic theory and practical reality.',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      masteryStatus: 'Mastered',
    },
    {
      id: 'seed-vocab-5',
      word: 'Substantiate',
      definition: 'Provide evidence to support or prove the truth of an argument or claim.',
      partOfSpeech: 'verb',
      exampleSentence: 'The researcher cited multiple empirical studies to substantiate her groundbreaking hypothesis.',
      synonyms: ['Corroborate', 'Validate', 'Verify', 'Authenticate'],
      satTip: 'Crucial verb in SAT Command of Evidence questions asking which quote best substantiates a point.',
      createdAt: new Date().toISOString(),
      masteryStatus: 'Learning',
    },
  ];
}

// Sample initial data generator
export function createDefaultSeedErrors(): SATErrorItem[] {
  const now = new Date();
  const todayIso = now.toISOString();

  return [
    {
      id: 'seed-1',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      subject: 'Math',
      subTopic: 'Advanced Math',
      questionText: 'For what value of $x$ is the expression $\\frac{3x - 12}{x^2 - 16}$ undefined, given $x > 0$?',
      answerChoices: [
        { label: 'A', text: '$x = 0$' },
        { label: 'B', text: '$x = 3$' },
        { label: 'C', text: '$x = 4$' },
        { label: 'D', text: '$x = 16$' },
      ],
      correctAnswer: 'C',
      aiTakeaway: 'A rational expression is undefined when its denominator equals zero. Factor $x^2 - 16 = (x-4)(x+4)$, giving $x = 4$ or $x = -4$. Since $x > 0$, $x = 4$.',
      explanation: 'Set denominator $x^2 - 16 = 0 \\implies x^2 = 16 \\implies x = 4$ or $-4$. The problem statement restricts $x > 0$, so the only valid value is $x = 4$.',
      userNotes: 'Forgot to check the x > 0 constraint at first!',
      mistakeType: 'Careless Error',
      masteryStatus: 'Confused',
      masteryLevel: 0,
      nextReviewDate: todayIso,
      reviewHistory: [],
      testSource: 'Bluebook Practice Test 1',
      difficulty: 'Medium',
    },
    {
      id: 'seed-graph-1',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      subject: 'Math',
      subTopic: 'Algebra',
      questionText: 'The line shown in the $xy$-plane represents the linear function $f(x)$. What is the $y$-intercept of the graph of $f(x)$?',
      answerChoices: [
        { label: 'A', text: '$(0, -3)$' },
        { label: 'B', text: '$(0, 6)$' },
        { label: 'C', text: '$(8, 0)$' },
        { label: 'D', text: '$(0, 8)$' },
      ],
      correctAnswer: 'B',
      aiTakeaway: 'The $y$-intercept of a linear graph $y = mx + b$ is the point where $x = 0$, giving $(0, b)$. From $y = -0.75x + 6$, setting $x = 0$ gives $(0, 6)$.',
      explanation: 'The equation of the line is $y = -0.75x + 6$. Substituting $x = 0$ yields $y = 6$. Therefore, the $y$-intercept is at point $(0, 6)$.',
      graphData: {
        hasGraph: true,
        graphType: 'linear',
        title: 'Graph of linear function f(x)',
        xAxisLabel: 'x',
        yAxisLabel: 'y',
        equation: 'y = -0.75x + 6',
        points: [
          { x: 0, y: 6, label: '(0, 6)' },
          { x: 8, y: 0, label: '(8, 0)' },
        ],
        description: 'A line passing through (0, 6) on the y-axis and (8, 0) on the x-axis with a negative slope of -0.75.',
      },
      userNotes: 'Careful not to mix up x-intercept (8, 0) with y-intercept (0, 6)!',
      mistakeType: 'Misread Question',
      masteryStatus: 'Confused',
      masteryLevel: 0,
      nextReviewDate: todayIso,
      reviewHistory: [],
      testSource: 'College Board Sample Set',
      difficulty: 'Medium',
    },
    {
      id: 'seed-2',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      subject: 'Reading & Writing',
      subTopic: 'Craft & Structure',
      questionText: 'The author\'s primary purpose in discussing the recent discoveries in deep-sea hydrothermal vents is to—',
      answerChoices: [
        { label: 'A', text: 'refute a long-held scientific consensus regarding the origin of chemosynthetic bacteria.' },
        { label: 'B', text: 'illustrate how extreme environments can sustain metabolic pathways previously thought impossible.' },
        { label: 'C', text: 'advocate for immediate technological upgrades in submersible ocean exploration vessels.' },
        { label: 'D', text: 'compare marine ecosystems near fault lines with those found in shallower coastal waters.' },
      ],
      correctAnswer: 'B',
      aiTakeaway: 'In purpose questions, choose the option that explains *why* the author includes the detail rather than just summarizing what it says. Paragraph 2 explicitly connects hydrothermal vents to novel metabolic processes.',
      explanation: 'The passage highlights that organisms around hydrothermal vents derive energy from sulfur compounds without sunlight, demonstrating extreme environment metabolic viability.',
      userNotes: 'Picked A because it sounded scientific, but the author didn\'t "refute" a consensus.',
      mistakeType: 'Misread Question',
      masteryStatus: 'Learning',
      masteryLevel: 1,
      nextReviewDate: todayIso,
      reviewHistory: [],
      testSource: 'Official SAT Guide',
      difficulty: 'Hard',
    },
    {
      id: 'seed-3',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      subject: 'Math',
      subTopic: 'Algebra',
      questionText: 'If $4x + 2y = 18$ and $2x - y = 5$, what is the value of $6x + y$?',
      answerChoices: [
        { label: 'A', text: '$13$' },
        { label: 'B', text: '$23$' },
        { label: 'C', text: '$28$' },
        { label: 'D', text: '$31$' },
      ],
      correctAnswer: 'B',
      aiTakeaway: 'Look for shortcuts in systems of equations! Adding Equation 1 ($4x + 2y = 18$) and Equation 2 ($2x - y = 5$) directly gives $6x + y = 23$ in one step without solving for $x$ or $y$ individually.',
      explanation: 'Direct addition: $(4x + 2y) + (2x - y) = 18 + 5 \\implies 6x + y = 23$. Always check if adding or subtracting equations yields the exact expression requested.',
      userNotes: 'Solved x=3.5, y=2 manually and took 2 minutes when I could have added the equations in 10 seconds!',
      mistakeType: 'Time Pressure',
      masteryStatus: 'Confused',
      masteryLevel: 0,
      nextReviewDate: todayIso,
      reviewHistory: [],
      testSource: 'Khan Academy SAT',
      difficulty: 'Easy',
    },
    {
      id: 'seed-4',
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      subject: 'Reading & Writing',
      subTopic: 'Standard English Conventions',
      questionText: 'Researchers analyzing the ancient tablet noted that its intricate carvings______ preserved despite centuries of atmospheric exposure.',
      answerChoices: [
        { label: 'A', text: 'were remarkably' },
        { label: 'B', text: 'was remarkably' },
        { label: 'C', text: 'has been remarkably' },
        { label: 'D', text: 'is remarkably' },
      ],
      correctAnswer: 'A',
      aiTakeaway: 'Match plural subject "carvings" with plural verb "were". Ignore intervening prepositional phrases like "of the tablet".',
      explanation: 'The true subject is plural "carvings" (not singular "tablet"), requiring plural past verb "were".',
      userNotes: 'Got distracted by "tablet" right before the verb.',
      mistakeType: 'Careless Error',
      masteryStatus: 'Mastered',
      masteryLevel: 3,
      nextReviewDate: new Date(Date.now() + 86400000 * 14).toISOString(),
      reviewHistory: [],
      testSource: 'Bluebook Practice Test 2',
      difficulty: 'Easy',
    }
  ];
}

// Data Operations
export async function getAllErrors(): Promise<SATErrorItem[]> {
  const db = await getDB();
  const errors = await db.getAll('errors');
  const stats = await db.get('user_stats', 'default_user');

  if (stats && !stats.isInitialSeeded && errors.length > 0) {
    stats.isInitialSeeded = true;
    await db.put('user_stats', stats);
  }

  if (errors.length === 0 && !stats?.isInitialSeeded) {
    const seed = createDefaultSeedErrors();
    const tx = db.transaction('errors', 'readwrite');
    for (const item of seed) {
      await tx.store.put(item);
    }
    await tx.done;

    const userStats = await getUserStats();
    userStats.isInitialSeeded = true;
    userStats.totalLogged = seed.length;
    await db.put('user_stats', userStats);

    return seed;
  }

  // Sort by created at descending
  return errors.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getErrorById(id: string): Promise<SATErrorItem | undefined> {
  const db = await getDB();
  return db.get('errors', id);
}

export async function saveError(error: SATErrorItem): Promise<void> {
  const db = await getDB();
  await db.put('errors', error);
  const stats = await getUserStats();
  stats.isInitialSeeded = true;
  await db.put('user_stats', stats);
  await updateStatsOnSave();
}

export async function deleteError(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('errors', id);
  const stats = await getUserStats();
  stats.isInitialSeeded = true;
  await db.put('user_stats', stats);
  await updateStatsOnSave();
}

export async function importErrorsBatch(importedItems: SATErrorItem[]): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('errors', 'readwrite');
  let count = 0;
  for (const item of importedItems) {
    if (item && item.id && item.subject && item.questionText) {
      await tx.store.put(item);
      count++;
    }
  }
  await tx.done;

  const stats = await getUserStats();
  stats.isInitialSeeded = true;
  await db.put('user_stats', stats);
  await updateStatsOnSave();

  return count;
}

export async function recordReview(
  errorId: string,
  rating: 'confused' | 'learning' | 'mastered',
  timeSpentSeconds: number
): Promise<SATErrorItem> {
  const db = await getDB();
  const item = await db.get('errors', errorId);
  if (!item) throw new Error('Error item not found');

  const now = new Date();
  let nextLevel = item.masteryLevel || 0;
  let nextStatus = item.masteryStatus;
  let daysToAdd = 1;

  if (rating === 'confused') {
    nextLevel = 0;
    nextStatus = 'Confused';
    daysToAdd = 1; // re-queue tomorrow
  } else if (rating === 'learning') {
    nextLevel = Math.max(1, nextLevel + 1);
    nextStatus = 'Learning';
    daysToAdd = 3; // re-queue in 3 days
  } else if (rating === 'mastered') {
    nextLevel = Math.max(3, nextLevel + 2);
    nextStatus = 'Mastered';
    daysToAdd = 14; // master deck
  }

  const nextDate = new Date(now.getTime() + daysToAdd * 86400000).toISOString();

  const reviewLog: ReviewLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    errorId,
    timestamp: now.toISOString(),
    rating,
    timeSpentSeconds,
  };

  const updatedItem: SATErrorItem = {
    ...item,
    masteryLevel: nextLevel,
    masteryStatus: nextStatus,
    nextReviewDate: nextDate,
    reviewHistory: [...(item.reviewHistory || []), reviewLog],
  };

  await db.put('errors', updatedItem);
  await db.put('review_logs', reviewLog);

  // Update study streak
  await recordStudyActivity();

  return updatedItem;
}

export async function getUserStats(): Promise<UserStats> {
  const db = await getDB();
  let stats = await db.get('user_stats', 'default_user');

  const errors = await db.getAll('errors');
  const totalLogged = errors.length;
  const totalMastered = errors.filter((e) => e.masteryStatus === 'Mastered').length;

  if (!stats) {
    stats = {
      id: 'default_user',
      streakDays: 1,
      lastStudyDate: new Date().toISOString().split('T')[0],
      totalLogged,
      totalMastered,
      totalReviewsCompleted: 0,
      studyDates: [new Date().toISOString().split('T')[0]],
    };
    await db.put('user_stats', stats);
  } else {
    stats.totalLogged = totalLogged;
    stats.totalMastered = totalMastered;
  }

  return stats;
}

async function updateStatsOnSave(): Promise<void> {
  const db = await getDB();
  const errors = await db.getAll('errors');
  const stats = await getUserStats();
  stats.totalLogged = errors.length;
  stats.totalMastered = errors.filter((e) => e.masteryStatus === 'Mastered').length;
  await db.put('user_stats', stats);
}

export async function recordStudyActivity(): Promise<UserStats> {
  const db = await getDB();
  const stats = await getUserStats();
  const today = new Date().toISOString().split('T')[0];

  const lastDate = stats.lastStudyDate;
  const studyDates = new Set(stats.studyDates || []);
  studyDates.add(today);

  let newStreak = stats.streakDays;

  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1; // streak reset or new start
    }
  }

  const updatedStats: UserStats = {
    ...stats,
    streakDays: newStreak,
    lastStudyDate: today,
    totalReviewsCompleted: stats.totalReviewsCompleted + 1,
    studyDates: Array.from(studyDates),
  };

  await db.put('user_stats', updatedStats);
  return updatedStats;
}

// Vocab Operations
export async function getAllVocab(): Promise<VocabItem[]> {
  const db = await getDB();
  const items = await db.getAll('vocab');

  if (items.length === 0) {
    const seed = createDefaultSeedVocab();
    const tx = db.transaction('vocab', 'readwrite');
    for (const v of seed) {
      await tx.store.put(v);
    }
    await tx.done;
    return seed;
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getVocabById(id: string): Promise<VocabItem | undefined> {
  const db = await getDB();
  return db.get('vocab', id);
}

export async function saveVocab(vocab: VocabItem): Promise<void> {
  const db = await getDB();
  await db.put('vocab', vocab);
}

export async function deleteVocab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('vocab', id);
}

export async function importVocabBatch(importedItems: VocabItem[]): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('vocab', 'readwrite');
  let count = 0;
  for (const item of importedItems) {
    if (item && item.id && item.word) {
      await tx.store.put(item);
      count++;
    }
  }
  await tx.done;
  return count;
}

export interface FullDatabaseBackup {
  version: number;
  exportedAt: string;
  errors: SATErrorItem[];
  vocab: VocabItem[];
  userStats?: UserStats;
}

export async function exportFullDatabase(): Promise<FullDatabaseBackup> {
  const errors = await getAllErrors();
  const vocab = await getAllVocab();
  const userStats = await getUserStats();

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    errors,
    vocab,
    userStats,
  };
}

export interface ImportResult {
  errorsImported: number;
  vocabImported: number;
}

export async function importFullDatabase(data: any): Promise<ImportResult> {
  let errorsImported = 0;
  let vocabImported = 0;

  if (!data) return { errorsImported: 0, vocabImported: 0 };

  // Case 1: Structured backup object with { errors, vocab, userStats }
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(data.errors)) {
      errorsImported = await importErrorsBatch(data.errors);
    }
    if (Array.isArray(data.vocab)) {
      vocabImported = await importVocabBatch(data.vocab);
    }
    if (data.userStats) {
      const db = await getDB();
      await db.put('user_stats', data.userStats);
    }
  }
  // Case 2: Array of items (legacy or direct array)
  else if (Array.isArray(data)) {
    const errorItems: SATErrorItem[] = [];
    const vocabItems: VocabItem[] = [];

    for (const item of data) {
      if (!item) continue;
      if (item.questionText || item.correctAnswer || item.subject) {
        errorItems.push(item);
      } else if (item.word || item.definition) {
        vocabItems.push(item);
      }
    }

    if (errorItems.length > 0) {
      errorsImported = await importErrorsBatch(errorItems);
    }
    if (vocabItems.length > 0) {
      vocabImported = await importVocabBatch(vocabItems);
    }
  }

  return { errorsImported, vocabImported };
}

// =========================================================================
// PRACTICE BUILDER PRESETS & HISTORY PERSISTENCE (Zero Data Loss)
// =========================================================================

import { PracticePreset, PracticeHistoryItem, SavedTestSession } from '@/types/sat';

const PRESETS_STORAGE_KEY = 'sat_practice_builder_presets_v1';
const HISTORY_STORAGE_KEY = 'sat_practice_builder_history_v1';
const SAVED_TESTS_STORAGE_KEY = 'sat_saved_test_sessions_v1';

export function getDefaultPracticePresets(): PracticePreset[] {
  return [
    {
      id: 'preset-vocab-blitz',
      title: 'Vocabulary & Context Precision',
      description: 'Master Words in Context with high-yield academic vocabulary questions.',
      section: 'Reading and Writing',
      domain: 'Craft & Structure: Words in Context',
      module: 'All',
      year: 'All',
      exam: 'All',
      difficultyRange: [5, 10],
      type: 'Single Choice',
      onlyGraphs: false,
      questionCount: 15,
      timerMode: 'speed60',
      deliveryMode: 'instant_feedback',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'preset-grammar-mastery',
      title: 'Standard English Conventions Drill',
      description: 'Sentence boundaries, subject-verb agreement, and punctuation rules.',
      section: 'Reading and Writing',
      domain: 'Standard English Conventions (Grammar & Punctuation)',
      module: 'All',
      year: 'All',
      exam: 'All',
      difficultyRange: [5, 10],
      type: 'Single Choice',
      onlyGraphs: false,
      questionCount: 20,
      timerMode: 'official',
      deliveryMode: 'exam',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'preset-math-hard-gridin',
      title: 'Hard Math Student-Produced Responses',
      description: 'Tackle high-difficulty grid-in / free response questions with zero guessing room.',
      section: 'Math',
      domain: 'All',
      module: 'Module 2',
      year: 'All',
      exam: 'All',
      difficultyRange: [5, 6],
      type: 'Fill-in-the-Blank / Free Response',
      onlyGraphs: false,
      questionCount: 12,
      timerMode: 'official',
      deliveryMode: 'instant_feedback',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'preset-geom-trig-visuals',
      title: 'Geometry & Data Visuals Sprint',
      description: 'Only questions with diagrams, figures, coordinate planes, and geometric models.',
      section: 'Math',
      domain: 'Geometry & Trigonometry',
      module: 'All',
      year: 'All',
      exam: 'All',
      difficultyRange: [5, 10],
      type: 'All',
      onlyGraphs: true,
      questionCount: 10,
      timerMode: 'official',
      deliveryMode: 'exam',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'preset-elite-800-booster',
      title: 'Elite 800 Adaptive Challenge (Tier 5-6 Hardest)',
      description: 'Toughest questions across Advanced Math, Inferences, and Rhetorical Synthesis.',
      section: 'All',
      domain: 'All',
      module: 'Module 2',
      year: 'All',
      exam: 'All',
      difficultyRange: [5, 6],
      type: 'All',
      onlyGraphs: false,
      questionCount: 20,
      timerMode: 'official',
      deliveryMode: 'exam',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

export function getSavedPracticePresets(): PracticePreset[] {
  if (typeof window === 'undefined') return getDefaultPracticePresets();
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultPracticePresets();
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return getDefaultPracticePresets();
  } catch (err) {
    console.error('Failed to load practice presets from localStorage:', err);
    return getDefaultPracticePresets();
  }
}

export function savePracticePreset(preset: PracticePreset): PracticePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getSavedPracticePresets();
    const existingIdx = current.findIndex((p) => p.id === preset.id);
    let updated: PracticePreset[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = preset;
    } else {
      updated = [preset, ...current];
    }
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save practice preset to localStorage:', err);
    return [];
  }
}

export function deletePracticePreset(id: string): PracticePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getSavedPracticePresets();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete practice preset from localStorage:', err);
    return [];
  }
}

export function getPracticeHistory(): PracticeHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load practice history from localStorage:', err);
    return [];
  }
}

export function addPracticeHistoryItem(item: PracticeHistoryItem): PracticeHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getPracticeHistory();
    const updated = [item, ...current].slice(0, 50); // Keep last 50 practice tests
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save practice history to localStorage:', err);
    return [];
  }
}

export function deletePracticeHistoryItem(id: string): PracticeHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getPracticeHistory();
    const updated = current.filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete practice history item from localStorage:', err);
    return [];
  }
}

export function clearPracticeHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear practice history:', err);
  }
}

// =========================================================================
// SAVED / PAUSED TEST SESSIONS (Save & Exit Engine)
// =========================================================================

export function getSavedTestSessions(): SavedTestSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_TESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load saved test sessions from localStorage:', err);
    return [];
  }
}

export function saveTestSession(session: SavedTestSession): SavedTestSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getSavedTestSessions();
    const existingIdx = current.findIndex((s) => s.id === session.id);
    let updated: SavedTestSession[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = session;
    } else {
      updated = [session, ...current];
    }
    localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save test session to localStorage:', err);
    return [];
  }
}

export function deleteSavedTestSession(id: string): SavedTestSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getSavedTestSessions();
    const updated = current.filter((s) => s.id !== id);
    localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete saved test session from localStorage:', err);
    return [];
  }
}

// =========================================================================
// PRACTICE HISTORY & SAVED SESSIONS EXPORT / IMPORT ENGINE
// =========================================================================

export interface HistoryBackupBundle {
  version: number;
  exportedAt: string;
  history: PracticeHistoryItem[];
  savedSessions: SavedTestSession[];
}

export function exportPracticeHistoryBundle(): HistoryBackupBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history: getPracticeHistory(),
    savedSessions: getSavedTestSessions(),
  };
}

export function importPracticeHistoryBundle(jsonContent: string): { historyCount: number; savedSessionsCount: number } {
  if (typeof window === 'undefined') return { historyCount: 0, savedSessionsCount: 0 };

  try {
    const data = JSON.parse(jsonContent);
    let importedHistory: PracticeHistoryItem[] = [];
    let importedSessions: SavedTestSession[] = [];

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (Array.isArray(data.history)) {
        importedHistory = data.history;
      }
      if (Array.isArray(data.savedSessions)) {
        importedSessions = data.savedSessions;
      }
    } else if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.completedAt && item.title) {
          importedHistory.push(item);
        } else if (item && item.lastSavedAt && item.questions) {
          importedSessions.push(item);
        }
      }
    }

    const currentHistory = getPracticeHistory();
    const existingHistoryIds = new Set(currentHistory.map((h) => h.id));
    const newHistoryItems = importedHistory.filter((h) => h && h.id && !existingHistoryIds.has(h.id));
    const updatedHistory = [...newHistoryItems, ...currentHistory].slice(0, 100);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));

    const currentSessions = getSavedTestSessions();
    const existingSessionIds = new Set(currentSessions.map((s) => s.id));
    const newSessionItems = importedSessions.filter((s) => s && s.id && !existingSessionIds.has(s.id));
    const updatedSessions = [...newSessionItems, ...currentSessions];
    localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(updatedSessions));

    return {
      historyCount: newHistoryItems.length,
      savedSessionsCount: newSessionItems.length,
    };
  } catch (err) {
    console.error('Failed to import practice history bundle:', err);
    throw new Error('Invalid JSON backup file for practice history.');
  }
}


