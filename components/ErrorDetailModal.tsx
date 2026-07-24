'use client';

import React, { useState } from 'react';
import { X, Sparkles, Check, Trash2, Edit3, Save, Calendar, ImageIcon, Award, Clock, BookMarked } from 'lucide-react';
import { SATErrorItem, MasteryStatus, MistakeType } from '@/types/sat';
import { saveError, deleteError } from '@/lib/db';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import AddVocabModal from './AddVocabModal';

interface ErrorDetailModalProps {
  item: SATErrorItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ErrorDetailModal({
  item,
  onClose,
  onUpdated,
}: ErrorDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isAddVocabOpen, setIsAddVocabOpen] = useState(false);
  const [userNotes, setUserNotes] = useState(item?.userNotes || '');
  const [mistakeType, setMistakeType] = useState<MistakeType>(item?.mistakeType || 'Careless Error');
  const [masteryStatus, setMasteryStatus] = useState<MasteryStatus>(item?.masteryStatus || 'Confused');
  const [testSource, setTestSource] = useState(item?.testSource || '');

  if (!item) return null;

  const imagesList = item.imageDataUrls && item.imageDataUrls.length > 0
    ? item.imageDataUrls
    : (item.imageDataUrl ? [item.imageDataUrl] : []);

  const handleSaveEdits = async () => {
    const updated: SATErrorItem = {
      ...item,
      userNotes: userNotes.trim(),
      mistakeType,
      masteryStatus,
      testSource: testSource.trim(),
    };
    await saveError(updated);
    setIsEditing(false);
    onUpdated();
  };

  const handleDeleteConfirm = async () => {
    await deleteError(item.id);
    onClose();
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                item.subject === 'Math'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
              }`}
            >
              {item.subject}
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {item.subTopic}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddVocabOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200/50 dark:border-indigo-800/50 text-xs font-bold transition-colors"
              title="Add a vocabulary word from this question"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>+ Vocab</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit Note or Status"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-900 animate-in fade-in">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Delete?</span>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Screenshot image(s) if available */}
          {imagesList.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-2 overflow-hidden max-h-64 flex justify-center items-center">
                <img
                  src={imagesList[selectedImageIndex] || imagesList[0]}
                  alt="Question screenshot"
                  className="max-h-60 w-auto object-contain rounded"
                />
              </div>

              {imagesList.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {imagesList.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`w-16 h-14 rounded-lg border overflow-hidden shrink-0 bg-slate-950 p-0.5 transition-all ${
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

          {/* Render Graph / Diagram / Data Table if present */}
          {item.graphData && item.graphData.hasGraph && (
            <GraphRenderer
              graphData={item.graphData}
              imageDataUrl={item.imageDataUrl}
              imageDataUrls={item.imageDataUrls}
            />
          )}

          {/* Question text */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
              Question Text
            </h4>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
              <MathRenderer text={item.questionText} />
            </div>

            {/* Answer Choices */}
            {item.answerChoices && item.answerChoices.length > 0 && (
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.answerChoices.map((choice) => {
                  const isCorrect = choice.label === item.correctAnswer;
                  return (
                    <div
                      key={choice.label}
                      className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px]">
                        {choice.label}
                      </span>
                      <span><MathRenderer text={choice.text} /></span>
                      {isCorrect && <span className="ml-auto text-[10px] uppercase font-extrabold text-emerald-600">(Correct)</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Takeaway */}
          <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              AI Active Recall Takeaway
            </h4>
            <div className="text-sm font-semibold text-amber-950 dark:text-amber-100 leading-relaxed">
              <MarkdownRenderer content={item.aiTakeaway} />
            </div>
          </div>

          {/* Step by step explanation */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
              Step-by-Step Explanation
            </h4>
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <MarkdownRenderer content={item.explanation} />
            </div>
          </div>

          {/* Edit Form or Read-Only Status Details */}
          {isEditing ? (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                Edit Error Log Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mastery Status
                  </label>
                  <select
                    value={masteryStatus}
                    onChange={(e) => setMasteryStatus(e.target.value as MasteryStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Confused">Confused 🔴</option>
                    <option value="Learning">Learning 🟡</option>
                    <option value="Mastered">Mastered 🟢</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mistake Category
                  </label>
                  <select
                    value={mistakeType}
                    onChange={(e) => setMistakeType(e.target.value as MistakeType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Careless Error">Careless Error</option>
                    <option value="Concept Gap">Concept Gap</option>
                    <option value="Misread Question">Misread Question</option>
                    <option value="Time Pressure">Time Pressure</option>
                    <option value="Calculation Error">Calculation Error</option>
                    <option value="Formula Amnesia">Formula Amnesia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Test Source
                  </label>
                  <input
                    type="text"
                    value={testSource}
                    onChange={(e) => setTestSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Personal Note
                </label>
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-600 dark:text-slate-300 block font-medium">
                  Personal Note: {item.userNotes ? `"${item.userNotes}"` : 'None added'}
                </span>
                <span className="text-slate-600 dark:text-slate-300 block">
                  Mistake Type: <strong className="text-slate-800 dark:text-slate-200">{item.mistakeType}</strong> • Source: <strong className="text-slate-800 dark:text-slate-200">{item.testSource || 'N/A'}</strong>
                </span>
              </div>

              <span
                className={`px-3 py-1 rounded-full font-bold ${
                  item.masteryStatus === 'Mastered'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : item.masteryStatus === 'Learning'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                Status: {item.masteryStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {isAddVocabOpen && (
        <AddVocabModal
          sourceQuestionId={item.id}
          initialContext={item.questionText}
          onClose={() => setIsAddVocabOpen(false)}
          onSaved={() => {
            setIsAddVocabOpen(false);
          }}
        />
      )}
    </div>
  );
}
