'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';
import { RawSATQuestion } from '@/types/sat';
import MathRenderer from './MathRenderer';
import { formatMathText } from '@/lib/mathFormatter';

interface QuestionJsonEditModalProps {
  isOpen: boolean;
  question: RawSATQuestion | null;
  onClose: () => void;
  onSaved: (updatedQuestion: RawSATQuestion) => void;
}

export default function QuestionJsonEditModal({
  isOpen,
  question,
  onClose,
  onSaved,
}: QuestionJsonEditModalProps) {
  if (!isOpen || !question) return null;

  return (
    <QuestionJsonEditModalContent
      key={question.question_id}
      initialQuestion={question}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface ContentProps {
  initialQuestion: RawSATQuestion;
  onClose: () => void;
  onSaved: (updatedQuestion: RawSATQuestion) => void;
}

function QuestionJsonEditModalContent({
  initialQuestion,
  onClose,
  onSaved,
}: ContentProps) {
  const [formData, setFormData] = useState<RawSATQuestion>(() =>
    JSON.parse(JSON.stringify(initialQuestion))
  );
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split'>('split');
  const [focusedField, setFocusedField] = useState<'question' | 'explanation' | number | null>('question');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const explanationInputRef = useRef<HTMLTextAreaElement>(null);
  const selectionInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const insertSnippet = (snippet: string) => {
    if (focusedField === 'question' && questionInputRef.current) {
      const el = questionInputRef.current;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const text = formData.question || '';
      const newText = text.substring(0, start) + snippet + text.substring(end);
      setFormData({ ...formData, question: newText });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 50);
    } else if (focusedField === 'explanation' && explanationInputRef.current) {
      const el = explanationInputRef.current;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const text = formData.explanations || '';
      const newText = text.substring(0, start) + snippet + text.substring(end);
      setFormData({ ...formData, explanations: newText });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 50);
    } else if (typeof focusedField === 'number' && selectionInputRefs.current[focusedField]) {
      const el = selectionInputRefs.current[focusedField];
      if (el) {
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const selections = [...(formData.selections || [])];
        const text = selections[focusedField] || '';
        selections[focusedField] = text.substring(0, start) + snippet + text.substring(end);
        setFormData({ ...formData, selections });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + snippet.length, start + snippet.length);
        }, 50);
      }
    } else {
      // Default to appending to question
      setFormData({ ...formData, question: (formData.question || '') + ' ' + snippet });
    }
  };

  const autoFormatCurrentMath = () => {
    const formattedQuestion = formatMathText(formData.question);
    const formattedExplanation = formatMathText(formData.explanations || '');
    const formattedSelections = Array.isArray(formData.selections)
      ? formData.selections.map((c) => (c ? formatMathText(c) : c))
      : null;

    setFormData({
      ...formData,
      question: formattedQuestion,
      explanations: formattedExplanation,
      selections: formattedSelections,
    });

    setSaveStatus({
      type: 'success',
      message: 'Applied automatic KaTeX math formatting rules to fields.',
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_question',
          question: formData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus({
          type: 'success',
          message: `Saved changes for Question #${formData.question_id} to all_questions.json!`,
        });
        onSaved(formData);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setSaveStatus({
          type: 'error',
          message: data.error || 'Failed to save question to JSON file.',
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Network error while saving.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(JSON.parse(JSON.stringify(initialQuestion)));
    setSaveStatus({ type: 'success', message: 'Reset to original values.' });
  };

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(formData, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const mathSnippets = [
    { label: 'Fraction', latex: '$\\frac{a}{b}$', title: 'Fraction: \\frac{a}{b}' },
    { label: 'Exponent', latex: '$x^2$', title: 'Exponent: x^2' },
    { label: 'Power (n)', latex: '$x^{n}$', title: 'Power: x^{n}' },
    { label: 'Square Root', latex: '$\\sqrt{x}$', title: 'Square Root: \\sqrt{x}' },
    { label: 'Subscript', latex: '$x_1$', title: 'Subscript: x_1' },
    { label: 'Coordinates', latex: '$(x, y)$', title: 'Coordinates: (x, y)' },
    { label: '≤ Less/Eq', latex: '$\\le$', title: 'Less than or equal: \\le' },
    { label: '≥ Greater/Eq', latex: '$\\ge$', title: 'Greater than or equal: \\ge' },
    { label: '≠ Not Equal', latex: '$\\ne$', title: 'Not equal: \\ne' },
    { label: '± Plus-Minus', latex: '$\\pm$', title: 'Plus-minus: \\pm' },
    { label: 'Triangle △', latex: '$\\triangle ABC$', title: 'Triangle: \\triangle ABC' },
    { label: 'Angle ∠', latex: '$\\angle ABC$', title: 'Angle: \\angle ABC' },
    { label: 'Segment AB', latex: '$\\overline{AB}$', title: 'Line segment: \\overline{AB}' },
    { label: 'Degree °', latex: '$35^\\circ$', title: 'Degree: 35^\\circ' },
    { label: 'Pi π', latex: '$\\pi$', title: 'Pi: \\pi' },
    { label: 'Theta θ', latex: '$\\theta$', title: 'Theta: \\theta' },
    { label: 'Times ×', latex: '$\\times$', title: 'Times: \\times' },
  ];

  return (
    <div
      id="question-json-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="question-json-edit-dialog"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Manual JSON & Math Editor
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ID: #{formData.question_id}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    formData.section === 'Math'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {formData.section}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xl">
                {formData.exam_name || 'Practice Question'} • Module {formData.module || 1} • Difficulty {formData.difficulty || 5}/10
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-medium text-slate-600 dark:text-slate-400">
              <button
                id="tab-btn-editor"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Editor
              </button>
              <button
                id="tab-btn-split"
                onClick={() => setActiveTab('split')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'split'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Split View
              </button>
              <button
                id="tab-btn-preview"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Live KaTeX Preview
              </button>
            </div>

            <button
              id="btn-copy-raw-json"
              onClick={handleCopyRaw}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Question JSON"
            >
              {copiedRaw ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              id="btn-close-json-editor"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Math Toolbelt */}
        <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Quick Math:
            </span>
            {mathSnippets.map((s, idx) => (
              <button
                key={idx}
                type="button"
                id={`math-snippet-btn-${idx}`}
                onClick={() => insertSnippet(s.latex)}
                title={s.title}
                className="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-md text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-xs active:scale-95 whitespace-nowrap cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-auto-format-math"
              onClick={autoFormatCurrentMath}
              className="px-3 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Auto-Format KaTeX
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {saveStatus && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              saveStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500" />
              )}
              <span>{saveStatus.message}</span>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className={`grid gap-6 ${
              activeTab === 'split'
                ? 'grid-cols-1 lg:grid-cols-2'
                : activeTab === 'editor'
                ? 'grid-cols-1'
                : 'grid-cols-1'
            }`}
          >
            {/* Left Side: Editor Form */}
            {(activeTab === 'editor' || activeTab === 'split') && (
              <div className="space-y-6">
                {/* Question Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="edit-question-prompt"
                      className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
                    >
                      <span>Question Prompt / Text</span>
                      <span className="text-xs font-normal text-slate-400">
                        (Use $...$ for LaTeX math expressions)
                      </span>
                    </label>
                  </div>
                  <textarea
                    id="edit-question-prompt"
                    ref={questionInputRef}
                    value={formData.question || ''}
                    onFocus={() => setFocusedField('question')}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    rows={5}
                    className="w-full font-mono text-sm px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100 shadow-inner"
                    placeholder="Enter question text here. Wrap math in $...$ e.g. $60x + 35y = 840$"
                  />
                </div>

                {/* Selections / Choices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Answer Choices / Options
                    </label>
                    <span className="text-xs text-slate-400">
                      Leave empty or null for Grid-In numeric questions
                    </span>
                  </div>

                  {Array.isArray(formData.selections) && formData.selections.length > 0 ? (
                    <div className="space-y-2.5">
                      {formData.selections.map((choice, idx) => {
                        const letter = ['A', 'B', 'C', 'D', 'E'][idx] || `${idx + 1}`;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                              {letter}
                            </span>
                            <input
                              id={`edit-choice-${idx}`}
                              ref={(el) => {
                                selectionInputRefs.current[idx] = el;
                              }}
                              type="text"
                              value={choice || ''}
                              onFocus={() => setFocusedField(idx)}
                              onChange={(e) => {
                                const newSelections = [...(formData.selections || [])];
                                newSelections[idx] = e.target.value;
                                setFormData({ ...formData, selections: newSelections });
                              }}
                              className="flex-1 font-mono text-sm px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                              placeholder={`Option ${letter} (e.g. $\\frac{1}{8}$ or $(0, 11)$)`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSelections = (formData.selections || []).filter((_, i) => i !== idx);
                                setFormData({ ...formData, selections: newSelections });
                              }}
                              className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              title="Delete option"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        id="btn-add-choice"
                        onClick={() => {
                          const letters = ['A', 'B', 'C', 'D'];
                          const nextIdx = (formData.selections || []).length;
                          const nextLetter = letters[nextIdx] || `Option ${nextIdx + 1}`;
                          setFormData({
                            ...formData,
                            selections: [...(formData.selections || []), `${nextLetter}. `],
                          });
                        }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 cursor-pointer"
                      >
                        + Add Choice Option
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center bg-slate-50/50 dark:bg-slate-900/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Currently configured as Student-Produced Response (Grid-In numeric answer).
                      </p>
                      <button
                        type="button"
                        id="btn-convert-to-mcq"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            selections: ['A. ', 'B. ', 'C. ', 'D. '],
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 cursor-pointer"
                      >
                        Convert to Multiple Choice (A, B, C, D)
                      </button>
                    </div>
                  )}
                </div>

                {/* Correct Answer & Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label
                      htmlFor="edit-correct-answer"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Correct Answer
                    </label>
                    <input
                      id="edit-correct-answer"
                      type="text"
                      value={formData.answers || ''}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          answers: e.target.value,
                        });
                      }}
                      className="w-full font-mono text-sm px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 font-bold"
                      placeholder="e.g. A, B, C, D, or 12"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-difficulty"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Difficulty (1 - 10)
                    </label>
                    <input
                      id="edit-difficulty"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.difficulty || 5}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          difficulty: parseInt(e.target.value, 10) || 5,
                        })
                      }
                      className="w-full text-sm px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-section"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Section
                    </label>
                    <select
                      id="edit-section"
                      value={formData.section || 'Math'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          section: e.target.value as 'Reading and Writing' | 'Math',
                        })
                      }
                      className="w-full text-sm px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Math">Math</option>
                      <option value="Reading and Writing">Reading and Writing</option>
                    </select>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label
                    htmlFor="edit-explanation"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2"
                  >
                    Step-by-Step Solution / Explanation
                  </label>
                  <textarea
                    id="edit-explanation"
                    ref={explanationInputRef}
                    value={formData.explanations || ''}
                    onFocus={() => setFocusedField('explanation')}
                    onChange={(e) => setFormData({ ...formData, explanations: e.target.value })}
                    rows={4}
                    className="w-full font-mono text-sm px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 shadow-inner"
                    placeholder="Enter step-by-step mathematical reasoning. Wrap formulas in $...$"
                  />
                </div>
              </div>
            )}

            {/* Right Side: Live KaTeX Preview */}
            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col h-full shadow-inner">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Live KaTeX Math Rendering Preview
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                    Real-time
                  </span>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                  {/* Rendered Question */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Rendered Question
                    </h4>
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs text-base leading-relaxed text-slate-900 dark:text-slate-100">
                      <MathRenderer text={formData.question || 'No question text.'} />
                    </div>
                  </div>

                  {/* Rendered Choices */}
                  {Array.isArray(formData.selections) && formData.selections.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Rendered Choices
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {formData.selections.map((c, i) => (
                          <div
                            key={i}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs text-sm flex items-center gap-2.5"
                          >
                            <MathRenderer text={c} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Correct Answer Badge */}
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                      Correct Answer:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {formData.answers}
                    </span>
                  </div>

                  {/* Rendered Explanation */}
                  {formData.explanations && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Rendered Explanation
                      </h4>
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        <MathRenderer text={formData.explanations} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            id="btn-reset-json-changes"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Original
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-cancel-json-edit"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-save-to-all-questions-json"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save to all_questions.json
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
