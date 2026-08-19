'use client';

import React from 'react';
import {
  Brain,
  Flame,
  LayoutDashboard,
  Layers,
  BookOpen,
  PlusCircle,
  Sparkles,
  RotateCcw,
  BookMarked,
} from 'lucide-react';
import { UserStats } from '@/types/sat';

interface NavbarProps {
  currentTab: 'dashboard' | 'review' | 'vocab' | 'directory' | 'bank';
  onTabChange: (tab: 'dashboard' | 'review' | 'vocab' | 'directory' | 'bank') => void;
  stats: UserStats;
  dueCount: number;
  vocabCount?: number;
  onOpenUploader: () => void;
}

export default function Navbar({
  currentTab,
  onTabChange,
  stats,
  dueCount,
  vocabCount,
  onOpenUploader,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs group-hover:scale-105 transition-transform bg-gradient-to-br from-indigo-900 via-blue-700 to-indigo-600 flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 shrink-0 text-white relative">
            <img
              src="/logo.svg"
              alt="SAT Error Book Logo"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true';
                  target.src = '/logo.png';
                } else {
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-icon')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-icon flex items-center justify-center w-full h-full font-black text-amber-300 text-xs font-mono tracking-tighter';
                    fallback.innerText = '1600';
                    parent.appendChild(fallback);
                  }
                }
              }}
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                SAT Error Book
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium hidden sm:block">
              Auto-log & Active Recall Engine
            </p>
          </div>
        </div>

        {/* View Navigation Tabs */}
        <nav className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentTab === 'dashboard'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('review')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
              currentTab === 'review'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flashcard Review</span>
            {dueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold ml-0.5">
                {dueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('vocab')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentTab === 'vocab'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Vocab Bank</span>
            {vocabCount !== undefined && vocabCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold ml-0.5">
                {vocabCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('directory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentTab === 'directory'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Error Directory</span>
          </button>

          <button
            onClick={() => onTabChange('bank')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentTab === 'bank'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Question Bank</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold ml-0.5 hidden lg:inline">
              9.6k Qs
            </span>
          </button>
        </nav>

        {/* Right Status Actions */}
        <div className="flex items-center gap-3">
          {/* Streak Badge */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-extrabold shadow-xs">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>{stats.streakDays || 1}d</span>
          </div>

          {/* Quick Paste/Log Button */}
          <button
            onClick={onOpenUploader}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden md:inline">Paste Screenshot</span>
          </button>
        </div>
      </div>
    </header>
  );
}
