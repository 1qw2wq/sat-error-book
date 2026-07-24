'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, AlertCircle, Loader2, Save, Tag, HelpCircle, Edit3, Image as ImageIcon } from 'lucide-react';
import { SATErrorItem, SATSubject, MistakeType, ParseErrorResponse, GraphData } from '@/types/sat';
import { saveError } from '@/lib/db';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';

interface QuickReviewModalProps {
  imageDataUrl?: string | null;
  imageDataUrls?: string[];
  mimeType?: string;
  onClose: () => void;
  onSaved: (item: SATErrorItem) => void;
}

export default function QuickReviewModal({
  imageDataUrl,
  imageDataUrls,
  mimeType = 'image/png',
  onClose,
  onSaved,
}: QuickReviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Sending screenshot(s) to Gemini 3.1 Flash Lite...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Normalize list of image Data URLs
  const activeImages: string[] = React.useMemo(() => {
    if (imageDataUrls && imageDataUrls.length > 0) return imageDataUrls;
    if (imageDataUrl) return [imageDataUrl];
    return [];
  }, [imageDataUrl, imageDataUrls]);

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Form states
  const [subject, setSubject] = useState<SATSubject>('Math');
  const [subTopic, setSubTopic] = useState('Algebra');
  const [questionText, setQuestionText] = useState('');
  const [choicesText, setChoicesText] = useState(''); // Raw formatted or choices
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [aiTakeaway, setAiTakeaway] = useState('');
  const [explanation, setExplanation] = useState('');
  const [graphData, setGraphData] = useState<GraphData | undefined>(undefined);
  const [mistakeType, setMistakeType] = useState<MistakeType>('Careless Error');
  const [userNotes, setUserNotes] = useState('');
  const [testSource, setTestSource] = useState('Practice Test');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  useEffect(() => {
    if (activeImages.length === 0) return;

    let isMounted = true;
    const processScreenshot = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        setLoadingStep(`Analyzing ${activeImages.length} screenshot(s) with Gemini 3.1 Flash Lite...`);
        await new Promise((r) => setTimeout(r, 300));

        if (!isMounted) return;
        setLoadingStep('Performing OCR, extracting formulas, text, graphs, & choices...');

        const res = await fetch('/api/parse-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: activeImages,
            mimeType,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Gemini 3.1 Flash Lite could not parse screenshot(s)');
        }

        const data: ParseErrorResponse = json.data;

        if (isMounted) {
          setSubject(data.subject || 'Math');
          setSubTopic(data.subTopic || 'Algebra');
          setQuestionText(data.questionText || '');

          if (data.answerChoices && data.answerChoices.length > 0) {
            const formattedChoices = data.answerChoices
              .map((c) => `${c.label}) ${c.text}`)
              .join('\n');
            setChoicesText(formattedChoices);
          }

          setCorrectAnswer(data.correctAnswer || 'A');
          setAiTakeaway(data.aiTakeaway || '');
          setExplanation(data.explanation || '');
          if (data.graphData && data.graphData.hasGraph) {
            setGraphData(data.graphData);
          }
          if (data.mistakeTypeHint) {
            setMistakeType(data.mistakeTypeHint);
          }
          if (data.difficulty) {
            setDifficulty(data.difficulty);
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error parsing screenshot:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to analyze screenshot.');
          setLoading(false);
        }
      }
    };

    processScreenshot();

    return () => {
      isMounted = false;
    };
  }, [activeImages, mimeType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse choicesText back to AnswerChoice[]
    const lines = choicesText.split('\n').filter((l) => l.trim().length > 0);
    const parsedChoices = lines.map((line) => {
      const match = line.match(/^([A-D])[\):.]?\s*(.*)/i);
      if (match) {
        return { label: match[1].toUpperCase(), text: match[2] };
      }
      return { label: '', text: line };
    });

    const newItem: SATErrorItem = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      subject,
      subTopic: subTopic.trim() || 'General',
      questionText: questionText.trim(),
      answerChoices: parsedChoices,
      correctAnswer: correctAnswer.trim(),
      aiTakeaway: aiTakeaway.trim(),
      explanation: explanation.trim(),
      imageDataUrl: activeImages[0] || undefined,
      imageDataUrls: activeImages.length > 0 ? activeImages : undefined,
      graphData,
      userNotes: userNotes.trim(),
      mistakeType,
      masteryStatus: 'Confused',
      masteryLevel: 0,
      nextReviewDate: new Date().toISOString(), // Due immediately for review
      reviewHistory: [],
      testSource: testSource.trim(),
      difficulty,
    };

    await saveError(newItem);
    onSaved(newItem);
  };

  if (activeImages.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Auto-Log SAT Error
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Gemini 3.1 Flash Lite parsed your screenshot(s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 shadow-md">
                  <Sparkles className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Processing Screenshot(s)
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse mb-6">
                {loadingStep}
              </p>

              {/* Image Preview thumbnails */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                {activeImages.map((img, idx) => (
                  <div key={idx} className="w-28 h-20 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-950 p-0.5">
                    <img src={img} alt={`SAT Screenshot ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Could not extract details
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-700"
              >
                Close & Try Another
              </button>
            </div>
          ) : (
            <form id="auto-log-form" onSubmit={handleSave} className="space-y-6">
              {/* Top Split: Image Preview + Categorization Tags */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Image Preview */}
                <div className="md:col-span-5 flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                      Uploaded Screenshot{activeImages.length > 1 ? `s (${activeImages.length})` : ''}
                    </span>
                    {activeImages.length > 1 && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        Click thumbnail to switch
                      </span>
                    )}
                  </label>
                  <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden max-h-56 flex items-center justify-center p-2">
                    <img
                      src={activeImages[activePreviewIndex] || activeImages[0]}
                      alt="Question screenshot"
                      className="max-h-52 w-auto object-contain rounded"
                    />
                  </div>
                  {activeImages.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {activeImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActivePreviewIndex(idx)}
                          className={`w-14 h-12 rounded-lg border overflow-hidden shrink-0 transition-all ${
                            activePreviewIndex === idx
                              ? 'border-blue-500 ring-2 ring-blue-500/30 opacity-100'
                              : 'border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-contain bg-slate-950" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Category Fields */}
                <div className="md:col-span-7 grid grid-cols-2 gap-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SAT Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as SATSubject)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Math">Math</option>
                      <option value="Reading & Writing">Reading & Writing</option>
                    </select>
                  </div>

                  {/* SubTopic */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sub-Topic
                    </label>
                    <input
                      type="text"
                      value={subTopic}
                      onChange={(e) => setSubTopic(e.target.value)}
                      placeholder="e.g. Algebra, Standard English"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                      required
                    />
                  </div>

                  {/* Mistake Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mistake Category
                    </label>
                    <select
                      value={mistakeType}
                      onChange={(e) => setMistakeType(e.target.value as MistakeType)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Careless Error">Careless Error</option>
                      <option value="Concept Gap">Concept Gap</option>
                      <option value="Misread Question">Misread Question</option>
                      <option value="Time Pressure">Time Pressure</option>
                      <option value="Calculation Error">Calculation Error</option>
                      <option value="Formula Amnesia">Formula Amnesia</option>
                    </select>
                  </div>

                  {/* Test Source */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Source / Test #
                    </label>
                    <input
                      type="text"
                      value={testSource}
                      onChange={(e) => setTestSource(e.target.value)}
                      placeholder="e.g. Bluebook Test 1"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Render Detected Graph / Diagram if present */}
              {graphData && graphData.hasGraph && (
                <GraphRenderer graphData={graphData} />
              )}

              {/* AI Active Recall Takeaway Box */}
              <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  AI Active Recall Takeaway (Rule / Formula to Remember)
                </label>
                <textarea
                  value={aiTakeaway}
                  onChange={(e) => setAiTakeaway(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-sm rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium"
                  required
                />
              </div>

              {/* Extracted Question & Choices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Extracted Question Text
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={4}
                    className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {questionText.trim() && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Formatted Preview:</span>
                      <MathRenderer text={questionText} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Answer Options (One per line)
                  </label>
                  <textarea
                    value={choicesText}
                    onChange={(e) => setChoicesText(e.target.value)}
                    rows={4}
                    placeholder="A) First choice&#10;B) Second choice&#10;C) Third choice&#10;D) Fourth choice"
                    className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Correct Answer & Personal Reflection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correct Answer
                  </label>
                  <input
                    type="text"
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    placeholder="e.g. B or 42"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Personal Note / Reflection (Optional)
                  </label>
                  <input
                    type="text"
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder='e.g. "Ran out of time", "Forgot to square x"'
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Step-by-Step Explanation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  AI Step-by-Step Solution Breakdown
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !errorMsg && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="auto-log-form"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all scale-100 hover:scale-[1.02] active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save to Error Book</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
