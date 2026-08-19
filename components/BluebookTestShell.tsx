'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Bookmark,
  Check,
  ChevronUp,
  Highlighter,
  FileText,
  Maximize2,
  Minimize2,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Calculator,
  FilePlus,
  Columns,
  Eye,
  EyeOff,
  ChevronDown,
  Info,
  HelpCircle,
  Edit3,
  Coffee,
  AlertCircle,
  Play,
  ArrowLeft,
  Sparkles,
  Save,
} from 'lucide-react';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import { gradeStudentResponse, evaluateSATQuestionAnswer } from '../lib/answerGrading';
import { saveError, saveTestSession } from '../lib/db';
import { transformRawToErrorItem } from '../lib/questionBank';
import { SATErrorItem, RawSATQuestion, SavedTestSession } from '../types/sat';

export interface BluebookQuestionItem {
  id: string;
  number: number;
  passageText?: string;
  questionPrompt: string;
  choices?: string[]; // Array of choices e.g. ["Choice A", "Choice B", ...]
  correctAnswer?: string; // e.g. "A" or exact choice text or grid-in answer
  isGridIn?: boolean;
  imageDataUrl?: string;
  graphData?: any;
  explanation?: string;
  subject?: string;
  subTopic?: string;
  mistakeType?: string;
  rawQuestion?: RawSATQuestion;
}

export interface HighlightNote {
  id: string;
  questionIndex: number;
  selectedText: string;
  color?: 'yellow' | 'blue' | 'pink' | 'underline';
  noteText?: string;
  timestamp: string;
}

export interface ModuleConfig {
  id: string;
  name: string;
  section: 'Reading and Writing' | 'Math';
  durationSeconds: number;
  startIndex: number;
  endIndex: number; // inclusive
}

