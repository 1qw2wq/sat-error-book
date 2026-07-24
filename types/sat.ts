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
  box2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  croppedGraphUrl?: string; // Cropped base64 PNG image cut from the screenshot
}

export interface SATErrorItem {
  id: string;
  createdAt: string; // ISO date string
  subject: SATSubject;
  subTopic: string;
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

