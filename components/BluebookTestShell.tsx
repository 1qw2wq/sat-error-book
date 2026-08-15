'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import { gradeStudentResponse, evaluateSATQuestionAnswer } from '../lib/answerGrading';

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
}

export interface HighlightNote {
  id: string;
  questionIndex: number;
  selectedText: string;
  color?: 'yellow' | 'blue' | 'pink' | 'underline';
  noteText?: string;
  timestamp: string;
}

interface BluebookTestShellProps {
  title?: string;
  sectionName?: string;
  questions: BluebookQuestionItem[];
  timerSeconds?: number;
  perQuestionTimerSeconds?: number;
  instantFeedback?: boolean;
  disableHighlighting?: boolean;
  onFinishTest: (results: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => void;
  onClose: () => void;
}

export default function BluebookTestShell({
  title = 'Specialized Training',
  sectionName = 'Section 1: Reading and Writing',
  questions,
  timerSeconds = 0,
  perQuestionTimerSeconds = 0,
  instantFeedback = false,
  disableHighlighting = false,
  onFinishTest,
  onClose,
}: BluebookTestShellProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [eliminated, setEliminated] = useState<Record<number, Record<number, boolean>>>({});
  const [isEliminatorActive, setIsEliminatorActive] = useState<boolean>(false);

  // Highlighting & Notes
  const [highlights, setHighlights] = useState<HighlightNote[]>([]);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [pendingSelection, setPendingSelection] = useState<string>('');
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showNoteInputInToolbar, setShowNoteInputInToolbar] = useState<boolean>(false);

  // Active Clicked Highlight Popover
  const [activeHighlight, setActiveHighlight] = useState<{
    item: HighlightNote;
    pos: { top: number; left: number };
    editingNote?: boolean;
    noteText?: string;
  } | null>(null);

