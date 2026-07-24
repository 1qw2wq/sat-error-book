'use client';

import React, { useState } from 'react';
import {
  BookMarked,
  Search,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Layers,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { VocabItem, MasteryStatus } from '@/types/sat';
import { saveVocab, deleteVocab } from '@/lib/db';
import AddVocabModal from './AddVocabModal';

interface VocabBankProps {
  vocabList: VocabItem[];
  onRefreshVocab: () => void;
}

export default function VocabBank({ vocabList, onRefreshVocab }: VocabBankProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VocabItem | null>(null);

  // Flashcard study mode state
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Filter items
  const filteredVocab = vocabList.filter((item) => {
    const matchesSearch =
      item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.synonyms && item.synonyms.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesStatus =
      statusFilter === 'All' || item.masteryStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (item: VocabItem, nextStatus: MasteryStatus) => {
    const updated: VocabItem = { ...item, masteryStatus: nextStatus };
    await saveVocab(updated);
    onRefreshVocab();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this vocabulary word?')) {
      await deleteVocab(id);
      onRefreshVocab();
    }
  };

  const currentStudyItem = filteredVocab[studyIndex];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-extrabold tracking-tight">SAT Vocabulary Log</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              {vocabList.length} Words Saved
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Track high-frequency SAT vocabulary, auto-extract definitions from wrong answers, and master word nuances for Craft & Structure reading questions.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={() => {
              setIsStudyMode(!isStudyMode);
              setStudyIndex(0);
              setIsFlipped(false);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              isStudyMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isStudyMode ? 'Exit Study Mode' : 'Practice Flashcards'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vocab Word</span>
          </button>
        </div>
      </div>

      {/* FLASHCARD PRACTICE MODE */}
      {isStudyMode ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center min-h-[380px] space-y-6">
          {filteredVocab.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <BookMarked className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                No vocabulary words match your current filter.
              </p>
              <button
                onClick={() => setStatusFilter('All')}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="w-full max-w-xl flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>
                  Card {studyIndex + 1} of {filteredVocab.length}
                </span>
                <span className="uppercase tracking-wider text-[10px]">
                  Status: {currentStudyItem.masteryStatus || 'Learning'}
                </span>
              </div>

              {/* Interactive Flashcard */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-xl min-h-[220px] p-8 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-2 border-indigo-500/30 hover:border-indigo-500/60 shadow-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center relative group"
              >
                <div className="absolute top-3 right-3 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg">
                  {isFlipped ? 'Definition Side' : 'Click to Flip'}
                </div>

                {!isFlipped ? (
                  <div className="space-y-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                      {currentStudyItem.partOfSpeech || 'vocab'}
                    </span>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {currentStudyItem.word}
                    </h3>
                    {currentStudyItem.sourceContext && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-md line-clamp-2 mt-2">
                        &quot;{currentStudyItem.sourceContext}&quot;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in max-w-lg">
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                      {currentStudyItem.definition}
                    </p>
                    {currentStudyItem.exampleSentence && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        &quot;{currentStudyItem.exampleSentence}&quot;
                      </p>
                    )}
                    {currentStudyItem.synonyms && currentStudyItem.synonyms.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                        {currentStudyItem.synonyms.map((syn, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mastery Action Rating */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleUpdateStatus(currentStudyItem, 'Confused');
                    if (studyIndex < filteredVocab.length - 1) {
                      setStudyIndex(studyIndex + 1);
                      setIsFlipped(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-200 transition-colors"
                >
                  Confused
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(currentStudyItem, 'Learning');
                    if (studyIndex < filteredVocab.length - 1) {
                      setStudyIndex(studyIndex + 1);
                      setIsFlipped(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 transition-colors"
                >
                  Learning
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(currentStudyItem, 'Mastered');
                    if (studyIndex < filteredVocab.length - 1) {
                      setStudyIndex(studyIndex + 1);
                      setIsFlipped(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200 transition-colors"
                >
                  Mastered
                </button>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  disabled={studyIndex === 0}
                  onClick={() => {
                    setStudyIndex(studyIndex - 1);
                    setIsFlipped(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={studyIndex >= filteredVocab.length - 1}
                  onClick={() => {
                    setStudyIndex(studyIndex + 1);
                    setIsFlipped(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Next Card
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        /* STANDARD VOCAB BANK GRID VIEW */
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vocabulary words, definitions, or synonyms..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold shrink-0">
              {['All', 'Confused', 'Learning', 'Mastered'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {filteredVocab.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <BookMarked className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No vocabulary words found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Start adding vocabulary words manually or click &quot;Add Vocab&quot; on any question to log words from your test screenshots!
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                + Add First Word
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVocab.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2">
                    {/* Top Row: Word, Part of Speech, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {item.word}
                        </h3>
                        {item.partOfSpeech && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                            {item.partOfSpeech}
                          </span>
                        )}
                      </div>

                      {/* Status Selector */}
                      <select
                        value={item.masteryStatus || 'Learning'}
                        onChange={(e) => handleUpdateStatus(item, e.target.value as MasteryStatus)}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors ${
                          item.masteryStatus === 'Mastered'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : item.masteryStatus === 'Confused'
                            ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        <option value="Confused">Confused</option>
                        <option value="Learning">Learning</option>
                        <option value="Mastered">Mastered</option>
                      </select>
                    </div>

                    {/* Definition */}
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {item.definition}
                    </p>

                    {/* Example Sentence */}
                    {item.exampleSentence && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        &quot;{item.exampleSentence}&quot;
                      </p>
                    )}

                    {/* Synonyms Pills */}
                    {item.synonyms && item.synonyms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mr-1">
                          Synonyms:
                        </span>
                        {item.synonyms.map((syn, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* SAT Tip Box */}
                    {item.satTip && (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{item.satTip}</span>
                      </div>
                    )}

                    {/* Source Context */}
                    {item.sourceContext && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        <span className="font-bold">From question:</span> &quot;{item.sourceContext}&quot;
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit word"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Delete word"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add New Vocab Modal */}
      {isAddModalOpen && (
        <AddVocabModal
          onClose={() => setIsAddModalOpen(false)}
          onSaved={() => {
            setIsAddModalOpen(false);
            onRefreshVocab();
          }}
        />
      )}

      {/* Edit Vocab Modal */}
      {editingItem && (
        <AddVocabModal
          initialWord={editingItem.word}
          initialContext={editingItem.sourceContext}
          sourceQuestionId={editingItem.sourceQuestionId}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            onRefreshVocab();
          }}
        />
      )}
    </div>
  );
}
