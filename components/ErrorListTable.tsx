'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  Download,
  Upload,
  BookOpen,
  CheckCircle2,
  Clock,
  Tag,
  ImageIcon,
  Brain,
} from 'lucide-react';
import { SATErrorItem, SATSubject, MasteryStatus } from '@/types/sat';
import { deleteError, exportFullDatabase, importFullDatabase } from '@/lib/db';
import MathRenderer from './MathRenderer';

interface ErrorListTableProps {
  errors: SATErrorItem[];
  onSelectError: (item: SATErrorItem, editMode?: boolean) => void;
  onRefreshData: () => void;
  onStartErrorTest?: () => void;
}

export default function ErrorListTable({
  errors,
  onSelectError,
  onRefreshData,
  onStartErrorTest,
}: ErrorListTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [masteryFilter, setMasteryFilter] = useState<string>('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filter items
  const filteredErrors = errors.filter((item) => {
    // Subject
    if (subjectFilter !== 'All' && item.subject !== subjectFilter) return false;

    // Mastery
    if (masteryFilter !== 'All' && item.masteryStatus !== masteryFilter) return false;

    // Search query
    if (searchTerm.trim().length > 0) {
      const q = searchTerm.toLowerCase();
      const matchText = (item.questionText || '').toLowerCase();
      const matchTopic = (item.subTopic || '').toLowerCase();
      const matchTakeaway = (item.aiTakeaway || '').toLowerCase();
      const matchNotes = (item.userNotes || '').toLowerCase();
      const matchSource = (item.testSource || '').toLowerCase();

      return (
        matchText.includes(q) ||
        matchTopic.includes(q) ||
        matchTakeaway.includes(q) ||
        matchNotes.includes(q) ||
        matchSource.includes(q)
      );
    }

    return true;
  });

  const handleDeleteConfirm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await deleteError(id);
      setDeletingId(null);
      onRefreshData();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleExportJson = async () => {
    try {
      const fullBackup = await exportFullDatabase();
      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAT_Error_Book_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const result = await importFullDatabase(parsed);
      const totalImported = result.errorsImported + result.vocabImported;
      if (totalImported === 0) {
        setImportStatus('No valid SAT error entries or vocabulary words were found in the file.');
      } else {
        setImportStatus(
          `Successfully imported ${result.errorsImported} error(s) and ${result.vocabImported} vocabulary word(s)!`
        );
        onRefreshData();
      }

      setTimeout(() => {
        setImportStatus(null);
      }, 6000);
    } catch (err) {
      console.error('Import error:', err);
      setImportStatus('Failed to parse backup file. Make sure it is a valid JSON backup file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJson}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Search & Filter Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {importStatus && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center justify-between">
            <span>{importStatus}</span>
            <button
              onClick={() => setImportStatus(null)}
              className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search question text, sub-topics, formulas, or notes..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Import Backup button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>Import Backup</span>
            </button>

            {/* Export JSON backup button */}
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Export Backup</span>
            </button>

            {onStartErrorTest && (
              <button
                type="button"
                onClick={onStartErrorTest}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition-transform active:scale-95"
              >
                <Brain className="w-4 h-4 text-slate-950" />
                <span>Practice Test Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Subject Pills */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-300 mr-1">Subject:</span>
            {['All', 'Math', 'Reading & Writing'].map((sub) => (
              <button
                key={sub}
                onClick={() => setSubjectFilter(sub)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  subjectFilter === sub
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Mastery Pills */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-300 mr-1">Mastery:</span>
            {[
              { label: 'All', value: 'All' },
              { label: '🔴 Confused', value: 'Confused' },
              { label: '🟡 Learning', value: 'Learning' },
              { label: '🟢 Mastered', value: 'Mastered' },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setMasteryFilter(m.value)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  masteryFilter === m.value
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between px-2 text-xs text-slate-600 dark:text-slate-300">
        <span>
          Showing <strong>{filteredErrors.length}</strong> of {errors.length} logged SAT errors
        </span>
      </div>

      {/* Error Cards Grid */}
      {filteredErrors.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No matching errors found
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Try adjusting your search terms or filters above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredErrors.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectError(item)}
              className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Pills */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        item.subject === 'Math'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                      }`}
                    >
                      {item.subject}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.subTopic}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      item.masteryStatus === 'Mastered'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.masteryStatus === 'Learning'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {item.masteryStatus}
                  </span>
                </div>

                {/* Question Preview */}
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                  <MathRenderer text={item.questionText} />
                </div>

                {/* AI Takeaway snippet */}
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="line-clamp-2 italic font-medium">
                    <MathRenderer text={item.aiTakeaway} />
                  </div>
                </div>
              </div>

              {/* Card Footer Info & Delete button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                  {item.imageDataUrl && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <ImageIcon className="w-3 h-3" />
                      Image
                    </span>
                  )}
                  {item.mistakeType && (
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-medium">
                      {item.mistakeType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onSelectError(item, true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    title="Edit Question & Choices"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {deletingId === item.id ? (
                    <div
                      className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-900 animate-in fade-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Delete?</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConfirm(e, item.id)}
                        className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDeletingId(null);
                        }}
                        className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeletingId(item.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Error Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
