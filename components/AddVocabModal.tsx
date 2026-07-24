'use client';

import React, { useState } from 'react';
import { X, Sparkles, BookMarked, Loader2, Save, Plus, Check } from 'lucide-react';
import { VocabItem, DefineVocabResponse } from '@/types/sat';
import { saveVocab } from '@/lib/db';

interface AddVocabModalProps {
  initialWord?: string;
  initialContext?: string;
  sourceQuestionId?: string;
  onClose: () => void;
  onSaved: (item: VocabItem) => void;
}

export default function AddVocabModal({
  initialWord = '',
  initialContext = '',
  sourceQuestionId,
  onClose,
  onSaved,
}: AddVocabModalProps) {
  const [word, setWord] = useState(initialWord);
  const [definition, setDefinition] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('adjective');
  const [exampleSentence, setExampleSentence] = useState('');
  const [synonymsInput, setSynonymsInput] = useState('');
  const [satTip, setSatTip] = useState('');
  const [sourceContext, setSourceContext] = useState(initialContext);

  const [isDefining, setIsDefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoDefined, setAutoDefined] = useState(false);

  const handleAutoDefine = async () => {
    if (!word.trim()) {
      setErrorMessage('Please enter a word first.');
      return;
    }

    setErrorMessage(null);
    setIsDefining(true);

    try {
      const res = await fetch('/api/define-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.trim(),
          contextSentence: sourceContext.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to auto-generate definition');
      }

      const data: DefineVocabResponse = await res.json();

      if (data.word) setWord(data.word);
      if (data.definition) setDefinition(data.definition);
      if (data.partOfSpeech) setPartOfSpeech(data.partOfSpeech.toLowerCase());
      if (data.exampleSentence) setExampleSentence(data.exampleSentence);
      if (data.synonyms && Array.isArray(data.synonyms)) {
        setSynonymsInput(data.synonyms.join(', '));
      }
      if (data.satTip) setSatTip(data.satTip);

      setAutoDefined(true);
    } catch (err: any) {
      console.error('Error auto-defining vocab:', err);
      setErrorMessage(err.message || 'Failed to auto-define. You can type the definition manually below.');
    } finally {
      setIsDefining(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) {
      setErrorMessage('Word is required.');
      return;
    }
    if (!definition.trim()) {
      setErrorMessage('Definition is required. Click "Auto-Define with AI" or enter one manually.');
      return;
    }

    setIsSaving(true);
    try {
      const synonymsArray = synonymsInput
        ? synonymsInput.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const newItem: VocabItem = {
        id: `vocab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        word: word.trim(),
        definition: definition.trim(),
        partOfSpeech: partOfSpeech.trim() || undefined,
        exampleSentence: exampleSentence.trim() || undefined,
        synonyms: synonymsArray.length > 0 ? synonymsArray : undefined,
        satTip: satTip.trim() || undefined,
        sourceQuestionId,
        sourceContext: sourceContext.trim() || undefined,
        createdAt: new Date().toISOString(),
        masteryStatus: 'Learning',
      };

      await saveVocab(newItem);
      onSaved(newItem);
    } catch (err: any) {
      console.error('Error saving vocab item:', err);
      setErrorMessage('Failed to save to database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Log SAT Vocabulary Word
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-generate SAT definition or enter details manually
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Word Input & Auto-Define Action */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Vocabulary Word / Phrase <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  setAutoDefined(false);
                }}
                placeholder="e.g., Fastidious, Equivocal, Substantiate"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="button"
                onClick={handleAutoDefine}
                disabled={isDefining || !word.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs shrink-0"
              >
                {isDefining ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Defining...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Auto-Define</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Source Context (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Passage / Context Excerpt (Optional)
            </label>
            <textarea
              value={sourceContext}
              onChange={(e) => setSourceContext(e.target.value)}
              placeholder="Paste sentence from the question passage where this word appeared..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {autoDefined && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>SAT definition generated! You can review or customize the fields below.</span>
            </div>
          )}

          {/* Part of speech & Definition */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Part of Speech
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="adjective">Adjective</option>
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adverb">Adverb</option>
                <option value="phrase">Phrase</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Synonyms (Comma separated)
              </label>
              <input
                type="text"
                value={synonymsInput}
                onChange={(e) => setSynonymsInput(e.target.value)}
                placeholder="e.g. Precise, Meticulous, Exact"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Definition <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Clear, concise definition..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Example Sentence
            </label>
            <input
              type="text"
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              placeholder="e.g. Her fastidious editing caught every minor typo."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              SAT Test Tip (Optional)
            </label>
            <input
              type="text"
              value={satTip}
              onChange={(e) => setSatTip(e.target.value)}
              placeholder="e.g. Do not confuse with similar sounding word..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !word.trim() || !definition.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Vocab Word</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
