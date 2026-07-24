'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  MessageSquare,
  PenTool,
  Bookmark,
  Award,
  BookOpen,
  Filter,
  Send,
  Loader2,
  X,
  ImageIcon,
} from 'lucide-react';
import { SATErrorItem, SATSubject, MasteryStatus } from '@/types/sat';
import { recordReview } from '@/lib/db';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import Scratchpad from './Scratchpad';

interface FlashcardEngineProps {
  errors: SATErrorItem[];
  onReviewCompleted: (updatedItem: SATErrorItem) => void;
  onExitReview: () => void;
}

export default function FlashcardEngine({
  errors,
  onReviewCompleted,
  onExitReview,
}: FlashcardEngineProps) {
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const [filterMastery, setFilterMastery] = useState<string>('ConfusedOrDue');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Review states
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(true);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);

  // AI Tutor Ask Drawer
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Compute deck dynamically using useMemo
  const deck = React.useMemo(() => {
    let filtered = [...errors];

    if (filterSubject !== 'All') {
      filtered = filtered.filter((e) => e.subject === filterSubject);
    }

    if (filterMastery === 'ConfusedOrDue') {
      const now = new Date().getTime();
      filtered = filtered.filter(
        (e) =>
          e.masteryStatus === 'Confused' ||
          e.masteryStatus === 'Learning' ||
          new Date(e.nextReviewDate).getTime() <= now
      );
    } else if (filterMastery !== 'All') {
      filtered = filtered.filter((e) => e.masteryStatus === filterMastery);
    }

    return filtered;
  }, [errors, filterSubject, filterMastery]);

  const resetCardState = () => {
    setCurrentIndex(0);
    setSelectedImageIndex(0);
    setIsRevealed(false);
    setSelectedChoice(null);
    setTimeSpentSeconds(0);
  };

  // Timer for time spent per question
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const currentItem = deck[currentIndex];

  const imagesList = React.useMemo(() => {
    if (!currentItem) return [];
    if (currentItem.imageDataUrls && currentItem.imageDataUrls.length > 0) {
      return currentItem.imageDataUrls;
    }
    if (currentItem.imageDataUrl) {
      return [currentItem.imageDataUrl];
    }
    return [];
  }, [currentItem]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleSelfAssess = async (rating: 'confused' | 'learning' | 'mastered') => {
    if (!currentItem) return;

    if (rating === 'mastered') {
      // Trigger celebrate confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (err) {
        // ignore if confetti fails
      }
    }

    const updated = await recordReview(currentItem.id, rating, timeSpentSeconds);
    onReviewCompleted(updated);

    // Advance to next card or loop
    setIsRevealed(false);
    setSelectedChoice(null);
    setSelectedImageIndex(0);
    setTimeSpentSeconds(0);

    if (currentIndex + 1 < deck.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished current round!
      setCurrentIndex(0);
    }
  };

  const handleAskAi = async () => {
    if (!aiPrompt.trim() || !currentItem) return;
    setAiLoading(true);
    setAiResponse(null);

    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: currentItem.questionText,
          aiTakeaway: currentItem.aiTakeaway,
          explanation: currentItem.explanation,
          userPrompt: aiPrompt,
        }),
      });

      const json = await res.json();
      if (res.ok && json.text) {
        setAiResponse(json.text);
      } else {
        setAiResponse(json.error || 'Failed to get answer.');
      }
    } catch (err: any) {
      setAiResponse('Connection error. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  if (deck.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No Due Reviews Found!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
            You are all caught up on your active recall reviews for this filter. Try changing your filters or auto-log new SAT error screenshots!
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setFilterSubject('All');
                setFilterMastery('All');
                resetCardState();
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Show All Error Log Cards
            </button>
            <button
              onClick={onExitReview}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Deck Controls & Review Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onExitReview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Card {currentIndex + 1} of {deck.length}
            </span>
            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Subject Filter */}
          <select
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value);
              resetCardState();
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Subjects</option>
            <option value="Math">Math Only</option>
            <option value="Reading & Writing">Reading & Writing</option>
          </select>

          {/* Deck Filter */}
          <select
            value={filterMastery}
            onChange={(e) => {
              setFilterMastery(e.target.value);
              resetCardState();
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="ConfusedOrDue">Due & Confused</option>
            <option value="Confused">Confused Only 🔴</option>
            <option value="Learning">Learning Only 🟡</option>
            <option value="Mastered">Mastered Deck 🟢</option>
            <option value="All">All Items</option>
          </select>

          {/* Scratchpad Toggle */}
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              showScratchpad
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scratchpad</span>
          </button>
        </div>
      </div>

      {/* Main Flashcard Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden"
        >
          {/* Card Header Badges */}
          <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full font-bold ${
                  currentItem.subject === 'Math'
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                }`}
              >
                {currentItem.subject}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                {currentItem.subTopic}
              </span>
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                {currentItem.mistakeType}
              </span>
              {currentItem.testSource && (
                <span className="text-slate-600 dark:text-slate-300 font-normal">
                  • {currentItem.testSource}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                {Math.floor(timeSpentSeconds / 60)}m {timeSpentSeconds % 60}s
              </span>

              {/* Status Badge */}
              <span
                className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                  currentItem.masteryStatus === 'Mastered'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : currentItem.masteryStatus === 'Learning'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {currentItem.masteryStatus === 'Mastered' && '🟢 Mastered'}
                {currentItem.masteryStatus === 'Learning' && '🟡 Learning'}
                {currentItem.masteryStatus === 'Confused' && '🔴 Still Confused'}
              </span>
            </div>
          </div>

          {/* Card Body Grid */}
          <div className="p-6 space-y-6">
            {/* Top Screenshot or Text Display */}
            <div className="space-y-4">
              {imagesList.length > 0 && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-2 overflow-hidden max-h-72 flex justify-center items-center">
                    <img
                      src={imagesList[selectedImageIndex] || imagesList[0]}
                      alt="Question screenshot"
                      className="max-h-68 w-auto object-contain rounded"
                    />
                  </div>
                  {imagesList.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {imagesList.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`w-16 h-12 rounded-lg border overflow-hidden shrink-0 bg-slate-950 p-0.5 transition-all ${
                            selectedImageIndex === idx
                              ? 'border-blue-500 ring-2 ring-blue-500/40 opacity-100'
                              : 'border-slate-300 dark:border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Render detected graph or table if available */}
              {currentItem.graphData && currentItem.graphData.hasGraph && (
                <GraphRenderer
                  graphData={currentItem.graphData}
                  imageDataUrl={currentItem.imageDataUrl}
                  imageDataUrls={currentItem.imageDataUrls}
                />
              )}

              {/* Question Text */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-2">
                  Question Text
                </h3>
                <div className="text-slate-900 dark:text-slate-100 text-base font-medium leading-relaxed">
                  <MathRenderer text={currentItem.questionText} />
                </div>
              </div>

              {/* Answer Choices Grid */}
              {currentItem.answerChoices && currentItem.answerChoices.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentItem.answerChoices.map((choice) => {
                    const isCorrect = choice.label === currentItem.correctAnswer;
                    const isSelected = selectedChoice === choice.label;

                    let choiceBg =
                      'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                    if (isRevealed) {
                      if (isCorrect) {
                        choiceBg =
                          'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/20';
                      } else if (isSelected) {
                        choiceBg =
                          'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-200 line-through opacity-80';
                      }
                    } else if (isSelected) {
                      choiceBg =
                        'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-200 font-semibold ring-2 ring-blue-500/20';
                    }

                    return (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() => setSelectedChoice(choice.label)}
                        className={`p-3.5 rounded-xl border-2 text-left text-sm transition-all flex items-start gap-3 ${choiceBg}`}
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                          {choice.label}
                        </span>
                        <span className="flex-1 mt-0.5"><MathRenderer text={choice.text} /></span>

                        {isRevealed && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {isRevealed && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Interactive Digital Scratchpad */}
            {showScratchpad && <Scratchpad height={220} />}

            {/* Reveal Answer Section */}
            {!isRevealed ? (
              <div className="pt-2 flex flex-col items-center justify-center">
                <button
                  onClick={handleReveal}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-base shadow-lg transition-all scale-100 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  <span>Reveal Answer & Active Recall Takeaway</span>
                </button>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                  Try solving in your head or on the scratchpad first!
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800"
              >
                {/* Correct Answer & AI Takeaway Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-800/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-sm shadow-xs">
                        Correct Answer: {currentItem.correctAnswer}
                      </span>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        AI Rule to Remember
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAiModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      <span>Ask AI Tutor</span>
                    </button>
                  </div>

                  <div className="text-sm font-semibold text-amber-950 dark:text-amber-100 leading-relaxed">
                    <MarkdownRenderer content={currentItem.aiTakeaway} />
                  </div>
                </div>

                {/* Step-by-Step Explanation */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">
                    Step-by-Step Breakdown
                  </h4>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <MarkdownRenderer content={currentItem.explanation} />
                  </div>

                  {currentItem.userNotes && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 italic">
                      <strong className="text-slate-700 dark:text-slate-300 font-semibold not-italic">
                        Your Personal Note:
                      </strong>{' '}
                      &quot;{currentItem.userNotes}&quot;
                    </div>
                  )}
                </div>

                {/* Self-Assessment / Spaced Repetition Rating Buttons */}
                <div className="pt-4 space-y-2">
                  <p className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    How well did you recall this answer? (Spaced Repetition Rating)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelfAssess('confused')}
                      className="p-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/80 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 group shadow-xs"
                    >
                      <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                        🔴 Still Confused
                      </span>
                      <span className="text-[11px] font-normal text-rose-700/80 dark:text-rose-300/70">
                        Re-queue for tomorrow
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelfAssess('learning')}
                      className="p-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/80 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 group shadow-xs"
                    >
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        🟡 Got it, but slow
                      </span>
                      <span className="text-[11px] font-normal text-amber-700/80 dark:text-amber-300/70">
                        Re-queue in 3 days
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelfAssess('mastered')}
                      className="p-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 group shadow-xs"
                    >
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        🟢 Mastered! 🎉
                      </span>
                      <span className="text-[11px] font-normal text-emerald-700/80 dark:text-emerald-300/70">
                        Move to Mastered deck
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Ask AI Tutor Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Ask AI SAT Tutor
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ask Gemini to explain this question in simpler terms, break down a specific formula, or generate a similar practice problem.
            </p>

            <div className="space-y-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g., "Can you explain why option C is wrong?" or "Give me a similar practice problem"'
                rows={3}
                className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={handleAskAi}
                disabled={aiLoading || !aiPrompt.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Tutor is thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Ask Question</span>
                  </>
                )}
              </button>
            </div>

            {aiResponse && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 space-y-2 max-h-72 overflow-y-auto leading-relaxed">
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  AI Tutor Answer:
                </p>
                <MarkdownRenderer content={aiResponse} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
