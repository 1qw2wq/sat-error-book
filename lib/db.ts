import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SATErrorItem, ReviewLog, UserStats } from '@/types/sat';

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
}

const DB_NAME = 'SatErrorBookDatabase';
const DB_VERSION = 1;

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
      },
    });
  }
  return dbPromise;
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