interface BluebookTestShellProps {
  title?: string;
  sectionName?: string;
  questions: BluebookQuestionItem[];
  timerSeconds?: number;
  perQuestionTimerSeconds?: number;
  isUntimed?: boolean;
  isOfficialExam?: boolean;
  instantFeedback?: boolean;
  disableHighlighting?: boolean;
  // Saved and resumed test support
  initialAnswers?: Record<number, string>;
  initialMarkedForReview?: Record<number, boolean>;
  initialCurrentIndex?: number;
  initialCurrentModuleIdx?: number;
  initialTimeSpentSeconds?: number;
  initialModuleTimeLeft?: number;
  savedSessionId?: string;
  rawQuestions?: RawSATQuestion[];
  examType?: 'official_full' | 'official_section' | 'custom_drill' | 'single_question';
  presetConfig?: any;
  onSaveAndExit?: (savedSession: SavedTestSession) => void;
  onFinishTest: (results: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => void;
  onClose: () => void;
}

export function buildModuleConfigs(
  questions: BluebookQuestionItem[],
  customTimerSeconds = 0,
  customPerQSeconds = 0,
  isUntimed = false,
  isOfficialExam = false
): ModuleConfig[] {
  if (!questions || questions.length === 0) return [];

  const rwIndices: number[] = [];
  const mathIndices: number[] = [];

  questions.forEach((q, idx) => {
    const isMath =
      q.subject === 'Math' ||
      (q.subTopic && ['Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'].includes(q.subTopic));
    if (isMath) {
      mathIndices.push(idx);
    } else {
      rwIndices.push(idx);
    }
  });

  const modules: ModuleConfig[] = [];

  // Helper to determine module duration:
  const getDuration = (count: number, defaultOfficialSeconds: number): number => {
    if (isUntimed) return 0;
    if (customPerQSeconds > 0) return count * customPerQSeconds;
    if (customTimerSeconds > 0) {
      // Proportionally allocate custom total timer across module questions
      return Math.round(customTimerSeconds * (count / questions.length));
    }
    if (isOfficialExam) return defaultOfficialSeconds;
    // Default fallback: if not official and no timer given, untimed (0)
    return 0;
  };

  // Case 1: Combined Test (Reading & Writing followed by Math)
  if (rwIndices.length > 0 && mathIndices.length > 0 && rwIndices[rwIndices.length - 1] < mathIndices[0]) {
    // Reading & Writing modules
    if (rwIndices.length >= 30) {
      const half = Math.ceil(rwIndices.length / 2);
      modules.push({
        id: 'rw_m1',
        name: 'Section 1: Reading and Writing — Module 1',
        section: 'Reading and Writing',
        durationSeconds: getDuration(half, 32 * 60),
        startIndex: 0,
        endIndex: half - 1,
      });
      modules.push({
        id: 'rw_m2',
        name: 'Section 1: Reading and Writing — Module 2',
        section: 'Reading and Writing',
        durationSeconds: getDuration(rwIndices.length - half, 32 * 60),
        startIndex: half,
        endIndex: rwIndices.length - 1,
      });
    } else {
      modules.push({
        id: 'rw_m1',
        name: 'Section 1: Reading and Writing',
        section: 'Reading and Writing',
        durationSeconds: getDuration(rwIndices.length, 32 * 60),
        startIndex: 0,
        endIndex: rwIndices.length - 1,
      });
    }

    // Math modules
    const mathStart = rwIndices.length;
    if (mathIndices.length >= 25) {
      const halfMath = Math.ceil(mathIndices.length / 2);
      modules.push({
        id: 'math_m1',
        name: 'Section 2: Math — Module 1',
        section: 'Math',
        durationSeconds: getDuration(halfMath, 35 * 60),
        startIndex: mathStart,
        endIndex: mathStart + halfMath - 1,
      });
      modules.push({
        id: 'math_m2',
        name: 'Section 2: Math — Module 2',
        section: 'Math',
        durationSeconds: getDuration(mathIndices.length - halfMath, 35 * 60),
        startIndex: mathStart + halfMath,
        endIndex: mathStart + mathIndices.length - 1,
      });
    } else {
      modules.push({
        id: 'math_m1',
        name: 'Section 2: Math',
        section: 'Math',
        durationSeconds: getDuration(mathIndices.length, 35 * 60),
        startIndex: mathStart,
        endIndex: mathStart + mathIndices.length - 1,
      });
    }
  } else if (rwIndices.length > 0 && mathIndices.length === 0) {
    // Case 2: Pure Reading & Writing Test
    if (rwIndices.length >= 30) {
      const half = Math.ceil(rwIndices.length / 2);
      modules.push({
        id: 'rw_m1',
        name: 'Reading and Writing — Module 1',
        section: 'Reading and Writing',
        durationSeconds: getDuration(half, 32 * 60),
        startIndex: 0,
        endIndex: half - 1,
      });
      modules.push({
        id: 'rw_m2',
        name: 'Reading and Writing — Module 2',
        section: 'Reading and Writing',
        durationSeconds: getDuration(rwIndices.length - half, 32 * 60),
        startIndex: half,
        endIndex: rwIndices.length - 1,
      });
    } else {
      modules.push({
        id: 'rw_m1',
        name: 'Reading and Writing Practice',
        section: 'Reading and Writing',
        durationSeconds: getDuration(questions.length, 32 * 60),
        startIndex: 0,
        endIndex: questions.length - 1,
      });
    }
  } else if (mathIndices.length > 0 && rwIndices.length === 0) {
    // Case 3: Pure Math Test
    if (mathIndices.length >= 25) {
      const half = Math.ceil(mathIndices.length / 2);
      modules.push({
        id: 'math_m1',
        name: 'Math — Module 1',
        section: 'Math',
        durationSeconds: getDuration(half, 35 * 60),
        startIndex: 0,
        endIndex: half - 1,
      });
      modules.push({
        id: 'math_m2',
        name: 'Math — Module 2',
        section: 'Math',
        durationSeconds: getDuration(mathIndices.length - half, 35 * 60),
        startIndex: half,
        endIndex: questions.length - 1,
      });
    } else {
      modules.push({
        id: 'math_m1',
        name: 'Math Practice',
        section: 'Math',
        durationSeconds: getDuration(questions.length, 35 * 60),
        startIndex: 0,
        endIndex: questions.length - 1,
      });
    }
  } else {
    // Fallback single module
    modules.push({
      id: 'm1',
      name: 'Practice Session',
      section: 'Reading and Writing',
      durationSeconds: getDuration(questions.length, 32 * 60),
      startIndex: 0,
      endIndex: questions.length - 1,
    });
  }

  return modules;
}

export default function BluebookTestShell({
  title = 'Official Bluebook Exam',
  sectionName = 'Section 1: Reading and Writing',
  questions,
  timerSeconds = 0,
  perQuestionTimerSeconds = 0,
  isUntimed = false,
  isOfficialExam = false,
  instantFeedback = false,
  disableHighlighting = false,
  initialAnswers,
  initialMarkedForReview,
  initialCurrentIndex,
  initialCurrentModuleIdx,
  initialTimeSpentSeconds,
  initialModuleTimeLeft,
  savedSessionId,
  rawQuestions,
  examType,
  presetConfig,
  onSaveAndExit,
  onFinishTest,
  onClose,
}: BluebookTestShellProps) {
  // 1. Build Multi-Module Setup
  const modules = useMemo(() => {
    return buildModuleConfigs(questions, timerSeconds, perQuestionTimerSeconds, isUntimed, isOfficialExam);
  }, [questions, timerSeconds, perQuestionTimerSeconds, isUntimed, isOfficialExam]);

  const [currentModuleIdx, setCurrentModuleIdx] = useState<number>(() => {
    if (typeof initialCurrentModuleIdx === 'number' && initialCurrentModuleIdx >= 0 && initialCurrentModuleIdx < modules.length) {
      return initialCurrentModuleIdx;
    }
    return 0;
  });
  const activeModule = modules[currentModuleIdx] || modules[0];

  // Navigation Index (Global index within questions array)
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (typeof initialCurrentIndex === 'number' && initialCurrentIndex >= 0 && initialCurrentIndex < questions.length) {
      return initialCurrentIndex;
    }
    return activeModule ? activeModule.startIndex : 0;
  });
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialAnswers || {});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>(() => initialMarkedForReview || {});
  const [eliminated, setEliminated] = useState<Record<number, Record<number, boolean>>>({});
  const [isEliminatorActive, setIsEliminatorActive] = useState<boolean>(false);

  // Modals & Module Transitions
  const [isReviewScreenOpen, setIsReviewScreenOpen] = useState<boolean>(false);
  const [isBreakScreenOpen, setIsBreakScreenOpen] = useState<boolean>(false);
  const [isTransitionScreenOpen, setIsTransitionScreenOpen] = useState<boolean>(false);
  const [isSaveExitModalOpen, setIsSaveExitModalOpen] = useState<boolean>(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState<number>(600); // 10:00 Break

  // Highlighting & Notes
  const [highlights, setHighlights] = useState<HighlightNote[]>([]);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [pendingSelection, setPendingSelection] = useState<string>('');
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showNoteInputInToolbar, setShowNoteInputInToolbar] = useState<boolean>(false);

  // Active Highlight Popover
  const [activeHighlight, setActiveHighlight] = useState<{
    item: HighlightNote;
    pos: { top: number; left: number };
    editingNote?: boolean;
    noteText?: string;
  } | null>(null);

  // Tools & Viewers
  const [showQuestionNav, setShowQuestionNav] = useState<boolean>(false);
  const [showFormulaSheet, setShowFormulaSheet] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showDirections, setShowDirections] = useState<boolean>(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isExpandedLeft, setIsExpandedLeft] = useState<boolean>(false);

  // Per-Module Drift-Free Timer Engine
  const testStartTimeRef = useRef<number>(0);
  const moduleStartTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(initialTimeSpentSeconds || 0);
  const initialRemainingSecondsRef = useRef<number>(
    typeof initialModuleTimeLeft === 'number' && initialModuleTimeLeft > 0
      ? initialModuleTimeLeft
      : (activeModule ? activeModule.durationSeconds : 0)
  );
  const [moduleTimeLeft, setModuleTimeLeft] = useState<number>(() => {
    if (typeof initialModuleTimeLeft === 'number' && initialModuleTimeLeft > 0) {
      return initialModuleTimeLeft;
    }
    return activeModule ? activeModule.durationSeconds : 0;
  });
  const [moduleElapsedSeconds, setModuleElapsedSeconds] = useState<number>(0);
  const [isTimerHidden, setIsTimerHidden] = useState<boolean>(false);

  // Resizable Desmos Calculator State
  const [calculatorWidth, setCalculatorWidth] = useState<number>(460);
  const isDraggingCalcRef = useRef<boolean>(false);
  const startCalcXRef = useRef<number>(0);
  const startCalcWidthRef = useRef<number>(460);

  const handleCalcResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingCalcRef.current = true;
    startCalcXRef.current = e.clientX;
    startCalcWidthRef.current = calculatorWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingCalcRef.current) return;
      const deltaX = startCalcXRef.current - moveEvent.clientX;
      const newWidth = Math.max(340, Math.min(760, startCalcWidthRef.current + deltaX));
      setCalculatorWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingCalcRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Per-Question Speed Timer Engine
  const questionStartTimeRef = useRef<number>(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(perQuestionTimerSeconds || 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  const answersRef = useRef<Record<number, string>>(answers);
  const markedForReviewRef = useRef<Record<number, boolean>>(markedForReview);
  const onFinishTestRef = useRef(onFinishTest);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    markedForReviewRef.current = markedForReview;
  }, [markedForReview]);

  useEffect(() => {
    onFinishTestRef.current = onFinishTest;
  }, [onFinishTest]);

  // Handle final test completion
  const handleCompleteTest = useCallback(() => {
    const sessionElapsed = Math.floor((Date.now() - testStartTimeRef.current) / 1000);
    const totalElapsed = accumulatedTimeRef.current + sessionElapsed;
    onFinishTestRef.current({
      answers: answersRef.current,
      markedForReview: markedForReviewRef.current,
      timeSpentSeconds: totalElapsed,
    });
  }, []);

  // Handle Save & Exit
  const handleConfirmSaveAndExit = useCallback(() => {
    const sessionElapsed = Math.floor((Date.now() - testStartTimeRef.current) / 1000);
    const totalElapsed = accumulatedTimeRef.current + sessionElapsed;
    const sessionId = savedSessionId || `session-${Date.now()}`;

    const savedSession: SavedTestSession = {
      id: sessionId,
      title,
      sectionName,
      examType: examType || 'official_full',
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      questions,
      rawQuestions: rawQuestions || [],
      answers: answersRef.current,
      markedForReview: markedForReviewRef.current,
      currentIndex,
      currentModuleIdx,
      timeSpentSeconds: totalElapsed,
      moduleTimeLeft,
      timerSeconds,
      perQuestionTimerSeconds,
      isUntimed,
      isOfficialExam,
      instantFeedback,
      presetConfig,
    };

    saveTestSession(savedSession);
    setIsSavedSuccess(true);

    setTimeout(() => {
      if (onSaveAndExit) {
        onSaveAndExit(savedSession);
      } else {
        onClose();
      }
    }, 600);
  }, [
    savedSessionId,
    title,
    sectionName,
    examType,
    questions,
    rawQuestions,
    currentIndex,
    currentModuleIdx,
    moduleTimeLeft,
    timerSeconds,
    perQuestionTimerSeconds,
    isUntimed,
    isOfficialExam,
    instantFeedback,
    presetConfig,
    onSaveAndExit,
    onClose,
  ]);

  // Initialize test and module start timers on mount
  useEffect(() => {
    if (testStartTimeRef.current === 0) {
      testStartTimeRef.current = Date.now();
    }
    if (moduleStartTimeRef.current === 0) {
      moduleStartTimeRef.current = Date.now();
    }
  }, []);

  // Start the next module after transition/break
  const startNextModule = useCallback(() => {
    const nextIdx = currentModuleIdx + 1;
    if (nextIdx < modules.length) {
      const nextMod = modules[nextIdx];
      setCurrentModuleIdx(nextIdx);
      setCurrentIndex(nextMod.startIndex);
      moduleStartTimeRef.current = Date.now();
      initialRemainingSecondsRef.current = nextMod.durationSeconds;
      setModuleTimeLeft(nextMod.durationSeconds);
      setIsBreakScreenOpen(false);
      setIsTransitionScreenOpen(false);
      setIsReviewScreenOpen(false);
    }
  }, [currentModuleIdx, modules]);

  // Open Transition or Break Screen when advancing from current module
  const handleOpenModuleTransition = useCallback(() => {
    setIsReviewScreenOpen(false);
    setShowQuestionNav(false);

    const nextModuleIdx = currentModuleIdx + 1;
    if (nextModuleIdx >= modules.length) {
      // Last module completed -> finish exam!
      handleCompleteTest();
      return;
    }

    const nextMod = modules[nextModuleIdx];
    const isChangingSection = activeModule.section === 'Reading and Writing' && nextMod.section === 'Math';

    if (isChangingSection) {
      // Show official 10-Minute Intermission Break
      setBreakTimeLeft(600);
      setIsBreakScreenOpen(true);
    } else {
      // Show module transition dialog
      setIsTransitionScreenOpen(true);
    }
  }, [currentModuleIdx, modules, activeModule, handleCompleteTest]);

  // Per-Module Timer Countdown & Stopwatch Interval
  useEffect(() => {
    if (!activeModule || isBreakScreenOpen || isTransitionScreenOpen) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedInMod = Math.floor((now - moduleStartTimeRef.current) / 1000);
      setModuleElapsedSeconds(elapsedInMod);

      if (activeModule.durationSeconds > 0) {
        const remaining = Math.max(0, Math.ceil(initialRemainingSecondsRef.current - elapsedInMod));
        setModuleTimeLeft(remaining);

        // When module time expires:
        if (remaining <= 0) {
          clearInterval(interval);
          // If there is another module, auto-advance or show transition
          if (currentModuleIdx < modules.length - 1) {
            handleOpenModuleTransition();
          } else {
            handleCompleteTest();
          }
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [activeModule, currentModuleIdx, modules.length, isBreakScreenOpen, isTransitionScreenOpen, handleOpenModuleTransition, handleCompleteTest]);

  // Per-Question Speed Countdown Interval
  useEffect(() => {
    if (!perQuestionTimerSeconds || perQuestionTimerSeconds <= 0 || isBreakScreenOpen || isTransitionScreenOpen) return;

    questionStartTimeRef.current = Date.now();

    const qInterval = setInterval(() => {
      const start = questionStartTimeRef.current || Date.now();
      const elapsedOnQ = (Date.now() - start) / 1000;
      const remaining = Math.max(0, Math.ceil(perQuestionTimerSeconds - elapsedOnQ));
      setQuestionTimeLeft(remaining);
    }, 200);

    return () => clearInterval(qInterval);
  }, [currentIndex, perQuestionTimerSeconds, isBreakScreenOpen, isTransitionScreenOpen]);

  // Break Countdown Interval (10-minute break)
  useEffect(() => {
    if (!isBreakScreenOpen) return;

    const breakInterval = setInterval(() => {
      setBreakTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(breakInterval);
          setIsBreakScreenOpen(false);
          startNextModule();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(breakInterval);
  }, [isBreakScreenOpen, startNextModule]);

  // Text selection handler with precise viewport positioning
  const handleTextSelect = useCallback(() => {
    if (disableHighlighting) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedStr = selection.toString().trim();
    if (selectedStr.length === 0) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const anchorEl = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    const focusEl = focusNode instanceof HTMLElement ? focusNode : focusNode?.parentElement;

    const isInEligibleContainer =
      (anchorEl?.closest('.bluebook-passage-content') || anchorEl?.closest('.bluebook-prompt-content')) &&
      (focusEl?.closest('.bluebook-passage-content') || focusEl?.closest('.bluebook-prompt-content'));

    if (!isInEligibleContainer) {
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        setPendingSelection(selectedStr);
        setActiveHighlight(null);
        setSelectionPos({
          top: Math.max(65, rect.top - 60),
          left: Math.max(16, Math.min(window.innerWidth - 340, rect.left + rect.width / 2 - 140)),
        });
      }
    } catch {
      // Ignore positioning error
    }
  }, [disableHighlighting]);

  const applyHighlight = (color: 'yellow' | 'blue' | 'pink' | 'underline' = 'yellow') => {
    if (!pendingSelection) return;

    const newHighlight: HighlightNote = {
      id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      questionIndex: currentIndex,
      selectedText: pendingSelection,
      color,
      noteText: noteInput.trim() || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHighlights((prev) => [...prev, newHighlight]);
    setPendingSelection('');
    setSelectionPos(null);
    setNoteInput('');
    setShowNoteInputInToolbar(false);
    window.getSelection()?.removeAllRanges();
  };

  const clearSelection = () => {
    setPendingSelection('');
    setSelectionPos(null);
    setNoteInput('');
    setShowNoteInputInToolbar(false);
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    if (activeHighlight?.item.id === id) {
      setActiveHighlight(null);
    }
  };

  const updateHighlightColor = (id: string, color: 'yellow' | 'blue' | 'pink' | 'underline') => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, color } : h))
    );
    if (activeHighlight?.item.id === id) {
      setActiveHighlight((prev) => prev ? { ...prev, item: { ...prev.item, color } } : null);
    }
  };

  const updateHighlightNote = (id: string, noteText: string) => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, noteText: noteText.trim() || undefined } : h))
    );
    if (activeHighlight?.item.id === id) {
      setActiveHighlight((prev) => prev ? { ...prev, item: { ...prev.item, noteText }, editingNote: false } : null);
    }
  };

  const handleHighlightClick = (h: { id: string; selectedText: string; color?: any; noteText?: string }, e: React.MouseEvent) => {
    const fullItem = highlights.find((x) => x.id === h.id) || {
      id: h.id,
      questionIndex: currentIndex,
      selectedText: h.selectedText,
      color: h.color || 'yellow',
      noteText: h.noteText,
      timestamp: '',
    };

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveHighlight({
      item: fullItem,
      pos: {
        top: Math.max(65, rect.top - 70),
        left: Math.max(16, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 140)),
      },
      editingNote: false,
      noteText: fullItem.noteText || '',
    });
    setPendingSelection('');
    setSelectionPos(null);
  };

  const [savedToErrorBook, setSavedToErrorBook] = useState<Record<number, boolean>>({});
  const [isSavingError, setIsSavingError] = useState<Record<number, boolean>>({});

  const handleCheckAnswer = (qIdx: number) => {
    setCheckedQuestions((prev) => ({
      ...prev,
      [qIdx]: true,
    }));
  };

  const handleRetryQuestion = (qIdx: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qIdx];
      return next;
    });
    setCheckedQuestions((prev) => ({
      ...prev,
      [qIdx]: false,
    }));
  };

  const handleSaveToErrorBook = async (qIdx: number) => {
    const q = questions[qIdx];
    if (!q || savedToErrorBook[qIdx]) return;
    setIsSavingError((prev) => ({ ...prev, [qIdx]: true }));
    try {
      if (q.rawQuestion) {
        const item = transformRawToErrorItem(q.rawQuestion, 'Saved from Practice & Learn Drill');
        await saveError(item);
      } else {
        const errorItem: SATErrorItem = {
          id: `err-${Date.now()}-${qIdx}`,
          createdAt: new Date().toISOString(),
          subject: (q.subject === 'Math' ? 'Math' : 'Reading & Writing') as any,
          subTopic: q.subTopic || (q.subject === 'Math' ? 'Algebra' : 'Information & Ideas'),
          passageText: q.passageText,
          questionText: q.questionPrompt,
          answerChoices: (q.choices || []).map((text, idx) => ({
            label: String.fromCharCode(65 + idx),
            text,
          })),
          correctAnswer: q.correctAnswer || 'A',
          aiTakeaway: 'Practice drill review item',
          explanation: q.explanation || '',
          mistakeType: 'Concept Gap',
          masteryStatus: 'Learning',
          masteryLevel: 1,
          nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reviewHistory: [],
          testSource: title || 'Practice Builder Drill',
        };
        await saveError(errorItem);
      }
      setSavedToErrorBook((prev) => ({ ...prev, [qIdx]: true }));
    } catch (err) {
      console.error('Failed to save error item:', err);
    } finally {
      setIsSavingError((prev) => ({ ...prev, [qIdx]: false }));
    }
  };

  const isChecked = Boolean(instantFeedback && checkedQuestions[currentIndex]);

  const toggleEliminateChoice = (qIdx: number, choiceIdx: number) => {
    if (instantFeedback && checkedQuestions[qIdx]) return;
    setEliminated((prev) => {
      const qElim = prev[qIdx] || {};
      return {
        ...prev,
        [qIdx]: {
          ...qElim,
          [choiceIdx]: !qElim[choiceIdx],
        },
      };
    });
  };

  const handleSelectAnswer = (choiceLabel: string) => {
    if (isChecked) return;
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: choiceLabel,
    }));
  };

  const toggleBookmark = () => {
    setMarkedForReview((prev) => ({
      ...prev,
      [currentIndex]: !prev[currentIndex],
    }));
  };

  if (!currentQ) return null;

  const currentAnswer = answers[currentIndex] || '';
  const isCurrentMarked = !!markedForReview[currentIndex];
  const qEliminated = eliminated[currentIndex] || {};
  const currentQuestionHighlights = highlights.filter((h) => h.questionIndex === currentIndex);

  const choiceLabels = ['A', 'B', 'C', 'D'];

  const isMathSection = activeModule.section === 'Math' || currentQ.subject === 'Math';

  // Questions in current active module
  const moduleQuestions = questions.slice(activeModule.startIndex, activeModule.endIndex + 1);
  const activeModuleQIndex = currentIndex - activeModule.startIndex + 1;
  const activeModuleTotalQ = activeModule.endIndex - activeModule.startIndex + 1;

  return (
    <div
      ref={containerRef}
      className="bluebook-test-container fixed inset-0 z-50 bg-white text-slate-900 font-sans flex flex-col select-text overflow-hidden antialiased"
    >
      <style>{`
        .bluebook-test-container {
          color-scheme: light !important;
        }
        .bluebook-test-container strong,
        .bluebook-test-container b,
        .bluebook-prompt-content strong,
        .bluebook-prompt-content b,
        .bluebook-passage-content strong,
        .bluebook-passage-content b {
          color: #000000 !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .bluebook-test-container u,
        .bluebook-prompt-content u,
        .bluebook-passage-content u {
          text-decoration-color: #000000 !important;
          color: inherit !important;
        }
        .bluebook-test-container .katex,
        .bluebook-prompt-content .katex,
        .bluebook-passage-content .katex {
          color: #000000 !important;
        }
      `}</style>

      {/* ================= TOP BLUEBOOK HEADER ================= */}
      <header className="h-14 border-b border-slate-300 bg-white px-4 md:px-8 flex items-center justify-between shrink-0 select-none shadow-2xs">
        {/* Left: Section Title & Module Name */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-900 tracking-tight">
              {activeModule.name}
            </span>
            {instantFeedback && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold flex items-center gap-1 border border-purple-200 shadow-2xs">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>Practice & Learn Mode</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDirections(true)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline px-2 py-1 rounded transition-colors cursor-pointer"
          >
            <span>Directions</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Bluebook Module / Per-Question Timer Clock */}
        <div className="flex items-center">
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-2xs">
            <Clock
              className={`w-3.5 h-3.5 ${
                perQuestionTimerSeconds > 0
                  ? questionTimeLeft <= 5
                    ? 'text-rose-600 animate-pulse'
                    : 'text-indigo-600'
                  : activeModule?.durationSeconds > 0 && moduleTimeLeft <= 300
                  ? 'text-rose-600 animate-pulse'
                  : 'text-blue-600'
              }`}
            />
            {!isTimerHidden ? (
              <div className="flex items-center gap-1.5">
                {perQuestionTimerSeconds > 0 ? (
                  <>
                    <span className="text-[11px] font-sans font-medium text-slate-500 hidden sm:inline">
                      Question Timer:
                    </span>
                    <span
                      className={
                        questionTimeLeft <= 5 ? 'text-rose-600 font-extrabold' : 'text-indigo-900 font-bold'
                      }
                    >
                      {Math.floor(questionTimeLeft / 60)}:{String(questionTimeLeft % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans hidden md:inline">
                      ({perQuestionTimerSeconds}s/Q)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-sans font-medium text-slate-500 hidden sm:inline">
                      {activeModule?.durationSeconds > 0 ? 'Module Time:' : 'Untimed Practice:'}
                    </span>
                    {activeModule?.durationSeconds > 0 ? (
                      <span
                        className={
                          moduleTimeLeft <= 300 ? 'text-rose-600 font-extrabold' : 'text-slate-900'
                        }
                      >
                        {Math.floor(moduleTimeLeft / 60)}:{String(moduleTimeLeft % 60).padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="text-slate-900 font-bold">
                        {Math.floor(moduleElapsedSeconds / 60)}:{String(moduleElapsedSeconds % 60).padStart(2, '0')}
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : (
              <span className="text-slate-500 font-sans text-xs">Timer Hidden</span>
            )}
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setIsTimerHidden((prev) => !prev)}
              className="text-[11px] font-sans font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
            >
              {isTimerHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{isTimerHidden ? 'Show' : 'Hide'}</span>
            </button>
          </div>
        </div>

        {/* Right: Bluebook Official Tools & Exit */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desmos Graphing Calculator (Always in Math, available in exam) */}
          {isMathSection && (
            <button
              type="button"
              onClick={() => setShowCalculator((prev) => !prev)}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showCalculator
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'hover:bg-slate-100 text-slate-700 border border-transparent'
              }`}
              title="Desmos Graphing Calculator"
            >
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="hidden md:inline">Calculator</span>
            </button>
          )}

          {/* Math Reference Sheet */}
          {isMathSection && (
            <button
              type="button"
              onClick={() => setShowFormulaSheet((prev) => !prev)}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showFormulaSheet
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'hover:bg-slate-100 text-slate-700 border border-transparent'
              }`}
              title="SAT Math Formulas Reference Sheet"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="hidden md:inline">Reference</span>
            </button>
          )}

          {/* Highlights & Notes Drawer */}
          <button
            type="button"
            onClick={() => setShowNotesDrawer((prev) => !prev)}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors relative cursor-pointer ${
              showNotesDrawer
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'hover:bg-slate-100 text-slate-700 border border-transparent'
            }`}
            title="Highlights & Notes"
          >
            <Highlighter className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">Notes</span>
            {highlights.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black flex items-center justify-center">
                {highlights.length}
              </span>
            )}
          </button>

          {/* Module Review Button */}
          <button
            type="button"
            onClick={() => setIsReviewScreenOpen(true)}
            className="p-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="Review Module Questions"
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Review</span>
          </button>

          {/* Save & Exit Button */}
          <button
            type="button"
            onClick={() => setIsSaveExitModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Save progress and exit test"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            <span>Save & Exit</span>
          </button>

          {/* Exit / Close */}
          <button
            type="button"
            onClick={() => setIsSaveExitModalOpen(true)}
            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors cursor-pointer"
            title="Exit Exam"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Top Per-Question Speed Progress Bar */}
      {perQuestionTimerSeconds > 0 && (
        <div className="w-full bg-slate-100 h-1 overflow-hidden shrink-0">
          <div
            className={`h-full transition-all duration-200 ${
              questionTimeLeft <= 5
                ? 'bg-rose-500'
                : questionTimeLeft <= perQuestionTimerSeconds / 2
                ? 'bg-amber-500'
                : 'bg-indigo-600'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (questionTimeLeft / perQuestionTimerSeconds) * 100))}%`,
            }}
          />
        </div>
      )}

      {/* ================= WORKSPACE CONTAINER (QUESTION STAGE + DOCKED CALCULATOR) ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Question & Passage Work Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {(() => {
            const hasPassage = Boolean(currentQ.passageText && currentQ.passageText.trim().length > 0);

            const questionStemJsx = (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Question Header with Question Number, Subtopic, & Bookmark */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                  {activeModuleQIndex}
                </span>
                {currentQ.subTopic && (
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                    {currentQ.subTopic}
                  </span>
                )}
                {perQuestionTimerSeconds > 0 && (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border transition-colors ${
                      questionTimeLeft <= 5
                        ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                        : questionTimeLeft <= perQuestionTimerSeconds / 2
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{questionTimeLeft}s</span>
                    <span className="text-[10px] opacity-70 font-sans">/ {perQuestionTimerSeconds}s</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Option Eliminator Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEliminatorActive((prev) => !prev)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isEliminatorActive
                      ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Cross out answer choices"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Eliminate (ABC)</span>
                </button>

                {/* Bookmark / Mark for Review Toggle */}
                <button
                  type="button"
                  onClick={toggleBookmark}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    isCurrentMarked
                      ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isCurrentMarked ? 'fill-blue-600 text-blue-600' : ''}`} />
                  <span>{isCurrentMarked ? 'For Review' : 'Mark for Review'}</span>
                </button>
              </div>
            </div>

            {/* Embedded Graph / Diagram if present */}
            {currentQ.graphData?.hasGraph && currentQ.graphData.croppedGraphUrl && (
              <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shadow-xs">
                <img
                  src={currentQ.graphData.croppedGraphUrl}
                  alt="SAT Question Graph / Diagram"
                  className="max-h-64 object-contain rounded-lg"
                />
              </div>
            )}

            {/* Question Prompt Stem */}
            <div
              className="bluebook-prompt-content text-slate-900 text-base md:text-lg leading-relaxed font-serif tracking-normal my-3 p-3.5 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 shadow-2xs overflow-x-auto min-w-0 w-full"
              onMouseUp={handleTextSelect}
            >
              <MarkdownRenderer
                content={currentQ.questionPrompt}
                highlights={currentQuestionHighlights}
                onHighlightClick={handleHighlightClick}
              />
            </div>

            {/* Multiple Choice Options or Grid-in Response */}
            {currentQ.choices && currentQ.choices.length > 0 ? (
              <div className="space-y-4 pt-3 w-full">
                {currentQ.choices.map((choiceText, cIdx) => {
                  const choiceLetter = choiceLabels[cIdx] || String.fromCharCode(65 + cIdx);
                  const isSelected = currentAnswer.toUpperCase() === choiceLetter;
                  const isElim = !isChecked && Boolean(qEliminated[cIdx]);

                  const isCurrentCorrect = isChecked
                    ? evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                    : false;

                  const isOfficialCorrect = isChecked
                    ? evaluateSATQuestionAnswer(choiceLetter, currentQ.correctAnswer || '', currentQ.choices)
                    : false;

                  let containerClasses = 'border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/60';
                  let circleClasses = 'border-slate-300 text-slate-700 group-hover:border-slate-500 group-hover:text-slate-900';

                  if (isChecked) {
                    if (isSelected && isCurrentCorrect) {
                      containerClasses = 'border-emerald-500 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-500/30';
                      circleClasses = 'border-emerald-600 bg-emerald-600 text-white';
                    } else if (isSelected && !isCurrentCorrect) {
                      containerClasses = 'border-rose-500 bg-rose-50/90 shadow-sm ring-2 ring-rose-500/30';
                      circleClasses = 'border-rose-600 bg-rose-600 text-white';
                    } else if (isOfficialCorrect && !isCurrentCorrect) {
                      containerClasses = 'border-emerald-500 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-400/40';
                      circleClasses = 'border-emerald-600 bg-emerald-600 text-white';
                    } else {
                      containerClasses = 'border-slate-200 bg-slate-50/40 opacity-50';
                      circleClasses = 'border-slate-300 text-slate-400';
                    }
                  } else if (isElim) {
                    containerClasses = 'opacity-40 bg-slate-50 border-slate-200';
                    circleClasses = 'border-slate-300 text-slate-400';
                  } else if (isSelected) {
                    containerClasses = 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20';
                    circleClasses = 'border-blue-600 bg-blue-600 text-white';
                  }

                  return (
                    <div
                      key={cIdx}
                      className={`flex items-stretch rounded-2xl border-2 transition-all group overflow-hidden w-full ${containerClasses}`}
                    >
                      {/* Option Radio / Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isElim) handleSelectAnswer(choiceLetter);
                        }}
                        disabled={isChecked}
                        className="flex-1 p-4 sm:p-5 md:p-6 text-left flex items-center gap-4 cursor-pointer disabled:cursor-default min-w-0 w-full"
                      >
                        <div
                          className={`w-8 h-8 rounded-full border-2 font-mono font-bold text-sm flex items-center justify-center shrink-0 transition-colors ${circleClasses}`}
                        >
                          {choiceLetter}
                        </div>

                        <div
                          className={`flex-1 text-base md:text-lg font-serif leading-relaxed min-w-0 w-full overflow-x-auto overflow-y-hidden ${
                            isElim ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          <MathRenderer text={choiceText} />
                        </div>

                        {/* Status Badges for Practice & Learn Instant Feedback */}
                        {isChecked && isSelected && isCurrentCorrect && (
                          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold font-mono shrink-0 shadow-2xs">
                            ✓ Correct
                          </span>
                        )}
                        {isChecked && isSelected && !isCurrentCorrect && (
                          <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-bold font-mono shrink-0 shadow-2xs">
                            ✗ Your Choice
                          </span>
                        )}
                        {isChecked && !isSelected && isOfficialCorrect && !isCurrentCorrect && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold font-mono shrink-0 shadow-2xs">
                            ✓ Correct Answer
                          </span>
                        )}
                      </button>

                      {/* Eliminator Cross-out Action Button */}
                      {!isChecked && isEliminatorActive && (
                        <button
                          type="button"
                          onClick={() => toggleEliminateChoice(currentIndex, cIdx)}
                          className="px-4 border-l border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-r-2xl transition-colors cursor-pointer shrink-0"
                          title={isElim ? 'Restore choice' : 'Eliminate choice'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Grid-in / Student-Produced Response Input */
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Student-Produced Response:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={currentAnswer}
                    onChange={(e) => handleSelectAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && instantFeedback && !isChecked && currentAnswer.trim()) {
                        handleCheckAnswer(currentIndex);
                      }
                    }}
                    disabled={isChecked}
                    placeholder="Enter your answer (e.g., 14, 3/4, 0.75)"
                    className={`w-full max-w-sm px-4 py-3 rounded-xl border font-mono text-base ${
                      isChecked
                        ? evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-400'
                          : 'border-rose-500 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-300'
                        : 'border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white'
                    }`}
                  />
                  {isChecked && (
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono shadow-2xs ${
                        evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                        ? '✓ Correct'
                        : '✗ Incorrect'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* PRACTICE & LEARN MODE: COMPREHENSIVE INSTANT EXPLANATION CARD */}
            {instantFeedback && isChecked && (
              <div
                className={`mt-6 p-5 sm:p-6 rounded-3xl border-2 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                  evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                    ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                    : 'bg-rose-50/70 border-rose-300 text-slate-900'
                }`}
              >
                {/* Result Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
                  <div className="flex items-center gap-3">
                    {evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices) ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-7 h-7 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div
                        className={`text-base font-black ${
                          evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                            ? 'text-emerald-900'
                            : 'text-rose-900'
                        }`}
                      >
                        {evaluateSATQuestionAnswer(currentAnswer, currentQ.correctAnswer || '', currentQ.choices)
                          ? '🎉 Correct! Excellent reasoning.'
                          : '❌ Incorrect Answer'}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Official Correct Answer:{' '}
                        <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {currentQ.correctAnswer || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Error Book */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSaveToErrorBook(currentIndex)}
                      disabled={savedToErrorBook[currentIndex] || isSavingError[currentIndex]}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                        savedToErrorBook[currentIndex]
                          ? 'bg-emerald-600 text-white border border-emerald-600'
                          : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>
                        {savedToErrorBook[currentIndex] ? 'Added to Error Book ✓' : '+ Add to Error Book'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Step-by-Step Explanation Content */}
                <div className="space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Step-by-Step Official Explanation</span>
                  </div>
                  <div className="text-sm md:text-base font-serif leading-relaxed text-slate-900 bg-white/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 max-h-96 overflow-y-auto shadow-2xs">
                    {currentQ.explanation ? (
                      <MarkdownRenderer content={currentQ.explanation} />
                    ) : (
                      <p className="italic text-slate-500">No explanation provided for this question.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

        // Two-Column Bluebook Layout when passage exists
        if (hasPassage) {
          return (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* LEFT PANE: READING PASSAGE / STIMULUS */}
                  {!isLeftCollapsed && (
                    <div
                      className={`h-full bg-slate-50/50 overflow-y-auto p-6 md:p-10 ${
                        isExpandedLeft ? 'w-3/4' : 'w-1/2'
                      }`}
                    >
                      <div
                        className="bluebook-passage-content max-w-xl mx-auto text-slate-900 text-sm md:text-base leading-relaxed font-serif tracking-normal"
                        onMouseUp={handleTextSelect}
                      >
                        <MarkdownRenderer
                          content={currentQ.passageText || ''}
                          highlights={currentQuestionHighlights}
                          onHighlightClick={handleHighlightClick}
                        />
                      </div>
                    </div>
                  )}

                  {/* RIGHT PANE: QUESTION & OPTIONS */}
                  <div className={`h-full bg-white overflow-y-auto p-6 md:p-10 ${isExpandedLeft ? 'w-1/4' : 'w-1/2'}`}>
                    <div className="max-w-xl mx-auto">
                      {questionStemJsx}
                    </div>
                  </div>
                </div>
              );
            }

            // Single Centered Pane (e.g., Math section without passage)
            return (
              <div className="flex-1 overflow-y-auto bg-white p-6 md:p-10">
                <div className="max-w-2xl mx-auto">
                  {questionStemJsx}
                </div>
              </div>
            );
          })()}
        </div>

        {/* DOCKED RESIZABLE DESMOS GRAPHING CALCULATOR (DOES NOT BLOCK QUESTIONS) */}
        {showCalculator && (
          <div className="flex shrink-0 h-full border-l border-slate-300 z-30 shadow-lg bg-white">
            {/* Drag Handle to Resize */}
            <div
              onMouseDown={handleCalcResizeMouseDown}
              className="w-2 hover:w-2.5 bg-slate-200 hover:bg-blue-500 cursor-col-resize flex items-center justify-center transition-all group select-none"
              title="Drag to resize calculator"
            >
              <div className="w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
            </div>

            {/* Calculator Panel */}
            <div
              style={{ width: `${calculatorWidth}px` }}
              className="h-full flex flex-col bg-white overflow-hidden"
            >
              <div className="h-10 bg-slate-900 text-white px-3.5 flex items-center justify-between shrink-0 select-none">
                <span className="text-xs font-bold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-400" />
                  <span>Desmos Graphing Calculator</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{calculatorWidth}px</span>
                  <button
                    type="button"
                    onClick={() => setShowCalculator(false)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors cursor-pointer"
                    title="Close calculator"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <iframe
                src="https://www.desmos.com/calculator"
                title="Desmos Graphing Calculator"
                className="w-full flex-1 border-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* ================= EDIT EXISTING HIGHLIGHT POPOVER ================= */}
      {activeHighlight && (
        <div
          style={{
            top: `${activeHighlight.pos.top}px`,
            left: `${activeHighlight.pos.left}px`,
          }}
          className="fixed z-50 bg-slate-900 text-white shadow-2xl rounded-2xl p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150 select-none border border-slate-700 min-w-64"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Highlight Option</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => removeHighlight(activeHighlight.item.id)}
                className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
                title="Remove highlight"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveHighlight(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'yellow')}
              className={`w-6 h-6 rounded-full bg-[#fef08a] border border-amber-400 transition-transform ${activeHighlight.item.color === 'yellow' ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'}`}
              title="Yellow"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'blue')}
              className={`w-6 h-6 rounded-full bg-[#bae6fd] border border-sky-400 transition-transform ${activeHighlight.item.color === 'blue' ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'}`}
              title="Blue"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'pink')}
              className={`w-6 h-6 rounded-full bg-[#fbcfe8] border border-pink-400 transition-transform ${activeHighlight.item.color === 'pink' ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'}`}
              title="Pink"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'underline')}
              className={`w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-white text-xs font-serif font-normal transition-transform ${activeHighlight.item.color === 'underline' ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'}`}
              title="Dashed Underline"
            >
              <span className="underline decoration-dashed decoration-white decoration-2 underline-offset-2 font-normal">U</span>
            </button>
          </div>

          {activeHighlight.editingNote ? (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={activeHighlight.noteText}
                onChange={(e) => setActiveHighlight((prev) => prev ? { ...prev, noteText: e.target.value } : null)}
                placeholder="Annotation note..."
                className="flex-1 px-2.5 py-1 text-xs rounded-md bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateHighlightNote(activeHighlight.item.id, activeHighlight.noteText || '');
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => updateHighlightNote(activeHighlight.item.id, activeHighlight.noteText || '')}
                className="px-2 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-500 cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1 text-xs text-slate-300 border-t border-slate-800/80">
              <span className="truncate max-w-44 italic">{activeHighlight.item.noteText ? `"${activeHighlight.item.noteText}"` : 'No note attached'}</span>
              <button
                type="button"
                onClick={() => setActiveHighlight((prev) => prev ? { ...prev, editingNote: true } : null)}
                className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer shrink-0 ml-2"
              >
                {activeHighlight.item.noteText ? 'Edit Note' : '+ Add Note'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= FLOATING HIGHLIGHT TOOLBAR ================= */}
      {pendingSelection && (
        <div
          style={{
            top: selectionPos ? `${selectionPos.top}px` : 'auto',
            left: selectionPos ? `${selectionPos.left}px` : '50%',
            transform: selectionPos ? 'none' : 'translateX(-50%)',
          }}
          className="highlight-toolbar-container fixed z-50 bg-slate-900 text-white shadow-2xl rounded-full px-3.5 py-1.5 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none border border-slate-700"
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyHighlight('yellow')}
            className="w-7 h-7 rounded-full bg-[#fef08a] hover:scale-110 active:scale-95 transition-all border border-amber-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Yellow"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyHighlight('blue')}
            className="w-7 h-7 rounded-full bg-[#bae6fd] hover:scale-110 active:scale-95 transition-all border border-sky-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Blue"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyHighlight('pink')}
            className="w-7 h-7 rounded-full bg-[#fbcfe8] hover:scale-110 active:scale-95 transition-all border border-pink-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Pink"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyHighlight('underline')}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex flex-col items-center justify-center text-white font-serif font-normal text-xs shrink-0 cursor-pointer"
            title="Underline text (Dashed)"
          >
            <span className="underline decoration-dashed decoration-white decoration-2 underline-offset-2 font-normal">U</span>
          </button>

          <div className="w-px h-5 bg-slate-700" />

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => setShowNoteInputInToolbar((prev) => !prev)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showNoteInputInToolbar || noteInput ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={clearSelection}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {showNoteInputInToolbar && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-700">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Annotation note..."
                className="px-2.5 py-1 text-xs rounded-md bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHighlight('yellow');
                }}
                autoFocus
              />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => applyHighlight('yellow')}
                className="px-2 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-500 cursor-pointer"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= BOTTOM BLUEBOOK NAVIGATION FOOTER ================= */}
      <footer className="h-16 border-t border-slate-300 bg-white px-4 md:px-10 flex items-center justify-between shrink-0 select-none shadow-2xs">
        {/* Left: Module Name & Progress Indicator */}
        <div className="text-xs font-semibold text-slate-600 hidden sm:block">
          {activeModule.name} • Module {currentModuleIdx + 1} of {modules.length}
        </div>

        {/* Center: Question Navigator Pill [ Question X of Y ^ ] */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowQuestionNav((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            <span>
              Question {activeModuleQIndex} of {activeModuleTotalQ}
            </span>
            <ChevronUp className={`w-4 h-4 transition-transform ${showQuestionNav ? 'rotate-180' : ''}`} />
          </button>

          {/* Question Navigator Popover */}
          {showQuestionNav && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 md:w-96 p-4 rounded-2xl bg-white border border-slate-300 shadow-2xl z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900">{activeModule.name}</span>
                <span className="text-[11px] text-slate-500">
                  {moduleQuestions.filter((_, mIdx) => answers[activeModule.startIndex + mIdx]).length} of {activeModuleTotalQ} Answered
                </span>
              </div>

              {/* Module Questions Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1">
                {moduleQuestions.map((q, mIdx) => {
                  const globalIdx = activeModule.startIndex + mIdx;
                  const isAns = !!answers[globalIdx];
                  const isMarked = !!markedForReview[globalIdx];
                  const isCurrent = globalIdx === currentIndex;

                  return (
                    <button
                      key={q.id || globalIdx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(globalIdx);
                        setShowQuestionNav(false);
                      }}
                      className={`h-10 rounded-lg border text-xs font-bold relative flex items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500'
                          : isAns
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>{mIdx + 1}</span>
                      {isMarked && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-slate-900 inline-block" /> Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> For Review
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Navigation: Back & Check Answer / Next / Review Module */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="back-question-btn"
            onClick={() => setCurrentIndex((prev) => Math.max(activeModule.startIndex, prev - 1))}
            disabled={currentIndex === activeModule.startIndex}
            className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Back
          </button>

          {instantFeedback && !checkedQuestions[currentIndex] ? (
            <button
              type="button"
              id="check-answer-btn"
              onClick={() => handleCheckAnswer(currentIndex)}
              disabled={!answers[currentIndex]?.trim()}
              title={!answers[currentIndex]?.trim() ? 'Please select or type an answer first' : 'Click to check answer'}
              className="px-6 py-2.5 rounded-full bg-[#0073e6] hover:bg-[#005fb8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer min-w-[130px] justify-center"
            >
              <span>Check Answer</span>
              <Sparkles className="w-4 h-4 text-blue-200" />
            </button>
          ) : currentIndex < activeModule.endIndex ? (
            <button
              type="button"
              id="next-question-btn"
              onClick={() => setCurrentIndex((prev) => Math.min(activeModule.endIndex, prev + 1))}
              className="px-6 py-2.5 rounded-full bg-[#0073e6] hover:bg-[#005fb8] text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer min-w-[130px] justify-center"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              id="review-module-btn"
              onClick={() => setIsReviewScreenOpen(true)}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer min-w-[130px] justify-center"
            >
              <span>Review Module</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* ================= MODULE REVIEW SCREEN MODAL ================= */}
      {isReviewScreenOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                  Module Review
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {activeModule.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Review your answers before submitting this module. Once you proceed to the next module, you cannot return.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewScreenOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xl font-black text-slate-900 font-mono">
                  {moduleQuestions.filter((_, idx) => answers[activeModule.startIndex + idx]).length}
                </p>
                <p className="text-xs font-bold text-slate-600">Answered</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <p className="text-xl font-black text-rose-600 font-mono">
                  {moduleQuestions.filter((_, idx) => !answers[activeModule.startIndex + idx]).length}
                </p>
                <p className="text-xs font-bold text-rose-700">Unanswered</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                <p className="text-xl font-black text-blue-600 font-mono">
                  {moduleQuestions.filter((_, idx) => markedForReview[activeModule.startIndex + idx]).length}
                </p>
                <p className="text-xs font-bold text-blue-700">For Review</p>
              </div>
            </div>

            {/* Grid of Module Questions */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Click any question to review or edit your answer:
              </span>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 max-h-64 overflow-y-auto p-1">
                {moduleQuestions.map((q, mIdx) => {
                  const globalIdx = activeModule.startIndex + mIdx;
                  const isAns = !!answers[globalIdx];
                  const isMarked = !!markedForReview[globalIdx];

                  return (
                    <button
                      key={globalIdx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(globalIdx);
                        setIsReviewScreenOpen(false);
                      }}
                      className={`h-12 rounded-xl border text-xs font-bold relative flex items-center justify-center transition-all cursor-pointer ${
                        isAns
                          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>{mIdx + 1}</span>
                      {isMarked && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setIsReviewScreenOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Back to Questions
              </button>

              <button
                type="button"
                onClick={handleOpenModuleTransition}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {currentModuleIdx < modules.length - 1 ? 'Submit Module & Continue' : 'Submit & Finish Exam'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 10-MINUTE INTERMISSION BREAK SCREEN ================= */}
      {isBreakScreenOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-md w-full space-y-6">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mx-auto text-blue-400">
              <Coffee className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black tracking-widest uppercase text-blue-400">
                Official Digital SAT Intermission
              </span>
              <h2 className="text-3xl font-black text-white">Section 1 Complete!</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Take a 10-minute break before beginning Section 2: Math. You may rest, stretch, or hydrate.
              </p>
            </div>

            {/* Break Clock */}
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 font-mono">
              <p className="text-5xl font-black text-white">
                {Math.floor(breakTimeLeft / 60)}:{String(breakTimeLeft % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 font-sans mt-2">Time Remaining in Break</p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={startNextModule}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Resume Testing / Start Section 2 (Math)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-slate-400">
                Your Module timer will start immediately when you click Resume.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE TRANSITION SCREEN MODAL ================= */}
      {isTransitionScreenOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6 text-center border border-slate-200 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <Check className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Module Complete!</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All answers for <strong>{activeModule.name}</strong> have been locked. Ready to start <strong>{modules[currentModuleIdx + 1]?.name}</strong>?
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left space-y-1.5">
              <p className="font-bold text-slate-800">Next Module Details:</p>
              <p>• {modules[currentModuleIdx + 1]?.name}</p>
              <p>• Questions: {modules[currentModuleIdx + 1]?.endIndex - modules[currentModuleIdx + 1]?.startIndex + 1}</p>
              <p>• Duration: {modules[currentModuleIdx + 1]?.durationSeconds > 0 ? `${Math.floor(modules[currentModuleIdx + 1].durationSeconds / 60)} minutes` : 'Untimed Practice'}</p>
            </div>

            <button
              type="button"
              onClick={startNextModule}
              className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Begin Next Module</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= SAT MATH REFERENCE SHEET ================= */}
      {showFormulaSheet && (
        <div className="fixed top-16 right-6 z-50 w-96 md:w-[500px] max-h-[600px] bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="h-10 bg-slate-900 text-white px-4 flex items-center justify-between shrink-0 select-none">
            <span className="text-xs font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Official SAT Math Reference Sheet</span>
            </span>
            <button
              type="button"
              onClick={() => setShowFormulaSheet(false)}
              className="p-1 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-800 font-serif">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Circles & Geometry:</p>
              <p>• Area of circle: <MathRenderer text="$A = \pi r^2$" /></p>
              <p>• Circumference of circle: <MathRenderer text="$C = 2\pi r$" /></p>
              <p>• Area of rectangle: <MathRenderer text="$A = lw$" /></p>
              <p>• Area of triangle: <MathRenderer text="$A = \frac{1}{2}bh$" /></p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Triangles & Trigonometry:</p>
              <p>• Pythagorean Theorem: <MathRenderer text="$a^2 + b^2 = c^2$" /></p>
              <p>• Special Right Triangles: <MathRenderer text="$30^\circ-60^\circ-90^\circ$ ($x, x\sqrt{3}, 2x$)" /></p>
              <p>• Special Right Triangles: <MathRenderer text="$45^\circ-45^\circ-90^\circ$ ($x, x, x\sqrt{2}$)" /></p>
              <p>• Sum of angles in a triangle: <MathRenderer text="$180^\circ$" /></p>
              <p>• Radians in a circle: <MathRenderer text="$2\pi\text{ radians} = 360^\circ$" /></p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Volume Formulas:</p>
              <p>• Rectangular Prism: <MathRenderer text="$V = lwh$" /></p>
              <p>• Cylinder: <MathRenderer text="$V = \pi r^2 h$" /></p>
              <p>• Sphere: <MathRenderer text="$V = \frac{4}{3}\pi r^3$" /></p>
              <p>• Cone: <MathRenderer text="$V = \frac{1}{3}\pi r^2 h$" /></p>
              <p>• Pyramid: <MathRenderer text="$V = \frac{1}{3}lwh$" /></p>
            </div>
          </div>
        </div>
      )}

      {/* ================= HIGHLIGHTS & ANNOTATIONS SIDE DRAWER ================= */}
      {showNotesDrawer && (
        <div className="absolute top-14 right-0 bottom-16 w-80 md:w-96 bg-white border-l border-slate-300 shadow-2xl z-40 flex flex-col p-4 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Highlighter className="w-4 h-4 text-amber-500" />
              <span>Highlights & Annotations</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowNotesDrawer(false)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-4 space-y-3 flex-1">
            {highlights.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">No annotations yet.</p>
                <p className="text-[11px] text-slate-400">Select text in any reading passage to highlight or add notes.</p>
              </div>
            ) : (
              highlights.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold">Question {h.questionIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeHighlight(h.id)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-serif italic text-slate-800 border-l-2 border-amber-400 pl-2">
                    &ldquo;{h.selectedText}&rdquo;
                  </p>
                  {h.noteText && (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-950 font-medium">
                      {h.noteText}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= SAVE & EXIT CONFIRMATION MODAL ================= */}
      {isSaveExitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Save className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">Save & Exit Practice Test?</h2>
              <p className="text-blue-100 text-xs mt-1">
                You can pause your test now and resume it whenever you&apos;re ready.
              </p>
            </div>

            {/* Test Status Summary */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {Object.values(answers).filter(Boolean).length} / {totalQuestions}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Questions Answered</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <p className="text-lg font-black text-blue-600 font-mono">
                    {Object.values(markedForReview).filter(Boolean).length}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Marked for Review</p>
                </div>
              </div>

              <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-2xl text-xs text-blue-900 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>Current Module:</span>
                  <span className="text-blue-700 font-mono">{activeModule ? activeModule.name : sectionName}</span>
                </div>
                {!isUntimed && (
                  <div className="flex items-center justify-between">
                    <span className="text-blue-800">Module Time Remaining:</span>
                    <span className="font-mono font-bold text-blue-900">
                      {Math.floor(moduleTimeLeft / 60)}m {moduleTimeLeft % 60}s
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed text-center">
                All your answers, marked questions, and time spent will be saved. You can resume this session anytime from the <strong>Practice History & Saved Tests</strong> tab.
              </p>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSaveAndExit}
                  disabled={isSavedSuccess}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavedSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Progress Saved! Exiting...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save & Exit Test</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSaveExitModalOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Resume Testing
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-3 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Discard & Exit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
