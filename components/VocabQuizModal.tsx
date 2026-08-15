'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  BookMarked,
  Sliders,
  ChevronRight,
  Trophy,
  ArrowRight,
  Award,
  Loader2,
} from 'lucide-react';
import { VocabItem, MasteryStatus } from '@/types/sat';
import { saveVocab } from '@/lib/db';
import MathRenderer from './MathRenderer';
import BluebookTestShell, { BluebookQuestionItem } from './BluebookTestShell';

interface VocabQuizModalProps {
  vocabList: VocabItem[];
  onClose: () => void;
  onRefreshVocab: () => void;
}

type QuestionDirection = 'wordToDef' | 'defToWord' | 'mixed';
type TestFormat = 'choice' | 'typed';
type FilterSubset = 'All' | 'Unmastered' | 'Confused' | 'Learning';

interface QuizQuestion {
  id: string;
  wordItem: VocabItem;
  direction: 'wordToDef' | 'defToWord';
  promptText: string;
  correctAnswerText: string;
  choices?: string[]; // 4 options for multiple choice
}

export default function VocabQuizModal({
  vocabList,
  onClose,
  onRefreshVocab,
}: VocabQuizModalProps) {
  // Config state
  const [subset, setSubset] = useState<FilterSubset>('All');
  const [direction, setDirection] = useState<QuestionDirection>('mixed');
  const [format, setFormat] = useState<TestFormat>('choice');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timerSecondsPerQ, setTimerSecondsPerQ] = useState<number>(0); // 0 = off

  // Test progress state
  const [stage, setStage] = useState<'config' | 'testing' | 'results'>('config');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [answersLog, setAnswersLog] = useState<
    Array<{ question: QuizQuestion; userAnswer: string; isCorrect: boolean }>
  >([]);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Available candidate words
  const availableWords = vocabList.filter((item) => {
    if (subset === 'Confused') return item.masteryStatus === 'Confused';
    if (subset === 'Learning') return item.masteryStatus === 'Learning';
    if (subset === 'Unmastered')
      return item.masteryStatus === 'Confused' || item.masteryStatus === 'Learning';
    return true;
  });

  // Start test
  const handleStartTest = () => {
    if (availableWords.length === 0) return;

    // Shuffle and pick subset
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    const countToPick = Math.min(questionCount, shuffled.length);
    const selected = shuffled.slice(0, countToPick);

    // Build question objects
    const generatedQuestions: QuizQuestion[] = selected.map((item) => {
      let qDir: 'wordToDef' | 'defToWord' = 'wordToDef';
      if (direction === 'defToWord') qDir = 'defToWord';
      else if (direction === 'mixed') {
        qDir = Math.random() > 0.5 ? 'wordToDef' : 'defToWord';
      }

      if (qDir === 'wordToDef') {
        // Shown word, pick definition
        const correctDef = item.definition;
        const otherDefs = vocabList
          .filter((v) => v.id !== item.id)
          .map((v) => v.definition)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        const allChoices = [correctDef, ...otherDefs].sort(() => Math.random() - 0.5);

        return {
          id: item.id,
          wordItem: item,
          direction: 'wordToDef',
          promptText: item.word,
          correctAnswerText: correctDef,
          choices: allChoices,
        };
      } else {
        // Shown definition, pick word
        const correctWord = item.word;
        const otherWords = vocabList
          .filter((v) => v.id !== item.id)
          .map((v) => v.word)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        const allChoices = [correctWord, ...otherWords].sort(() => Math.random() - 0.5);

        return {
          id: item.id,
          wordItem: item,
          direction: 'defToWord',
          promptText: item.definition,
          correctAnswerText: correctWord,
          choices: allChoices,
        };
      }
    });

    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setAnswersLog([]);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setStage('testing');

    if (timerSecondsPerQ > 0) {
      setTimeLeft(timerSecondsPerQ);
    }
  };

  // Map questions to BluebookQuestionItem format
  const bluebookVocabQuestions: BluebookQuestionItem[] = questions.map((q, idx) => {
    let passage: string | undefined = undefined;

    if (q.direction === 'wordToDef') {
      if (q.wordItem.exampleSentence) {
        passage = `### Context Sentence\n\n> "${q.wordItem.exampleSentence}"`;
      }
    } else {
      // defToWord direction: replace occurrences of the target word in the example sentence so the answer is not revealed
      if (q.wordItem.exampleSentence) {
        const escapedWord = q.wordItem.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const sanitizedSentence = q.wordItem.exampleSentence.replace(
          new RegExp(escapedWord, 'gi'),
          '________'
        );
        passage = `### Context Sentence\n\n> "${sanitizedSentence}"`;
      }
    }

    return {
      id: q.id || `${idx}`,
      number: idx + 1,
      passageText: passage,
      questionPrompt:
        q.direction === 'wordToDef'
          ? `Which choice completes the text or defines the vocabulary word **"${q.promptText}"**?`
          : `Which vocabulary word corresponds to the definition:\n\n*"${q.promptText}"*?`,
      choices: q.choices,
      correctAnswer: q.correctAnswerText,
      isGridIn: format === 'typed',
      subject: 'Reading & Writing',
      subTopic: 'Vocabulary in Context',
    };
  });

  const handleBluebookVocabFinish = ({
    answers,
  }: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => {
    const newLog = questions.map((q, idx) => {
      const rawGiven = answers[idx] || '';
      let userAnswerText = rawGiven;

      const choiceIdx = ['A', 'B', 'C', 'D'].indexOf(rawGiven.toUpperCase());
      if (choiceIdx !== -1 && q.choices && q.choices[choiceIdx]) {
        userAnswerText = q.choices[choiceIdx];
      }

      const isCorrect =
        userAnswerText.trim().toLowerCase() === q.correctAnswerText.trim().toLowerCase();

      if (isCorrect) {
        const newStatus = q.wordItem.masteryStatus === 'Confused' ? 'Learning' : 'Mastered';
        saveVocab({
          ...q.wordItem,
          masteryStatus: newStatus,
          nextReviewDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        });
      }

      return {
        question: q,
        userAnswer: userAnswerText,
        isCorrect,
      };
    });

    setAnswersLog(newLog);
    onRefreshVocab();
    setStage('results');
  };

  // Answer handler
  const handleAnswerSubmit = useCallback((givenAnswer: string) => {
    if (isAnswered) return;

    const currentQ = questions[currentIndex];
    const cleanGiven = givenAnswer.trim().toLowerCase();
    const cleanCorrect = currentQ.correctAnswerText.trim().toLowerCase();

    const isCorrect =
      cleanGiven === cleanCorrect ||
      (currentQ.direction === 'wordToDef' &&
        cleanGiven.length > 3 &&
        cleanCorrect.includes(cleanGiven));

    setIsAnswered(true);
    setSelectedAnswer(givenAnswer);

    setAnswersLog((prev) => [
      ...prev,
      {
        question: currentQ,
        userAnswer: givenAnswer,
        isCorrect,
      },
    ]);
  }, [currentIndex, isAnswered, questions]);

  // Timer Countdown Effect
  useEffect(() => {
    if (stage !== 'testing' || timerSecondsPerQ === 0 || isAnswered) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAnswerSubmit('(Time Expired)');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage, currentIndex, isAnswered, timerSecondsPerQ, handleAnswerSubmit]);

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
      setTypedAnswer('');
      if (timerSecondsPerQ > 0) {
        setTimeLeft(timerSecondsPerQ);
      }
    } else {
      setStage('results');
    }
  };

  // Apply auto mastery
  const [masteryUpdated, setMasteryUpdated] = useState(false);
  const [isSavingMasteries, setIsSavingMasteries] = useState(false);

  const handleApplyMasteryUpdates = async () => {
    if (isSavingMasteries || masteryUpdated) return;
    setIsSavingMasteries(true);

    try {
      for (const entry of answersLog) {
        const item = entry.question.wordItem;
        let newStatus: MasteryStatus = item.masteryStatus || 'Learning';

        if (entry.isCorrect) {
          newStatus = item.masteryStatus === 'Learning' ? 'Mastered' : 'Learning';
        } else {
          newStatus = 'Confused';
        }

        await saveVocab({
          ...item,
          masteryStatus: newStatus,
          nextReviewDate: new Date(Date.now() + 86400000 * (entry.isCorrect ? 3 : 1)).toISOString(),
        });
      }
      setMasteryUpdated(true);
      onRefreshVocab();
    } catch (err) {
      console.error('Failed to update vocab masteries:', err);
    } finally {
      setIsSavingMasteries(false);
    }
  };

  const correctCount = answersLog.filter((a) => a.isCorrect).length;
  const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Random Vocabulary Test Mode</h2>
              <p className="text-xs text-slate-400">
                Customizable active recall & retention drill
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STAGE 1: CONFIGURATION */}
          {stage === 'config' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  <span className="font-bold">Vocab Bank Ready:</span> You have{' '}
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                    {vocabList.length} total words
                  </span>{' '}
                  available. Customize your testing deck, question format, direction, and timer below.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                {/* Word Pool Filter */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    1. Word Pool Subset
                  </label>
                  <select
                    value={subset}
                    onChange={(e) => setSubset(e.target.value as FilterSubset)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="All">All Words ({vocabList.length})</option>
                    <option value="Unmastered">Unmastered Only (Confused + Learning)</option>
                    <option value="Confused">Confused Only 🔴</option>
                    <option value="Learning">Learning Only 🟡</option>
                  </select>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Selected pool: {availableWords.length} candidate word(s).
                  </p>
                </div>

                {/* Question Count */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    2. Question Count
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value={5}>5 Questions (Quick Check)</option>
                    <option value={10}>10 Questions (Standard Drill)</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions (Deep Review)</option>
                    <option value={100}>All Available Words</option>
                  </select>
                </div>

                {/* Question Direction */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    3. Testing Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as QuestionDirection)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="mixed">Mixed (Word ➔ Def & Def ➔ Word)</option>
                    <option value="wordToDef">Word ➔ Find Definition</option>
                    <option value="defToWord">Definition ➔ Find Word</option>
                  </select>
                </div>

                {/* Question Format */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    4. Test Style
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as TestFormat)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="choice">4-Choice Multiple Choice</option>
                    <option value="typed">Direct Type-in / Recall Mode</option>
                  </select>
                </div>

                {/* Speed Timer */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 sm:col-span-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    5. Question Speed Timer
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'No Timer', value: 0 },
                      { label: '15 sec / Q', value: 15 },
                      { label: '30 sec / Q', value: 30 },
                      { label: '60 sec / Q', value: 60 },
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTimerSecondsPerQ(t.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          timerSecondsPerQ === t.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartTest}
                  disabled={availableWords.length === 0}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Start Test ({Math.min(questionCount, availableWords.length)} Questions)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: ACTIVE TESTING (BLUEBOOK FULLSCREEN) */}
          {stage === 'testing' && (
            <BluebookTestShell
              title="Vocabulary Drill"
              sectionName="Reading & Writing • Vocabulary in Context"
              questions={bluebookVocabQuestions}
              timerSeconds={timerSecondsPerQ > 0 ? timerSecondsPerQ * questions.length : 0}
              instantFeedback={false}
              disableHighlighting={true}
              onFinishTest={handleBluebookVocabFinish}
              onClose={onClose}
            />
          )}

          {/* STAGE 3: RESULTS SUMMARY */}
          {stage === 'results' && (
            <div className="space-y-6">
              {/* Score Trophy Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 text-white text-center space-y-2 relative overflow-hidden shadow-lg">
                <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                <h3 className="text-xl font-black">Vocabulary Drill Completed!</h3>
                <p className="text-xs text-indigo-200">
                  You answered {correctCount} out of {questions.length} questions correctly.
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 text-white font-extrabold text-lg">
                    {scorePercent}% Accuracy
                  </span>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Question Item Review
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {answersLog.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                        log.isCorrect
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                          : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span>{log.question.wordItem.word}</span>
                          <span className="text-[10px] font-normal text-slate-600 dark:text-slate-300">
                            ({log.question.wordItem.partOfSpeech})
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300">
                          Def: {log.question.wordItem.definition}
                        </div>
                      </div>

                      <div className="shrink-0 font-bold">
                        {log.isCorrect ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> Missed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Notification Banner */}
              {masteryUpdated && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Vocabulary retention masteries and next review schedules have been successfully updated!
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleStartTest}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Retake Test
                </button>

                <button
                  type="button"
                  onClick={handleApplyMasteryUpdates}
                  disabled={masteryUpdated || isSavingMasteries}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                    masteryUpdated
                      ? 'bg-emerald-700 text-white cursor-default'
                      : isSavingMasteries
                      ? 'bg-emerald-700/80 text-white cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white cursor-pointer'
                  }`}
                >
                  {isSavingMasteries ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Updating Masteries...</span>
                    </>
                  ) : masteryUpdated ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Masteries Updated!</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-white" />
                      <span>Auto-Update Word Masteries</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
