'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';

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
  instantFeedback?: boolean;
  onFinishTest: (results: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => void;
  onClose: () => void;
}

export default function BluebookTestShell({
  title = 'Specialized Training',
  sectionName = 'SAT Practice Section',
  questions,
  timerSeconds = 0,
  instantFeedback = false,
  onFinishTest,
  onClose,
}: BluebookTestShellProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
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

  // UI Panels
  const [showQuestionNav, setShowQuestionNav] = useState<boolean>(false);
  const [showFormulaSheet, setShowFormulaSheet] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [isExpandedLeft, setIsExpandedLeft] = useState<boolean>(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number>(timerSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  const handleCompleteTest = useCallback(() => {
    onFinishTest({
      answers,
      markedForReview,
      timeSpentSeconds: elapsedSeconds,
    });
  }, [answers, markedForReview, elapsedSeconds, onFinishTest]);

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      if (timerSeconds > 0) {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleCompleteTest();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timerSeconds, handleCompleteTest]);

  // Listen for text selection in passage or question
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const selectedStr = selection.toString().trim();
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setPendingSelection(selectedStr);
        setSelectionPos({
          top: Math.max(70, rect.top - 55),
          left: Math.max(20, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 120)),
        });
      } catch (e) {
        setPendingSelection(selectedStr);
      }
    }
  };

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
  };

  // Option Elimination Toggle
  const toggleEliminateChoice = (qIdx: number, choiceIdx: number) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-900 font-sans flex flex-col select-text overflow-hidden antialiased">
      {/* ================= TOP BLUEBOOK HEADER ================= */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 md:px-8 flex items-center justify-between shrink-0 select-none shadow-2xs">
        {/* Left: Test / Section Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          <span className="hidden sm:inline-block text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {sectionName}
          </span>
        </div>

        {/* Center: Timer */}
        {timerSeconds > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Right Tools: Calculator, Highlights & Notes, Formula Sheet, Exit */}
        <div className="flex items-center gap-2 md:gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setShowCalculator((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
              showCalculator
                ? 'bg-blue-50 text-blue-900 border-blue-300 font-bold'
                : 'hover:bg-slate-100 border-transparent text-slate-700'
            }`}
            title="Open Graphing Calculator"
          >
            <Calculator className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Calculator</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotesDrawer((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
              showNotesDrawer || highlights.length > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'hover:bg-slate-100 border-transparent text-slate-700'
            }`}
          >
            <Highlighter className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Highlights & Notes</span>
            {highlights.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                {highlights.length}
              </span>
            )}
          </button>

          {currentQ.subject === 'Math' && (
            <button
              type="button"
              onClick={() => setShowFormulaSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Reference Sheet</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            title="Exit Test Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ================= MAIN TEST CONTENT ================= */}
      {(() => {
        const hasLeftPane = Boolean(
          currentQ.passageText ||
          (currentQ.graphData && (currentQ.graphData.hasGraph || currentQ.graphData.croppedGraphUrl || currentQ.graphData.graphType)) ||
          currentQ.imageDataUrl
        );

        const questionStemJsx = (
          <div className="space-y-6">
            {/* Question Header: Number, Mark for Review, Option Eliminator */}
            <div className="flex items-center justify-between pb-4 border-b border-dashed border-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {currentIndex + 1}
                </div>

                <button
                  type="button"
                  onClick={toggleBookmark}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isCurrentMarked
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <Bookmark
                    className={`w-4 h-4 ${isCurrentMarked ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`}
                  />
                  <span>Mark for Review</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsEliminatorActive((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-tighter transition-colors ${
                  isEliminatorActive
                    ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                    : 'hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Toggle Option Eliminator (Strikethrough tool)"
              >
                <span className="line-through decoration-2 decoration-rose-500">ABC</span>
              </button>
            </div>

            {/* Question Prompt */}
            <div className="text-black font-serif text-base md:text-lg leading-relaxed">
              <MarkdownRenderer content={currentQ.questionPrompt} highlights={currentQuestionHighlights} />
            </div>

            {/* Answer Choices List (A, B, C, D) */}
            {currentQ.choices && currentQ.choices.length > 0 && (
              <div className="space-y-3 pt-2">
                {currentQ.choices.map((choiceText, cIdx) => {
                  const label = choiceLabels[cIdx] || `${cIdx + 1}`;
                  const isSelected = currentAnswer === label || currentAnswer === choiceText;
                  const isChoiceEliminated = !!qEliminated[cIdx];

                  return (
                    <div
                      key={cIdx}
                      className={`group relative flex items-start gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                          : isChoiceEliminated
                          ? 'border-slate-200 bg-slate-50 opacity-40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      onClick={() => {
                        if (isEliminatorActive) {
                          toggleEliminateChoice(currentIndex, cIdx);
                        } else {
                          handleSelectAnswer(label);
                        }
                      }}
                    >
                      {/* Option Badge Circle */}
                      <div
                        className={`w-7 h-7 rounded-full border-2 text-xs font-bold flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 text-slate-800 bg-white'
                        }`}
                      >
                        {label}
                      </div>

                      {/* Option Text */}
                      <div
                        className={`flex-1 text-sm md:text-base font-serif text-black leading-snug pt-0.5 ${
                          isChoiceEliminated ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        <MarkdownRenderer content={choiceText} highlights={currentQuestionHighlights} />
                      </div>

                      {/* Manual Strikethrough Button on right edge */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEliminateChoice(currentIndex, cIdx);
                        }}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono font-extrabold ${
                          isChoiceEliminated ? 'opacity-100 text-rose-600' : ''
                        }`}
                        title="Eliminate choice"
                      >
                        <span className="line-through">ABC</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grid-in Student Produced Response */}
            {(!currentQ.choices || currentQ.choices.length === 0) && (
              <div className="space-y-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Student-Produced Response
                </label>
                <input
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Enter answer (e.g., 23, 4/3, .75)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {/* Instant Feedback Explanation */}
            {instantFeedback && currentAnswer && (
              <div
                className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 ${
                  currentQ.correctAnswer &&
                  (currentAnswer === currentQ.correctAnswer ||
                    currentAnswer.toLowerCase() === currentQ.correctAnswer.toLowerCase())
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  {currentQ.correctAnswer &&
                  (currentAnswer === currentQ.correctAnswer ||
                    currentAnswer.toLowerCase() === currentQ.correctAnswer.toLowerCase()) ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Correct Answer!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Official Answer: {currentQ.correctAnswer || 'N/A'}</span>
                    </>
                  )}
                </div>
                {currentQ.explanation && (
                  <div className="pt-1 border-t border-slate-200/50">
                    <MathRenderer text={currentQ.explanation} />
                  </div>
                )}
              </div>
            )}
          </div>
        );

        if (hasLeftPane) {
          return (
            <div className="flex-1 flex overflow-hidden relative">
              {/* LEFT PANE: PASSAGE / CONTEXT / STIMULUS / GRAPH */}
              <div
                onMouseUp={handleTextSelect}
                className={`h-full border-r border-slate-200 bg-white overflow-y-auto p-6 md:p-10 transition-all duration-300 relative ${
                  isExpandedLeft ? 'w-3/4' : 'w-1/2'
                }`}
              >
                {/* Pane Expand Button */}
                <button
                  type="button"
                  onClick={() => setIsExpandedLeft((prev) => !prev)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors z-10"
                  title={isExpandedLeft ? 'Reset View Split' : 'Expand Passage Pane'}
                >
                  {isExpandedLeft ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Passage Text */}
                <div className="max-w-2xl mx-auto space-y-6">
                  {currentQ.passageText && (
                    <div className="font-serif text-black text-base md:text-lg leading-relaxed space-y-4">
                      <MarkdownRenderer content={currentQ.passageText} highlights={currentQuestionHighlights} />
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

              {/* RIGHT PANE */}
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
          <div className="flex-1 overflow-y-auto bg-white p-6 md:p-10" onMouseUp={handleTextSelect}>
            <div className="max-w-2xl mx-auto">
              {questionStemJsx}
            </div>
          </div>
        );
      })()}

      {/* ================= FLOATING BLUEBOOK HIGHLIGHT TOOLBAR ================= */}
      {pendingSelection && (
        <div
          style={{
            top: selectionPos ? `${selectionPos.top}px` : 'auto',
            left: selectionPos ? `${selectionPos.left}px` : '50%',
            transform: selectionPos ? 'none' : 'translateX(-50%)',
          }}
          className="fixed z-50 bg-white/95 backdrop-blur-md border border-slate-300 shadow-2xl rounded-full px-3.5 py-1.5 flex items-center gap-2.5 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Yellow Circle */}
          <button
            type="button"
            onClick={() => applyHighlight('yellow')}
            className="w-7 h-7 rounded-full bg-[#fef08a] hover:scale-110 active:scale-95 transition-all shadow-xs border border-amber-300 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Yellow"
          >
            <span className="sr-only">Yellow</span>
          </button>

          {/* Blue Circle */}
          <button
            type="button"
            onClick={() => applyHighlight('blue')}
            className="w-7 h-7 rounded-full bg-[#bae6fd] hover:scale-110 active:scale-95 transition-all shadow-xs border border-sky-300 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Blue"
          >
            <span className="sr-only">Blue</span>
          </button>

          {/* Pink Circle */}
          <button
            type="button"
            onClick={() => applyHighlight('pink')}
            className="w-7 h-7 rounded-full bg-[#fbcfe8] hover:scale-110 active:scale-95 transition-all shadow-xs border border-pink-300 flex items-center justify-center shrink-0 cursor-pointer"
            title="Highlight Pink"
          >
            <span className="sr-only">Pink</span>
          </button>

          {/* Underline Tool */}
          <button
            type="button"
            onClick={() => applyHighlight('underline')}
            className="w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-100 flex flex-col items-center justify-center transition-colors text-slate-800 font-serif font-bold text-sm shrink-0 cursor-pointer"
            title="Underline / Style"
          >
            <span className="underline decoration-slate-900 decoration-2 underline-offset-2">U</span>
          </button>

          <div className="w-px h-5 bg-slate-200" />

          {/* Delete / Clear */}
          <button
            type="button"
            onClick={clearSelection}
            className="w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-600 hover:text-rose-600 shrink-0 cursor-pointer"
            title="Delete / Clear selection"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Add Note Button */}
          <button
            type="button"
            onClick={() => setShowNoteInputInToolbar((prev) => !prev)}
            className={`w-8 h-8 rounded-full border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
              showNoteInputInToolbar || noteInput
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
            title="Add Note"
          >
            <FilePlus className="w-4 h-4" />
          </button>

          {/* Inline Note Input */}
          {showNoteInputInToolbar && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add note..."
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHighlight('yellow');
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => applyHighlight('yellow')}
                className="px-2 py-1 rounded-md bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= DESMOS GRAPHING CALCULATOR MODAL ================= */}
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
              className="p-1 hover:bg-slate-800 rounded text-slate-300"
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

      {/* ================= BOTTOM NAVIGATION BAR ================= */}
      <footer className="h-16 border-t border-slate-200 bg-white px-6 md:px-10 flex items-center justify-between shrink-0 select-none shadow-2xs">
        {/* Left Section Label */}
        <div className="text-xs font-serif font-semibold text-slate-500 hidden sm:block">
          {sectionName}
        </div>

        {/* Center: Question Navigator Pill [ Question 1 of 10 ^ ] */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowQuestionNav((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <ChevronUp className={`w-4 h-4 transition-transform ${showQuestionNav ? 'rotate-180' : ''}`} />
          </button>

          {/* Question Navigator Grid Drawer Popover */}
          {showQuestionNav && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 md:w-96 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 space-y-3">
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
                      className={`h-10 rounded-xl border text-xs font-bold relative flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500'
                          : isAns
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isMarked && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
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
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Review
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Navigation: Back & Next / Finish (Bluebook Cyan Button) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold transition-colors"
          >
            Back
          </button>

          {currentIndex < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="px-6 py-2.5 rounded-full bg-[#00a2e8] hover:bg-[#008cc9] text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteTest}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <span>Finish Test</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* ================= HIGHLIGHTS & NOTES SIDE DRAWER ================= */}
      {showNotesDrawer && (
        <div className="absolute top-14 right-0 bottom-16 w-80 md:w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Highlighter className="w-4 h-4 text-amber-500" />
              <span>Highlights & Annotations</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowNotesDrawer(false)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-4 space-y-3 flex-1">
            {highlights.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 italic">
                No text highlighted yet. Select text in the passage or question to add notes.
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
                      <span>Question {h.questionIndex + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeHighlight(h.id)}
                        className="hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className={`font-serif italic p-2 rounded bg-white/70 border border-black/10 ${h.color === 'underline' ? 'underline decoration-2' : ''}`}>
                      &quot;{h.selectedText}&quot;
                    </p>
                    {h.noteText && <p className="font-medium">Note: {h.noteText}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= FORMULA SHEET MODAL ================= */}
      {showFormulaSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>SAT Math Reference Sheet</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowFormulaSheet(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-serif text-slate-800">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Area of Circle</div>
                <div>$A = \pi r^2$</div>
                <div>$C = 2\pi r$</div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Area of Rectangle</div>
                <div>$A = \ell w$</div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Area of Triangle</div>
                <div>$A = \frac{1}{2} b h$</div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Pythagorean Theorem</div>
                <div>$c^2 = a^2 + b^2$</div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Special Triangles</div>
                <div>$x, x\sqrt{3}, 2x$ (30-60-90)</div>
                <div>$s, s, s\sqrt{2}$ (45-45-90)</div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="font-bold text-slate-900">Volume</div>
                <div>$V = \ell w h$</div>
                <div>$V = \pi r^2 h$</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