  // UI Modals & State
  const [showQuestionNav, setShowQuestionNav] = useState<boolean>(false);
  const [showFormulaSheet, setShowFormulaSheet] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showDirections, setShowDirections] = useState<boolean>(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isExpandedLeft, setIsExpandedLeft] = useState<boolean>(false);

  // Drift-Free Timer Engine using Date.now()
  const testStartTimeRef = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Overall Exam Countdown Timer
  const [overallTimeLeft, setOverallTimeLeft] = useState<number>(timerSeconds || 0);

  // Per-Question Countdown Timer (resets on every question)
  const questionStartTimeRef = useRef<number>(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(perQuestionTimerSeconds || 0);

  const [isTimerHidden, setIsTimerHidden] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  const answersRef = useRef<Record<number, string>>(answers);
  const markedForReviewRef = useRef<Record<number, boolean>>(markedForReview);
  const onFinishTestRef = useRef(onFinishTest);
  const currentIndexRef = useRef<number>(currentIndex);
  const totalQuestionsRef = useRef<number>(questions.length);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    markedForReviewRef.current = markedForReview;
  }, [markedForReview]);

  useEffect(() => {
    onFinishTestRef.current = onFinishTest;
  }, [onFinishTest]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    questionStartTimeRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    totalQuestionsRef.current = questions.length;
  }, [questions.length]);

  const handleCompleteTest = useCallback(() => {
    const elapsed = Math.floor((Date.now() - testStartTimeRef.current) / 1000);
    onFinishTestRef.current({
      answers: answersRef.current,
      markedForReview: markedForReviewRef.current,
      timeSpentSeconds: elapsed,
    });
  }, []);

  // Drift-free, high-precision timer loop using timestamps
  useEffect(() => {
    testStartTimeRef.current = Date.now();
    questionStartTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Exact elapsed time
      const exactElapsed = Math.floor((now - testStartTimeRef.current) / 1000);
      setElapsedSeconds(exactElapsed);

      // 2. Overall Test countdown
      if (timerSeconds && timerSeconds > 0) {
        const remainingOverall = Math.max(0, Math.ceil(timerSeconds - (now - testStartTimeRef.current) / 1000));
        setOverallTimeLeft(remainingOverall);

        if (remainingOverall <= 0) {
          clearInterval(interval);
          handleCompleteTest();
          return;
        }
      }

      // 3. Per-Question countdown (resets for each question)
      if (perQuestionTimerSeconds && perQuestionTimerSeconds > 0) {
        const qElapsed = (now - questionStartTimeRef.current) / 1000;
        const remainingQ = Math.max(0, Math.ceil(perQuestionTimerSeconds - qElapsed));
        setQuestionTimeLeft(remainingQ);

        if (remainingQ <= 0) {
          // Question timer expired!
          if (currentIndexRef.current < totalQuestionsRef.current - 1) {
            questionStartTimeRef.current = Date.now();
            setCurrentIndex((prev) => prev + 1);
          } else {
            clearInterval(interval);
            handleCompleteTest();
          }
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [timerSeconds, perQuestionTimerSeconds, handleCompleteTest]);

  // Text selection handler with precise viewport positioning
  const handleTextSelect = useCallback(() => {
    if (disableHighlighting) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedStr = selection.toString().trim();
    if (selectedStr.length === 0) return;

    // Verify that the selection is inside the reading passage or question prompt, not the choices or buttons
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
      setPendingSelection(selectedStr);
    }
  }, [disableHighlighting]);

  // Global mouseup / touchend for catching text selections reliably
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent | TouchEvent) => {
      // Ignore if clicking on toolbar itself
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.highlight-toolbar-container')) {
        return;
      }
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
          handleTextSelect();
        } else if (!target?.closest('.highlight-toolbar-container') && !target?.closest('.highlight-popover-container')) {
          setPendingSelection('');
          setSelectionPos(null);
          setShowNoteInputInToolbar(false);
        }
      }, 50);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [handleTextSelect]);

  const applyHighlight = (color: 'yellow' | 'blue' | 'pink' | 'underline') => {
    if (!pendingSelection) return;
    const newNote: HighlightNote = {
      id: Math.random().toString(36).substring(2, 9),
      questionIndex: currentIndex,
      selectedText: pendingSelection,
      color,
      noteText: noteInput.trim() || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHighlights((prev) => [newNote, ...prev]);
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

  // Handle clicking on an existing highlight inside the text
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

  // Check if current question is locked/checked in instant feedback mode
  const isChecked = Boolean(instantFeedback && checkedQuestions[currentIndex]);

  // Check if answer is correct
  const checkIsCorrect = useCallback((userAns?: string, officialAns?: string, choices?: string[]): boolean => {
    if (!userAns || !officialAns) return false;
    return evaluateSATQuestionAnswer(userAns, officialAns, choices);
  }, []);

  // Option Elimination Toggle
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

  // Select Answer Choice
  const handleSelectAnswer = (choiceLabel: string) => {
    if (isChecked) return; // Answer locked after checking in instant feedback mode!
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: choiceLabel,
    }));
  };

  // Toggle Bookmark
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

  const isMathSection =
    currentQ.subject === 'Math' ||
    (sectionName && sectionName.toLowerCase().includes('math')) ||
    (title && title.toLowerCase().includes('math'));

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
        {/* Left: Section Title & Directions Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-900 tracking-tight">
              {sectionName}
            </span>
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

        {/* Center: Bluebook Timer Clock & Hide/Show Toggle */}
        <div className="flex items-center">
          {perQuestionTimerSeconds && perQuestionTimerSeconds > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-2xs">
              <Clock
                className={`w-3.5 h-3.5 ${
                  questionTimeLeft <= 5 ? 'text-rose-600 animate-pulse' : 'text-indigo-600'
                }`}
              />
              {!isTimerHidden ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-sans font-medium text-slate-500 hidden sm:inline">
                    Q-Timer:
                  </span>
                  <span
                    className={
                      questionTimeLeft <= 5 ? 'text-rose-600 font-extrabold' : 'text-slate-900'
                    }
                  >
                    {Math.floor(questionTimeLeft / 60)}:{String(questionTimeLeft % 60).padStart(2, '0')}
                  </span>
                  <span className="text-slate-400 text-[10px] font-sans">
                    / {perQuestionTimerSeconds}s
                  </span>
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
                {isTimerHidden ? (
                  <>
                    <Eye className="w-3 h-3" /> Show
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" /> Hide
                  </>
                )}
              </button>
            </div>
          ) : timerSeconds && timerSeconds > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-2xs">
              <Clock
                className={`w-3.5 h-3.5 ${
                  overallTimeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-blue-600'
                }`}
              />
              {!isTimerHidden ? (
                <span className={overallTimeLeft < 300 ? 'text-rose-600 font-extrabold' : 'text-slate-900'}>
                  {Math.floor(overallTimeLeft / 60)}:{String(overallTimeLeft % 60).padStart(2, '0')}
                </span>
              ) : (
                <span className="text-slate-500 font-sans text-xs">Timer Hidden</span>
              )}
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setIsTimerHidden((prev) => !prev)}
                className="text-[11px] font-sans font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
              >
                {isTimerHidden ? (
                  <>
                    <Eye className="w-3 h-3" /> Show
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" /> Hide
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-500 tracking-wide">
              {title}
            </div>
          )}
        </div>

        {/* Right Tools: Calculator, Annotate / Highlights, Reference Sheet, Close */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-medium">
          {/* Annotate / Highlights Button */}
          <button
            type="button"
            onClick={() => setShowNotesDrawer((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              showNotesDrawer || highlights.length > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                : 'hover:bg-slate-100 border-transparent text-slate-700'
            }`}
            title="Annotate / Highlighting Drawer"
          >
            <Highlighter className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Annotate</span>
            {highlights.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                {highlights.length}
              </span>
            )}
          </button>

          {/* Calculator */}
          <button
            type="button"
            onClick={() => setShowCalculator((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              showCalculator
                ? 'bg-blue-50 text-blue-900 border-blue-300 font-bold'
                : 'hover:bg-slate-100 border-transparent text-slate-700'
            }`}
            title="Open Graphing Calculator"
          >
            <Calculator className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Calculator</span>
          </button>

          {/* Math Reference Sheet */}
          {isMathSection && (
            <button
              type="button"
              onClick={() => setShowFormulaSheet(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-transparent hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="SAT Math Formulas Reference Sheet"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Reference</span>
            </button>
          )}

          {/* Close Test Shell */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Exit Test Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Visual Question Countdown Bar */}
      {perQuestionTimerSeconds && perQuestionTimerSeconds > 0 && !isTimerHidden && (
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 overflow-hidden shrink-0">
          <div
            className={`h-full transition-all duration-200 ease-linear ${
              questionTimeLeft <= 5 ? 'bg-rose-500' : 'bg-indigo-600'
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (questionTimeLeft / perQuestionTimerSeconds) * 100))}%`,
            }}
          />
        </div>
      )}

      {/* ================= MAIN BLUEBOOK TEST WORKSPACE ================= */}
      {(() => {
        const isNonEmptyText = (str?: string) => {
          if (!str) return false;
          const trimmed = str.trim().toLowerCase();
          return (
            trimmed.length > 0 &&
            trimmed !== 'none' &&
            trimmed !== 'none.' &&
            trimmed !== 'n/a' &&
            trimmed !== 'null' &&
            trimmed !== 'undefined' &&
            trimmed !== 'no passage' &&
            trimmed !== 'no passage provided.' &&
            trimmed !== 'no passage.' &&
            trimmed !== 'no reading passage needed.' &&
            trimmed !== 'no reading passage.' &&
            trimmed !== 'context sentence' &&
            trimmed !== '### context sentence'
          );
        };

        const normalizeForComparison = (str?: string) => {
          if (!str) return '';
          return str
            .toLowerCase()
            .replace(/[’'“”"]/g, '')
            .replace(/[^a-z0-9]/g, '');
        };

        const hasGraph = Boolean(
          currentQ.graphData &&
            (currentQ.graphData.hasGraph ||
              currentQ.graphData.croppedGraphUrl ||
              (typeof currentQ.graphData.graphType === 'string' &&
                currentQ.graphData.graphType.trim().length > 0))
        );

        const hasPassage = isNonEmptyText(currentQ.passageText);

        const normPassage = normalizeForComparison(currentQ.passageText);
        const normPrompt = normalizeForComparison(currentQ.questionPrompt);
        const passageMatchesPrompt =
          normPassage.length > 0 &&
          normPrompt.length > 0 &&
          (normPassage === normPrompt || normPrompt.includes(normPassage) || normPassage.includes(normPrompt));

        const hasLeftPane = (hasPassage && !passageMatchesPrompt) || hasGraph;

        // Question Stem & Choice Options JSX
        const questionStemJsx = (
          <div className="space-y-6">
            {/* Top Question Header Bar: [ 1 ] Black Square + Mark for Review + Option Eliminator */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 select-none">
              {/* Question Number Square Badge (Official Bluebook Style) */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-950 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {currentIndex + 1}
                </div>

                {/* Mark for Review Toggle with Bookmark Ribbon */}
                <button
                  type="button"
                  onClick={toggleBookmark}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                    isCurrentMarked
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                  title="Bookmark question for review"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      isCurrentMarked ? 'fill-blue-600 text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span>Mark for Review</span>
                </button>
              </div>

              {/* Option Eliminator Tool Toggle */}
              {currentQ.choices && currentQ.choices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsEliminatorActive((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                    isEliminatorActive
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                  title="Toggle Option Eliminator tool"
                >
                  <span className="font-mono font-bold line-through text-xs">ABC</span>
                  <span className="hidden sm:inline">Option Eliminator</span>
                </button>
              )}
            </div>

            {/* Question Prompt Stem */}
            <div className="bluebook-prompt-content font-serif text-black text-base md:text-lg leading-relaxed pt-1">
              <MarkdownRenderer
                content={currentQ.questionPrompt}
                highlights={currentQuestionHighlights}
                onHighlightClick={handleHighlightClick}
              />
            </div>

            {/* Multiple Choice Options */}
            {currentQ.choices && currentQ.choices.length > 0 && (
              <div className="space-y-3 pt-2 select-none">
                {currentQ.choices.map((choiceText, cIdx) => {
                  const label = choiceLabels[cIdx] || `${cIdx + 1}`;
                  const isSelected = currentAnswer === label || currentAnswer === choiceText;
                  const isChoiceEliminated = !isChecked && !!qEliminated[cIdx];

                  const officialClean = currentQ.correctAnswer || '';
                  const isOfficialCorrect =
                    checkIsCorrect(label, officialClean, currentQ.choices) ||
                    checkIsCorrect(choiceText, officialClean, currentQ.choices);

                  let cardStyles = 'border-slate-300 hover:border-slate-400 bg-white cursor-pointer';
                  let badgeStyles = 'border-slate-300 text-slate-800 bg-white';
                  let badgeContent: React.ReactNode = label;
                  let statusTag: React.ReactNode = null;

                  if (isChecked) {
                    if (isOfficialCorrect) {
                      cardStyles = 'border-emerald-500 bg-emerald-50/90 shadow-2xs font-medium cursor-not-allowed ring-1 ring-emerald-400';
                      badgeStyles = 'border-emerald-600 bg-emerald-600 text-white font-extrabold';
                      badgeContent = <Check className="w-4 h-4 text-white stroke-[3]" />;
                      statusTag = (
                        <span className="ml-auto text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Correct Choice
                        </span>
                      );
                    } else if (isSelected && !isOfficialCorrect) {
                      cardStyles = 'border-rose-500 bg-rose-50/90 shadow-2xs cursor-not-allowed ring-1 ring-rose-400';
                      badgeStyles = 'border-rose-600 bg-rose-600 text-white font-extrabold';
                      badgeContent = <X className="w-4 h-4 text-white stroke-[3]" />;
                      statusTag = (
                        <span className="ml-auto text-xs font-bold text-rose-800 bg-rose-100/90 border border-rose-300 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Your Answer
                        </span>
                      );
                    } else {
                      cardStyles = 'border-slate-200 bg-slate-50/50 opacity-45 cursor-not-allowed';
                      badgeStyles = 'border-slate-200 text-slate-400 bg-slate-100';
                    }
                  } else if (isSelected) {
                    cardStyles = 'border-blue-600 bg-blue-50/60 shadow-2xs ring-1 ring-blue-500 cursor-pointer';
                    badgeStyles = 'border-blue-600 bg-blue-600 text-white font-bold';
                  } else if (isChoiceEliminated) {
                    cardStyles = 'border-slate-200 bg-slate-50 opacity-35 cursor-pointer';
                  }

                  return (
                    <div
                      key={cIdx}
                      className={`group relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${cardStyles}`}
                      onClick={() => {
                        if (isChecked) return;
                        if (isEliminatorActive) {
                          toggleEliminateChoice(currentIndex, cIdx);
                        } else {
                          handleSelectAnswer(label);
                        }
                      }}
                    >
                      {/* Option Badge Circle (A, B, C, D) */}
                      <div className={`w-7 h-7 rounded-full border-2 text-xs font-bold flex items-center justify-center shrink-0 transition-colors mt-0.5 select-none ${badgeStyles}`}>
                        {badgeContent}
                      </div>

                      {/* Option Text */}
                      <div className={`flex-1 text-sm md:text-base font-serif text-black leading-snug pt-0.5 select-text ${isChoiceEliminated ? 'line-through text-slate-400' : ''}`}>
                        <MarkdownRenderer
                          content={choiceText}
                        />
                      </div>

                      {/* Right Status Tag */}
                      {statusTag}

                      {/* Manual Strikethrough Button on right edge */}
                      {!isChecked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEliminateChoice(currentIndex, cIdx);
                          }}
                          className={`p-1 rounded hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono font-extrabold cursor-pointer ${
                            isChoiceEliminated ? 'opacity-100 text-rose-600' : ''
                          }`}
                          title="Eliminate choice"
                        >
                          <span className="line-through">ABC</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grid-in Student Produced Response */}
            {(!currentQ.choices || currentQ.choices.length === 0) && (
              <div className={`space-y-3 p-5 rounded-2xl border transition-colors ${
                isChecked
                  ? checkIsCorrect(currentAnswer, currentQ.correctAnswer)
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-rose-300 bg-rose-50/70'
                  : 'border-slate-300 bg-slate-50'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Student-Produced Response
                  </label>
                  {isChecked && (
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      checkIsCorrect(currentAnswer, currentQ.correctAnswer) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checkIsCorrect(currentAnswer, currentQ.correctAnswer) ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={currentAnswer}
                  disabled={isChecked}
                  onChange={(e) => {
                    if (isChecked) return;
                    handleSelectAnswer(e.target.value);
                  }}
                  placeholder="Enter your answer (e.g., 23, 4/3, .75)"
                  className={`w-full px-4 py-3 rounded-xl border font-mono text-base font-semibold transition-colors focus:outline-none ${
                    isChecked
                      ? checkIsCorrect(currentAnswer, currentQ.correctAnswer)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 cursor-not-allowed'
                        : 'border-rose-500 bg-rose-50 text-rose-950 cursor-not-allowed'
                      : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-600'
                  }`}
                />
              </div>
            )}

            {/* Instant Feedback Explanation */}
            {instantFeedback && isChecked && (
              <div
                className={`p-5 rounded-2xl border leading-relaxed space-y-3 animate-in fade-in zoom-in-95 duration-200 ${
                  checkIsCorrect(currentAnswer, currentQ.correctAnswer, currentQ.choices)
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
                }`}
              >
                <div className="font-bold flex items-center justify-between text-sm border-b pb-2 border-current/15">
                  <div className="flex items-center gap-2">
                    {checkIsCorrect(currentAnswer, currentQ.correctAnswer, currentQ.choices) ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-900 font-extrabold text-base">Correct Answer!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span className="text-rose-900 font-extrabold text-base">Incorrect</span>
                      </>
                    )}
                  </div>

                  <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-white/80 border border-current/20 text-slate-900">
                    Official Answer: <span className="font-black underline">{currentQ.correctAnswer || 'N/A'}</span>
                  </div>
                </div>

                {currentQ.explanation && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Explanation & Rationale</span>
                    </div>
                    <div className="text-sm font-serif text-slate-900 leading-relaxed bg-white/90 p-3.5 rounded-xl border border-black/10">
                      <MarkdownRenderer content={currentQ.explanation} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

        if (hasLeftPane) {
          if (isLeftCollapsed) {
            return (
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Collapsed Left Pane Banner */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs text-slate-700 shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Passage / Stimulus Panel Collapsed</span>
                    <span className="text-slate-500 hidden sm:inline">• Hidden to give you full screen width</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLeftCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Show Passage Panel</span>
                  </button>
                </div>

                {/* Single Full-Width Right Pane */}
                <div className="flex-1 overflow-y-auto bg-white p-6 md:p-10">
                  <div className="max-w-2xl mx-auto">
                    {questionStemJsx}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="flex-1 flex overflow-hidden relative">
              {/* LEFT PANE: PASSAGE / CONTEXT / STIMULUS / GRAPH */}
              <div
                className={`h-full border-r border-slate-300 bg-white overflow-y-auto p-6 md:p-10 transition-all duration-300 relative ${
                  isExpandedLeft ? 'w-3/4' : 'w-1/2'
                }`}
              >
                {/* Left Pane Action Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10 select-none">
                  {/* Collapse Left Pane Button */}
                  <button
                    type="button"
                    onClick={() => setIsLeftCollapsed(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                    title="Collapse Passage Panel"
                  >
                    <Columns className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Collapse</span>
                  </button>

                  {/* Expand / Reset Split Button */}
                  <button
                    type="button"
                    onClick={() => setIsExpandedLeft((prev) => !prev)}
                    className="p-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                    title={isExpandedLeft ? 'Reset View Split (50/50)' : 'Expand Passage Pane (75%)'}
                  >
                    {isExpandedLeft ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Passage Text */}
                <div className="max-w-2xl mx-auto space-y-6 pt-2">
                  {currentQ.passageText && (
                    <div className="bluebook-passage-content font-serif text-black text-base md:text-lg leading-relaxed space-y-4">
                      <MarkdownRenderer
                        content={currentQ.passageText}
                        highlights={currentQuestionHighlights}
                        onHighlightClick={handleHighlightClick}
                      />
                    </div>
                  )}

                  {/* Graph Renderer */}
                  {currentQ.graphData && (currentQ.graphData.hasGraph || currentQ.graphData.croppedGraphUrl || currentQ.graphData.graphType) && (
                    <div className="my-6">
                      <GraphRenderer graphData={currentQ.graphData} />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: QUESTION & OPTIONS */}
              <div className={`h-full bg-white overflow-y-auto p-6 md:p-10 ${isExpandedLeft ? 'w-1/4' : 'w-1/2'}`}>
                <div className="max-w-xl mx-auto">
                  {questionStemJsx}
                </div>
              </div>
            </div>
          );
        }

        // Single Centered Pane (no left pane needed)
        return (
          <div className="flex-1 overflow-y-auto bg-white p-6 md:p-10">
            <div className="max-w-2xl mx-auto">
              {questionStemJsx}
            </div>
          </div>
        );
      })()}

      {/* ================= FLOATING BLUEBOOK HIGHLIGHT & ANNOTATION TOOLBAR ================= */}
      {pendingSelection && (
        <div
          style={{
            top: selectionPos ? `${selectionPos.top}px` : 'auto',
            left: selectionPos ? `${selectionPos.left}px` : '50%',
            transform: selectionPos ? 'none' : 'translateX(-50%)',
          }}
          className="highlight-toolbar-container fixed z-50 bg-slate-900 text-white shadow-2xl rounded-full px-3.5 py-1.5 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none border border-slate-700"
        >
          {/* Yellow Highlight Circle */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => applyHighlight('yellow')}
            className="w-7 h-7 rounded-full bg-[#fef08a] hover:scale-110 active:scale-95 transition-all shadow-xs border border-amber-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Yellow"
          >
            <span className="sr-only">Yellow</span>
          </button>

          {/* Blue Highlight Circle */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => applyHighlight('blue')}
            className="w-7 h-7 rounded-full bg-[#bae6fd] hover:scale-110 active:scale-95 transition-all shadow-xs border border-sky-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Blue"
          >
            <span className="sr-only">Blue</span>
          </button>

          {/* Pink Highlight Circle */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => applyHighlight('pink')}
            className="w-7 h-7 rounded-full bg-[#fbcfe8] hover:scale-110 active:scale-95 transition-all shadow-xs border border-pink-400 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Pink"
          >
            <span className="sr-only">Pink</span>
          </button>

          {/* Underline Tool */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => applyHighlight('underline')}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex flex-col items-center justify-center transition-colors text-white font-serif font-bold text-xs shrink-0 cursor-pointer"
            title="Underline text"
          >
            <span className="underline decoration-white decoration-2 underline-offset-2">U</span>
          </button>

          <div className="w-px h-5 bg-slate-700" />

          {/* Add Note Button */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => setShowNoteInputInToolbar((prev) => !prev)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showNoteInputInToolbar || noteInput
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title="Add Note"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>

          {/* Delete / Clear */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={clearSelection}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Inline Note Input */}
          {showNoteInputInToolbar && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-700">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add annotation note..."
                className="px-2.5 py-1 text-xs rounded-md bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHighlight('yellow');
                }}
                autoFocus
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => applyHighlight('yellow')}
                className="px-2 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-500 cursor-pointer"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= ACTIVE HIGHLIGHT CLICK POPOVER ================= */}
      {activeHighlight && (
        <div
          style={{
            top: `${activeHighlight.pos.top}px`,
            left: `${activeHighlight.pos.left}px`,
          }}
          className="highlight-popover-container fixed z-50 bg-white border border-slate-300 shadow-2xl rounded-2xl p-3 flex flex-col gap-2.5 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none min-w-[260px] max-w-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span>Highlight Options</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => removeHighlight(activeHighlight.item.id)}
                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                title="Remove highlight"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveHighlight(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Color Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'yellow')}
              className={`w-6 h-6 rounded-full bg-[#fef08a] border-2 transition-all cursor-pointer ${
                activeHighlight.item.color === 'yellow' ? 'border-slate-900 scale-110' : 'border-amber-300'
              }`}
              title="Yellow"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'blue')}
              className={`w-6 h-6 rounded-full bg-[#bae6fd] border-2 transition-all cursor-pointer ${
                activeHighlight.item.color === 'blue' ? 'border-slate-900 scale-110' : 'border-sky-300'
              }`}
              title="Blue"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'pink')}
              className={`w-6 h-6 rounded-full bg-[#fbcfe8] border-2 transition-all cursor-pointer ${
                activeHighlight.item.color === 'pink' ? 'border-slate-900 scale-110' : 'border-pink-300'
              }`}
              title="Pink"
            />
            <button
              type="button"
              onClick={() => updateHighlightColor(activeHighlight.item.id, 'underline')}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-serif font-bold transition-all cursor-pointer ${
                activeHighlight.item.color === 'underline' ? 'border-slate-900 bg-slate-100 scale-110' : 'border-slate-300'
              }`}
              title="Underline"
            >
              <span className="underline decoration-slate-900">U</span>
            </button>
          </div>

          {/* Note View / Edit */}
          {activeHighlight.editingNote ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={activeHighlight.noteText || ''}
                onChange={(e) => setActiveHighlight((prev) => prev ? { ...prev, noteText: e.target.value } : null)}
                placeholder="Write a note..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveHighlight((prev) => prev ? { ...prev, editingNote: false } : null)}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateHighlightNote(activeHighlight.item.id, activeHighlight.noteText || '')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save Note
                </button>
              </div>
            </div>
          ) : activeHighlight.item.noteText ? (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className="font-bold block text-[10px] text-amber-700 uppercase tracking-wider">Annotation Note</span>
                <p className="font-medium mt-0.5">{activeHighlight.item.noteText}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveHighlight((prev) => prev ? { ...prev, editingNote: true, noteText: prev.item.noteText } : null)}
                className="p-1 text-amber-700 hover:text-amber-900 rounded hover:bg-amber-100"
                title="Edit note"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveHighlight((prev) => prev ? { ...prev, editingNote: true, noteText: '' } : null)}
              className="w-full py-1.5 px-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Add Annotation Note</span>
            </button>
          )}
        </div>
      )}

      {/* ================= DESMOS GRAPHING CALCULATOR ================= */}
      {showCalculator && (
        <div className="fixed top-16 right-6 z-50 w-96 md:w-[480px] h-[520px] bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="h-10 bg-slate-900 text-white px-4 flex items-center justify-between shrink-0 select-none">
            <span className="text-xs font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>Desmos Graphing Calculator</span>
            </span>
            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="p-1 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <iframe
            src="https://www.desmos.com/calculator"
            title="Desmos Graphing Calculator"
            className="w-full flex-1 border-0"
          />
        </div>
      )}

      {/* ================= BOTTOM BLUEBOOK NAVIGATION FOOTER ================= */}
      <footer className="h-16 border-t border-slate-300 bg-white px-4 md:px-10 flex items-center justify-between shrink-0 select-none shadow-2xs">
        {/* Left Section Label / Student ID */}
        <div className="text-xs font-semibold text-slate-600 hidden sm:block">
          {sectionName}
        </div>

        {/* Center: Question Navigator Pill [ Question 1 of 27 ^ ] */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowQuestionNav((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <ChevronUp className={`w-4 h-4 transition-transform ${showQuestionNav ? 'rotate-180' : ''}`} />
          </button>

          {/* Question Navigator Grid Popover */}
          {showQuestionNav && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 md:w-96 p-4 rounded-2xl bg-white border border-slate-300 shadow-2xl z-50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900">Question Navigator</span>
                <span className="text-[11px] text-slate-500">
                  {Object.keys(answers).length} of {totalQuestions} Answered
                </span>
              </div>

              {/* Grid of Squares */}
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1">
                {questions.map((q, idx) => {
                  const isAns = !!answers[idx];
                  const isMarked = !!markedForReview[idx];
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
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
                      <span>{idx + 1}</span>
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

        {/* Right Navigation: Back & Check Answer / Next / Finish */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Back
          </button>

          {instantFeedback && !isChecked && currentAnswer ? (
            <button
              type="button"
              onClick={() => {
                setCheckedQuestions((prev) => ({ ...prev, [currentIndex]: true }));
              }}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Check Answer</span>
            </button>
          ) : currentIndex < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => {
                if (instantFeedback && !isChecked && currentAnswer) {
                  setCheckedQuestions((prev) => ({ ...prev, [currentIndex]: true }));
                } else {
                  setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
                }
              }}
              className="px-6 py-2.5 rounded-full bg-[#0073e6] hover:bg-[#005fb8] text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (instantFeedback && !isChecked && currentAnswer) {
                  setCheckedQuestions((prev) => ({ ...prev, [currentIndex]: true }));
                } else {
                  handleCompleteTest();
                }
              }}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Finish Test</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

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
              <div className="text-center py-10 text-xs text-slate-400 italic space-y-2">
                <Info className="w-6 h-6 mx-auto text-slate-300" />
                <p>No highlights or annotations yet.</p>
                <p className="text-[11px] text-slate-400">Select any text in a passage or question to highlight and add notes.</p>
              </div>
            ) : (
              highlights.map((h) => {
                let tagStyle = 'bg-[#fef08a] border-amber-300 text-amber-950';
                if (h.color === 'blue') tagStyle = 'bg-[#bae6fd] border-sky-300 text-sky-950';
                if (h.color === 'pink') tagStyle = 'bg-[#fbcfe8] border-pink-300 text-pink-950';
                if (h.color === 'underline') tagStyle = 'bg-white border-slate-300 text-slate-900';

                return (
                  <div key={h.id} className={`p-3 rounded-xl border space-y-2 text-xs ${tagStyle}`}>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentIndex(h.questionIndex);
                          setShowNotesDrawer(false);
                        }}
                        className="hover:underline text-left cursor-pointer"
                      >
                        Question {h.questionIndex + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHighlight(h.id)}
                        className="hover:text-rose-600 p-1 cursor-pointer"
                        title="Delete highlight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className={`font-serif italic p-2 rounded bg-white/80 border border-black/10 text-slate-900 ${h.color === 'underline' ? 'underline decoration-2' : ''}`}>
                      &quot;{h.selectedText}&quot;
                    </p>
                    {h.noteText && (
                      <div className="bg-white/90 p-2 rounded border border-black/5">
                        <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">Note:</span>
                        <p className="font-medium text-slate-900 mt-0.5">{h.noteText}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= BLUEBOOK DIRECTIONS MODAL ================= */}
      {showDirections && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-300 space-y-5 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Directions for {sectionName}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowDirections(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700 leading-relaxed font-serif">
              {isMathSection ? (
                <>
                  <p>
                    The questions in this section address a number of important math skills.
                  </p>
                  <p>
                    Use of a calculator is permitted for all questions. A reference sheet with formulas is available by clicking <strong>Reference</strong> in the top header.
                  </p>
                  <p>
                    Unless a question indicates otherwise:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs md:text-sm pl-2">
                    <li>All variables and expressions represent real numbers.</li>
                    <li>Figures provided in this test are drawn to scale unless specifically stated otherwise.</li>
                    <li>All figures lie in a plane.</li>
                    <li>The domain of a given function $f$ is the set of all real numbers $x$ for which $f(x)$ is a real number.</li>
                  </ul>
                  <p>
                    For student-produced response questions, enter your answer in the box provided on the screen.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph.
                  </p>
                  <p>
                    Read each passage and question carefully, and then choose the best answer to the question based on the passage(s).
                  </p>
                  <p>
                    All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.
                  </p>
                  <p>
                    You may highlight text and make notes using the <strong>Annotate</strong> tool.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDirections(false)}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Close Directions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SAT MATH REFERENCE SHEET MODAL ================= */}
      {showFormulaSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-300 max-h-[88vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>College Board SAT Math Reference Sheet</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowFormulaSheet(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reference Formulas Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-800">
              {/* Circle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Circle</div>
                <div className="text-blue-700 font-mono font-semibold">$A = \pi r^2$</div>
                <div className="text-blue-700 font-mono font-semibold">$C = 2\pi r$</div>
              </div>

              {/* Rectangle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Rectangle</div>
                <div className="text-blue-700 font-mono font-semibold">$A = \ell w$</div>
              </div>

              {/* Triangle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Triangle</div>
                <div className="text-blue-700 font-mono font-semibold">$A = \frac{1}{2} b h$</div>
              </div>

              {/* Pythagorean Theorem */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Pythagorean Theorem</div>
                <div className="text-blue-700 font-mono font-semibold">$c^2 = a^2 + b^2$</div>
              </div>

              {/* Special Right Triangles */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Special Right Triangles</div>
                <div className="text-blue-700 font-mono">$30^\circ-60^\circ-90^\circ$: $x, x\sqrt{3}, 2x$</div>
                <div className="text-blue-700 font-mono">$45^\circ-45^\circ-90^\circ$: $s, s, s\sqrt{2}$</div>
              </div>

              {/* Rectangular Prism */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Rectangular Solid</div>
                <div className="text-blue-700 font-mono font-semibold">$V = \ell w h$</div>
              </div>

              {/* Cylinder */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Right Circular Cylinder</div>
                <div className="text-blue-700 font-mono font-semibold">$V = \pi r^2 h$</div>
              </div>

              {/* Sphere */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Sphere</div>
                <div className="text-blue-700 font-mono font-semibold">$V = \frac{4}{3} \pi r^3$</div>
              </div>

              {/* Cone */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Right Circular Cone</div>
                <div className="text-blue-700 font-mono font-semibold">$V = \frac{1}{3} \pi r^2 h$</div>
              </div>

              {/* Pyramid */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 text-sm">Pyramid</div>
                <div className="text-blue-700 font-mono font-semibold">$V = \frac{1}{3} \ell w h$</div>
              </div>

              {/* Circle Degrees & Radians */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 col-span-1 sm:col-span-2 md:col-span-2">
                <div className="font-bold text-slate-900 text-sm">Angle & Circle Rules</div>
                <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                  <li>The number of degrees of arc in a circle is $360^\circ$.</li>
                  <li>The number of radians of arc in a circle is $2\pi$.</li>
                  <li>The sum of the measures in degrees of the angles of a triangle is $180^\circ$.</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFormulaSheet(false)}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Close Reference Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
