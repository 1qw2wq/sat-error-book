'use client';

import React from 'react';
import {
  Flame,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  TrendingUp,
  BarChart2,
  BookOpen,
  ArrowRight,
  Brain,
  RotateCcw,
  Clock,
  PieChart,
} from 'lucide-react';
import { SATErrorItem, UserStats } from '@/types/sat';
import ImageUploader from './ImageUploader';

interface DashboardProps {
  errors: SATErrorItem[];
  stats: UserStats;
  onStartReview: (subjectFilter?: string, masteryFilter?: string) => void;
  onStartErrorTest?: () => void;
  onNavigateToBank?: () => void;
  onImageReady: (dataUrl: string, mimeType: string) => void;
  onImagesReady?: (dataUrls: string[], mimeType?: string) => void;
}

export default function Dashboard({
  errors,
  stats,
  onStartReview,
  onStartErrorTest,
  onNavigateToBank,
  onImageReady,
  onImagesReady,
}: DashboardProps) {
  const totalLogged = errors.length;
  const masteredCount = errors.filter((e) => e.masteryStatus === 'Mastered').length;
  const learningCount = errors.filter((e) => e.masteryStatus === 'Learning').length;
  const confusedCount = errors.filter((e) => e.masteryStatus === 'Confused').length;

  const masteryPercentage = totalLogged > 0 ? Math.round((masteredCount / totalLogged) * 100) : 0;

  // Subtopic breakdown calculations
  const subtopicCounts: Record<string, { total: number; mastered: number; confused: number }> = {};
  const mistakeTypeCounts: Record<string, number> = {};

  errors.forEach((item) => {
    // Subtopics
    const topic = item.subTopic || 'General';
    if (!subtopicCounts[topic]) {
      subtopicCounts[topic] = { total: 0, mastered: 0, confused: 0 };
    }
    subtopicCounts[topic].total += 1;
    if (item.masteryStatus === 'Mastered') subtopicCounts[topic].mastered += 1;
    if (item.masteryStatus === 'Confused') subtopicCounts[topic].confused += 1;

    // Mistake types
    const mType = item.mistakeType || 'Careless Error';
    mistakeTypeCounts[mType] = (mistakeTypeCounts[mType] || 0) + 1;
  });

  // Sort subtopics by error volume
  const topSubtopics = Object.entries(subtopicCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  // Due today count
  const now = new Date().getTime();
  const dueCount = errors.filter(
    (e) =>
      e.masteryStatus === 'Confused' ||
      e.masteryStatus === 'Learning' ||
      new Date(e.nextReviewDate).getTime() <= now
  ).length;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Mastery Percentage */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Mastery Progress
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {masteryPercentage}%
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                ({masteredCount}/{totalLogged})
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-36 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${masteryPercentage}%` }}
              />
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Daily Streak */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Daily Review Streak
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.streakDays || 1}
              </span>
              <span className="text-sm font-bold text-amber-500">Days 🔥</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
              Keep the streak alive today!
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center border border-amber-100 dark:border-amber-900/50">
            <Flame className="w-6 h-6 fill-amber-500" />
          </div>
        </div>

        {/* Confused / Due Cards */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Due for Active Recall
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {dueCount}
              </span>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                ({confusedCount} Confused)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
              Ready to test in flashcard mode
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Quick Launch Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 text-white shadow-md flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Practice & Active Recall</span>
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {dueCount} Due
              </span>
            </div>
            <h3 className="text-base font-bold mt-1">Review or Test Knowledge</h3>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={() => onStartReview('All', 'ConfusedOrDue')}
              className="w-full py-2 px-3 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-2 group"
            >
              <span>Flashcard Review</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>

            {onStartErrorTest && (
              <button
                onClick={onStartErrorTest}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-2 group"
              >
                <span>Practice Test Mode</span>
                <Brain className="w-3.5 h-3.5 text-slate-950" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Row: Instant Auto-Log Uploader (Left) + Weak Spot Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Uploader Zone */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <span>Instant AI Auto-Log</span>
            </h2>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Paste (Ctrl+V) or Drop Screenshot
            </span>
          </div>

          <ImageUploader onImageReady={onImageReady} onImagesReady={onImagesReady} />
        </div>

        {/* Right: Weak Spot Analytics & Subtopics */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <span>Weak Spot Analytics</span>
            </h2>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">By Sub-Topic</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            {topSubtopics.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 text-center py-6">
                No error data yet. Upload a screenshot to view analytics!
              </p>
            ) : (
              topSubtopics.map(([topic, data]) => {
                const percentMastered = Math.round((data.mastered / data.total) * 100);
                return (
                  <div key={topic} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {topic}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {data.total} errors ({data.confused} 🔴 confused)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${percentMastered}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold w-8 text-right">
                        {percentMastered}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mistake Type Breakdown Chips */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Top Error Root Causes:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(mistakeTypeCounts).map(([mType, count]) => (
                  <span
                    key={mType}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {mType}: <strong className="text-blue-600 dark:text-blue-400 font-bold">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official SAT Question Bank Showcase Banner */}
      {onNavigateToBank && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg border border-blue-800/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>3,895 Authentic SAT Questions Added</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
              Official SAT Past Exam Question Bank
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Browse 100 complete official exam sets from 2026, 2025 and past tests. Practice timed Bluebook sections or customize difficulty drills.
            </p>
          </div>

          <button
            onClick={onNavigateToBank}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <span>Explore Question Bank</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Launch Session by Subject */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Targeted Active Recall Review Modes
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => onStartReview('Math', 'All')}
            className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-extrabold text-xs">
                Math Deck
              </span>
              <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-indigo-950 dark:text-indigo-200 font-medium">
              Review Algebra, Advanced Math, Geometry & Data
            </p>
          </button>

          <button
            onClick={() => onStartReview('Reading & Writing', 'All')}
            className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-950/70 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-1 rounded-md bg-teal-600 text-white font-extrabold text-xs">
                Reading & Writing Deck
              </span>
              <ArrowRight className="w-4 h-4 text-teal-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-teal-950 dark:text-teal-200 font-medium">
              Review Craft, Grammar, Conventions & Passages
            </p>
          </button>

          <button
            onClick={() => onStartReview('All', 'Confused')}
            className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-extrabold text-xs">
                🔴 Still Confused Deck
              </span>
              <ArrowRight className="w-4 h-4 text-rose-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-rose-950 dark:text-rose-200 font-medium">
              Focus specifically on unmastered error concepts
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
