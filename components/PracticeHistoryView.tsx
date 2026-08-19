'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Sparkles,
  Search,
  Filter,
  BarChart3,
  Bookmark,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Eye,
  SlidersHorizontal,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PracticeHistoryItem, SavedTestSession, HistoryQuestionSummary, RawSATQuestion, SATErrorItem } from '@/types/sat';
import { deletePracticeHistoryItem, clearPracticeHistory, deleteSavedTestSession, saveError } from '@/lib/db';
import { transformRawToErrorItem } from '@/lib/questionBank';
import MathRenderer from './MathRenderer';
import MarkdownRenderer from './MarkdownRenderer';

interface PracticeHistoryViewProps {
  history: PracticeHistoryItem[];
  savedSessions: SavedTestSession[];
  onRefreshData?: () => void;
  onResumeSavedTest: (session: SavedTestSession) => void;
  onRetakeTest?: (historyItem: PracticeHistoryItem) => void;
  onOpenBuilder?: () => void;
  onOpenExams?: () => void;
}

export default function PracticeHistoryView({
  history,
  savedSessions,
  onRefreshData,
  onResumeSavedTest,
  onRetakeTest,
  onOpenBuilder,
  onOpenExams,
}: PracticeHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recent' | 'score_high' | 'score_low' | 'duration'>('recent');

  // Question review modal state
  const [selectedReviewItem, setSelectedReviewItem] = useState<PracticeHistoryItem | null>(null);
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(null);
  const [addedErrors, setAddedErrors] = useState<Record<string | number, boolean>>({});
  const [savingAllMissed, setSavingAllMissed] = useState<boolean>(false);
  const [savedAllSuccess, setSavedAllSuccess] = useState<boolean>(false);

  // Filtered Saved Sessions
  const filteredSavedSessions = useMemo(() => {
    if (!savedSessions) return [];
    return savedSessions;
  }, [savedSessions]);

  // Filtered & Sorted History
  const filteredHistory = useMemo(() => {
    let list = [...(history || [])];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.section?.toLowerCase().includes(q) ||
          item.domain?.toLowerCase().includes(q) ||
          item.examName?.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'All') {
      if (filterType === 'Official') {
        list = list.filter((item) => item.examType === 'official_full' || item.examType === 'official_section');
      } else if (filterType === 'Custom') {
        list = list.filter((item) => item.examType === 'custom_drill');
      } else if (filterType === 'Math') {
        list = list.filter((item) => item.section === 'Math' || item.domain?.toLowerCase().includes('math'));
      } else if (filterType === 'RW') {
        list = list.filter(
          (item) =>
            item.section === 'Reading and Writing' ||
            item.domain?.toLowerCase().includes('reading') ||
            item.domain?.toLowerCase().includes('conventions') ||
            item.domain?.toLowerCase().includes('craft')
        );
      }
    }

    list.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      }
      if (sortBy === 'score_high') {
        const scoreA = a.percentage ?? (a.score && a.questionCount ? (a.score / a.questionCount) * 100 : 0);
        const scoreB = b.percentage ?? (b.score && b.questionCount ? (b.score / b.questionCount) * 100 : 0);
        return scoreB - scoreA;
      }
      if (sortBy === 'score_low') {
        const scoreA = a.percentage ?? (a.score && a.questionCount ? (a.score / a.questionCount) * 100 : 0);
        const scoreB = b.percentage ?? (b.score && b.questionCount ? (b.score / b.questionCount) * 100 : 0);
        return scoreA - scoreB;
      }
      if (sortBy === 'duration') {
        return (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0);
      }
      return 0;
    });

    return list;
  }, [history, searchQuery, filterType, sortBy]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        totalTests: 0,
        totalQuestions: 0,
        avgAccuracy: 0,
        totalTimeSeconds: 0,
        bestScaledScore: 0,
      };
    }

    let totalQs = 0;
    let totalCorrect = 0;
    let totalTime = 0;
    let maxScaled = 0;

    history.forEach((item) => {
      totalQs += item.questionCount || 0;
      totalCorrect += item.score || 0;
      totalTime += item.timeSpentSeconds || 0;
      if (item.scaledTotalScore && item.scaledTotalScore > maxScaled) {
        maxScaled = item.scaledTotalScore;
      }
    });

    const avgAccuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;

    return {
      totalTests: history.length,
      totalQuestions: totalQs,
      avgAccuracy,
      totalTimeSeconds: totalTime,
      bestScaledScore: maxScaled,
    };
  }, [history]);

  // Format seconds to human readable
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Format Date
  const formatDate = (isoString: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Handle delete single history
  const handleDeleteHistory = (id: string) => {
    if (confirm('Are you sure you want to remove this test record from your history?')) {
      deletePracticeHistoryItem(id);
      if (onRefreshData) onRefreshData();
    }
  };

  // Handle delete saved session
  const handleDeleteSavedSession = (id: string) => {
    if (confirm('Discard this saved test in progress?')) {
      deleteSavedTestSession(id);
      if (onRefreshData) onRefreshData();
    }
  };

  // Handle clear all history
  const handleClearAllHistory = () => {
    if (confirm('Are you sure you want to clear your entire completed practice history?')) {
      clearPracticeHistory();
      if (onRefreshData) onRefreshData();
    }
  };

  // Add individual question to error book
  const handleAddQuestionToErrorBook = async (qSummary: HistoryQuestionSummary) => {
    try {
      const rawFallback: RawSATQuestion = {
        question_id: typeof qSummary.questionId === 'number' ? qSummary.questionId : Date.now(),
        question_no: qSummary.questionNo || 1,
        question_type: qSummary.choices && qSummary.choices.length > 0 ? 'Single Choice' : 'Fill-in-the-Blank / Free Response',
        difficulty: qSummary.difficulty || 6,
        section: qSummary.section || 'Reading and Writing',
        module: 'Module 1',
        question: (qSummary.passageText ? `${qSummary.passageText}\n\n` : '') + qSummary.questionPrompt,
        selections: qSummary.choices || [],
        answers: qSummary.correctAnswer,
        graphs: qSummary.graphData ? JSON.stringify(qSummary.graphData) : null,
        explanations: qSummary.explanation || 'Reviewed from Practice History.',
        exam_name: selectedReviewItem?.title || 'Practice Test',
        category: qSummary.subTopic || 'Practice',
      };

      const errorItem = transformRawToErrorItem(
        rawFallback,
        qSummary.userAnswer ? `Answered "${qSummary.userAnswer}" (Correct: ${qSummary.correctAnswer})` : 'Missed in Practice Test'
      );

      await saveError(errorItem);
      setAddedErrors((prev) => ({ ...prev, [qSummary.questionId]: true }));
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to add question to error book:', err);
    }
  };

  // Add all missed questions from selected test to error book
  const handleSaveAllMissedFromReview = async () => {
    if (!selectedReviewItem || !selectedReviewItem.questionSummaries) return;
    setSavingAllMissed(true);
    try {
      const missed = selectedReviewItem.questionSummaries.filter((q) => !q.isCorrect);
      for (const qSummary of missed) {
        const rawFallback: RawSATQuestion = {
          question_id: typeof qSummary.questionId === 'number' ? qSummary.questionId : Date.now() + Math.random(),
          question_no: qSummary.questionNo || 1,
          question_type: qSummary.choices && qSummary.choices.length > 0 ? 'Single Choice' : 'Fill-in-the-Blank / Free Response',
          difficulty: qSummary.difficulty || 6,
          section: qSummary.section || 'Reading and Writing',
          module: 'Module 1',
          question: (qSummary.passageText ? `${qSummary.passageText}\n\n` : '') + qSummary.questionPrompt,
          selections: qSummary.choices || [],
          answers: qSummary.correctAnswer,
          graphs: qSummary.graphData ? JSON.stringify(qSummary.graphData) : null,
          explanations: qSummary.explanation || 'Reviewed from Practice History.',
          exam_name: selectedReviewItem.title || 'Practice Test',
          category: qSummary.subTopic || 'Practice',
        };

        const errorItem = transformRawToErrorItem(
          rawFallback,
          qSummary.userAnswer ? `Answered "${qSummary.userAnswer}" (Correct: ${qSummary.correctAnswer})` : 'Missed in Practice Test'
        );
        await saveError(errorItem);
      }

      setSavedAllSuccess(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to save all missed to error book:', err);
    } finally {
      setSavingAllMissed(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Metrics Overview */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <History className="w-3.5 h-3.5" />
              <span>Practice History & Saved Tests</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Your Complete SAT Practice Journey
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Track your full exam scores, review question-by-question mistakes, resume saved practice tests in progress, and automatically synchronize missed questions to your SAT Error Book.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono">{metrics.totalTests}</p>
              <p className="text-xs text-slate-300 font-medium">Tests Completed</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {metrics.totalTests > 0 ? `${metrics.avgAccuracy}%` : '—'}
              </p>
              <p className="text-xs text-slate-300 font-medium">Avg Accuracy</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">{metrics.totalQuestions}</p>
              <p className="text-xs text-slate-300 font-medium">Questions Solved</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {formatDuration(metrics.totalTimeSeconds)}
              </p>
              <p className="text-xs text-slate-300 font-medium">Practice Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: IN-PROGRESS / PAUSED TESTS (SAVE & EXIT)                       */}
      {/* ========================================================================= */}
      {filteredSavedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Saved Tests in Progress ({filteredSavedSessions.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Saved via <strong>Save & Exit</strong> — click to resume where you left off
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSavedSessions.map((session) => {
              const answeredCount = Object.values(session.answers || {}).filter(Boolean).length;
              const totalCount = session.questions?.length || 0;
              const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
              const markedCount = Object.values(session.markedForReview || {}).filter(Boolean).length;

              return (
                <div
                  key={session.id}
                  className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700/80 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    {/* Badge & Last Saved */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Paused Exam
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatDate(session.lastSavedAt)}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {session.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {session.sectionName || 'SAT Practice Session'}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>{answeredCount} of {totalCount} Answered</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta badges */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      {markedCount > 0 && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Bookmark className="w-3 h-3 fill-blue-500" />
                          <span>{markedCount} Bookmarks</span>
                        </span>
                      )}
                      {session.timeSpentSeconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDuration(session.timeSpentSeconds)} elapsed</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onResumeSavedTest(session)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Resume Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSession(session.id)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Discard Saved Test"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: COMPLETED PRACTICE HISTORY LIST                                */}
      {/* ========================================================================= */}
      <div className="space-y-5">
        {/* Controls: Search, Filters, Sorters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by name, section, or domain..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              {(['All', 'Official', 'Custom', 'Math', 'RW'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === type
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {type === 'RW' ? 'Reading & Writing' : type}
                </button>
              ))}
            </div>

            {/* Clear History */}
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                title="Clear all completed test history"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
              <History className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {searchQuery || filterType !== 'All' ? 'No practice tests match your filter' : 'No completed practice tests yet'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Take an Official SAT Full Exam or create custom drills in the Practice Builder. Your scores, analytics, and error logs will appear here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              {onOpenExams && (
                <button
                  type="button"
                  onClick={onOpenExams}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  Take Official Exam
                </button>
              )}
              {onOpenBuilder && (
                <button
                  type="button"
                  onClick={onOpenBuilder}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  Custom Practice Builder
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => {
              const accuracy = item.percentage ?? (item.score && item.questionCount ? Math.round((item.score / item.questionCount) * 100) : 0);
              const isHighAccuracy = accuracy >= 80;
              const isMediumAccuracy = accuracy >= 60 && accuracy < 80;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Section / Category Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                            item.section === 'Math'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                              : item.section === 'Reading and Writing'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                          }`}
                        >
                          {item.section || 'SAT Exam'}
                        </span>

                        {item.domain && item.domain !== 'All' && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.domain}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 ml-auto sm:ml-0">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(item.completedAt)}</span>
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h3>
                    </div>

                    {/* Score / Accuracy Badge */}
                    <div className="flex items-center gap-3 shrink-0">
                      {item.scaledTotalScore ? (
                        <div className="text-right">
                          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono leading-none">
                            {item.scaledTotalScore}
                            <span className="text-xs text-slate-400 font-sans ml-1">/ 1600</span>
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {item.score} / {item.questionCount} Correct ({accuracy}%)
                          </p>
                        </div>
                      ) : (
                        <div className="text-right">
                          <p
                            className={`text-2xl font-black font-mono leading-none ${
                              isHighAccuracy
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isMediumAccuracy
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {accuracy}%
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {item.score} / {item.questionCount} Correct
                          </p>
                        </div>
                      )}

                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          isHighAccuracy
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                            : isMediumAccuracy
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200'
                        }`}
                      >
                        {item.score} / {item.questionCount}
                      </div>
                    </div>
                  </div>

                  {/* Summary Bar & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-4 text-slate-500 font-mono">
                      <span>⏱️ Time: <strong>{formatDuration(item.timeSpentSeconds)}</strong></span>
                      <span>📝 Questions: <strong>{item.questionCount}</strong></span>
                      {item.scaledRwScore && item.scaledMathScore && (
                        <span className="hidden sm:inline">
                          (RW: <strong>{item.scaledRwScore}</strong> • Math: <strong>{item.scaledMathScore}</strong>)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Review Breakdown Button */}
                      {item.questionSummaries && item.questionSummaries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewItem(item);
                            setExpandedQuestionIdx(null);
                            setSavedAllSuccess(false);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>Review Questions</span>
                        </button>
                      )}

                      {/* Re-take Button */}
                      {onRetakeTest && (
                        <button
                          type="button"
                          onClick={() => onRetakeTest(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold transition-colors cursor-pointer"
                          title="Retake this test"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-take</span>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(item.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: DETAILED QUESTION-BY-QUESTION TEST REVIEW                          */}
      {/* ========================================================================= */}
      {selectedReviewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    Test Review
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {formatDate(selectedReviewItem.completedAt)}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {selectedReviewItem.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReviewItem(null)}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Banner & Action Bar */}
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 font-mono">
                <span>Score: <strong className="text-blue-600 dark:text-blue-400">{selectedReviewItem.score} / {selectedReviewItem.questionCount}</strong></span>
                <span>Accuracy: <strong>{selectedReviewItem.percentage}%</strong></span>
                <span>Time Spent: <strong>{formatDuration(selectedReviewItem.timeSpentSeconds)}</strong></span>
              </div>

              <button
                type="button"
                onClick={handleSaveAllMissedFromReview}
                disabled={savingAllMissed || savedAllSuccess}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs disabled:opacity-70 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{savedAllSuccess ? 'Missed Questions Saved!' : savingAllMissed ? 'Saving...' : 'Save Missed to Error Book'}</span>
              </button>
            </div>

            {/* Questions List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedReviewItem.questionSummaries?.map((q, qIdx) => {
                const isExpanded = expandedQuestionIdx === qIdx;
                const isAdded = addedErrors[q.questionId];

                return (
                  <div
                    key={q.questionId || qIdx}
                    className={`rounded-2xl border transition-all ${
                      q.isCorrect
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => setExpandedQuestionIdx(isExpanded ? null : qIdx)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-500/5 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            q.isCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {q.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            Question #{q.questionNo || qIdx + 1}
                            {q.subTopic && <span className="ml-2 font-normal text-slate-500 font-sans">• {q.subTopic}</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Your Answer: <strong className={q.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{q.userAnswer || '(Omitted)'}</strong>
                            {' • '}Correct Answer: <strong className="text-emerald-700 dark:text-emerald-400">{q.correctAnswer}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!q.isCorrect && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddQuestionToErrorBook(q);
                            }}
                            disabled={isAdded}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-60 transition-colors"
                          >
                            {isAdded ? '✓ In Error Book' : '+ Add to Error Book'}
                          </button>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 space-y-3 text-xs leading-relaxed">
                        {q.passageText && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-serif text-slate-800 dark:text-slate-200">
                            <MathRenderer text={q.passageText} />
                          </div>
                        )}

                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          <MathRenderer text={q.questionPrompt} />
                        </div>

                        {/* Choices */}
                        {q.choices && q.choices.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.choices.map((c, cIdx) => {
                              const label = String.fromCharCode(65 + cIdx);
                              const isSelected = q.userAnswer === label;
                              const isCorrectChoice = q.correctAnswer === label;

                              return (
                                <div
                                  key={label}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                    isCorrectChoice
                                      ? 'bg-emerald-100/60 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : isSelected
                                      ? 'bg-rose-100/60 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-200 font-bold'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px]">
                                    {label}
                                  </span>
                                  <span className="flex-1">
                                    <MathRenderer text={c} />
                                  </span>
                                  {isCorrectChoice && <span className="text-[10px] text-emerald-600 font-extrabold uppercase">(Correct)</span>}
                                  {isSelected && !isCorrectChoice && <span className="text-[10px] text-rose-600 font-extrabold uppercase">(Your Answer)</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            <p className="font-bold text-slate-900 dark:text-white mb-1">Official Explanation:</p>
                            <MarkdownRenderer content={q.explanation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReviewItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
