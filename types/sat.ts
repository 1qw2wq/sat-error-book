export type SATSubject = 'Math' | 'Reading & Writing';

export type SATSubTopic =
  // Math Sub-topics
  | 'Algebra'
  | 'Advanced Math'
  | 'Problem-Solving & Data Analysis'
  | 'Geometry & Trigonometry'
  // Reading & Writing Sub-topics
  | 'Information & Ideas'
  | 'Craft & Structure'
  | 'Expression of Ideas'
  | 'Standard English Conventions';

export type MistakeType =
  | 'Careless Error'
  | 'Concept Gap'
  | 'Misread Question'
  | 'Time Pressure'
  | 'Calculation Error'
  | 'Formula Amnesia';

export type MasteryStatus = 'Confused' | 'Learning' | 'Mastered';

export interface AnswerChoice {
  label: string; // e.g. "A", "B", "C", "D"
  text: string;  // Choice text
}

export interface ReviewLog {
  id: string;
  errorId: string;
  timestamp: string; // ISO String
  rating: 'confused' | 'learning' | 'mastered';
  timeSpentSeconds: number;
}

export interface GraphData {
  hasGraph: boolean;
  graphType?: 'linear' | 'quadratic' | 'scatterplot' | 'barchart' | 'table' | 'geometry' | 'diagram' | 'other';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  equation?: string; // e.g. "y = -0.75x + 6" or "y = x^2 - 4"
  points?: Array<{ x: number; y: number; label?: string }>;
  tableData?: { headers: string[]; rows: string[][] };
  description?: string;
  imageIndex?: number; // Index of screenshot containing the graph
  box2d?: [number, number, number, number] | number[]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  croppedGraphUrl?: string; // Cropped base64 PNG image cut from the screenshot
}

export interface SATErrorItem {
  id: string;
  createdAt: string; // ISO date string
  subject: SATSubject;
  subTopic: string;
  passageText?: string;
  questionText: string;
  answerChoices: AnswerChoice[];
  correctAnswer: string; // "A", "B", "C", "D" or exact number value
  aiTakeaway: string;
  explanation: string;
  imageDataUrl?: string; // base64 string or blob URL
  imageDataUrls?: string[]; // Multiple base64 strings or blob URLs
  graphData?: GraphData;
  userNotes?: string;
  mistakeType: MistakeType;
  masteryStatus: MasteryStatus;
  masteryLevel: number; // 0 = Confused, 1-2 = Learning, 3+ = Mastered
  nextReviewDate: string; // ISO date string
  reviewHistory: ReviewLog[];
  testSource?: string; // e.g., "Practice Test 1", "Bluebook", "Khan Academy"
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface UserStats {
  id: string;
  streakDays: number;
  lastStudyDate: string; // YYYY-MM-DD
  totalLogged: number;
  totalMastered: number;
  totalReviewsCompleted: number;
  studyDates: string[]; // List of YYYY-MM-DD dates with study activity
  isInitialSeeded?: boolean;
}

export interface VocabItem {
  id: string;
  word: string;
  definition: string;
  partOfSpeech?: string; // e.g. "adjective", "noun", "verb"
  exampleSentence?: string;
  synonyms?: string[];
  satTip?: string;
  sourceQuestionId?: string;
  sourceContext?: string;
  createdAt: string; // ISO date
  masteryStatus?: MasteryStatus;
  nextReviewDate?: string;
}

export interface DefineVocabResponse {
  word: string;
  definition: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  synonyms?: string[];
  satTip?: string;
}

export interface ParseErrorResponse {
  subject: SATSubject;
  subTopic: string;
  questionText: string;
  answerChoices: AnswerChoice[];
  correctAnswer: string;
  aiTakeaway: string;
  explanation: string;
  graphData?: GraphData;
  mistakeTypeHint?: MistakeType;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface RawSATQuestion {
  question_id: number;
  question_no: number;
  question_type: string; // 'Single Choice' | 'Fill-in-the-Blank / Free Response'
  difficulty: number; // e.g. 1 to 10
  section: string; // 'Reading and Writing' | 'Math'
  module: string; // 'Module 1' | 'Module 2'
  question: string;
  selections: string[] | null;
  answers: string;
  graphs: string[] | string | null;
  explanations: string;
  exam_name: string;
  category: string;
}

export interface SATExamSummary {
  exam_name: string;
  section: 'Reading and Writing' | 'Math' | 'Mixed';
  category: string;
  totalQuestions: number;
  module1Count: number;
  module2Count: number;
  avgDifficulty: number;
  difficulties: number[];
  hasGraphs: boolean;
}

export interface SATCombinedExamSummary {
  id: string;
  title: string;
  baseName: string;
  category: string;
  totalQuestions: number;
  readingWritingExamName: string;
  readingWritingTotal: number;
  readingWritingM1: number;
  readingWritingM2: number;
  mathExamName: string;
  mathTotal: number;
  mathM1: number;
  mathM2: number;
  avgDifficulty: number;
  hasGraphs: boolean;
}

export interface BluebookModuleGroup {
  moduleId: string; // e.g. "rw_m1", "rw_m2", "math_m1", "math_m2"
  section: 'Reading and Writing' | 'Math';
  moduleTitle: string; // e.g. "Section 1: Reading and Writing — Module 1"
  shortName: string; // e.g. "RW M1"
  questionIndices: number[]; // Global question indices belonging to this module
  officialDurationSeconds: number; // e.g. 32 * 60 for RW, 35 * 60 for Math
}

export interface PracticePreset {
  id: string;
  title: string;
  description?: string;
  section: 'All' | 'Reading and Writing' | 'Math';
  domain: string;
  module: 'All' | 'Module 1' | 'Module 2';
  year: string;
  exam: string;
  difficultyRange: [number, number];
  type: 'All' | 'Single Choice' | 'Fill-in-the-Blank / Free Response';
  onlyGraphs: boolean;
  questionCount: number;
  timerMode: 'official' | 'speed30' | 'speed60' | 'untimed';
  deliveryMode: 'exam' | 'instant_feedback';
  createdAt: string;
}

export interface PracticeHistoryItem {
  id: string;
  title: string;
  section: string;
  domain: string;
  questionCount: number;
  score?: number; // e.g. 18 / 20
  percentage?: number;
  timeSpentSeconds: number;
  completedAt: string;
  presetConfig?: Partial<PracticePreset>;
}


