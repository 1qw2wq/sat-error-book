'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Sliders,
  ChevronRight,
  Trophy,
  ArrowRight,
  Award,
  PenTool,
  Eye,
  EyeOff,
  ImageIcon,
  Brain,
  Layers,
} from 'lucide-react';
import { SATErrorItem, SATSubject, MasteryStatus } from '@/types/sat';
import { saveError } from '@/lib/db';
import { gradeStudentResponse } from '@/lib/answerGrading';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import Scratchpad from './Scratchpad';
import BluebookTestShell, { BluebookQuestionItem } from './BluebookTestShell';

interface ErrorQuizModalProps {
  errorsList?: SATErrorItem[];
  errors?: SATErrorItem[];
  onClose: () => void;
  onRefreshData: () => void;
}

type ExamStyle = 'instant' | 'timed';

interface TestAnswerRecord {
  item: SATErrorItem;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export default function ErrorQuizModal({
  errorsList,
  errors: errorsProp,
  onClose,
  onRefreshData,
}: ErrorQuizModalProps) {
  const errorsListResolved = errorsList || errorsProp || [];
  // Config parameters
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const [filterSubTopic, setFilterSubTopic] = useState<string>('All');
  const [filterMistake, setFilterMistake] = useState<string>('All');
  const [filterMastery, setFilterMastery] = useState<string>('ConfusedOrLearning');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [examStyle, setExamStyle] = useState<ExamStyle>('instant');
  const [timerMinutes, setTimerMinutes] = useState<number>(0); // 0 = no overall timer

  // Testing stage
  const [stage, setStage] = useState<'config' | 'testing' | 'results'>('config');
  const [testDeck, setTestDeck] = useState<SATErrorItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Per-question interactive state
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typedResponse, setTypedResponse] = useState<string>('');
  const [showScreenshot, setShowScreenshot] = useState<boolean>(false);
  const [showScratchpad, setShowScratchpad] = useState<boolean>(true);
  const [isQuestionAnswered, setIsQuestionAnswered] = useState<boolean>(false);

  // Master records
  const [testRecords, setTestRecords] = useState<Map<string, TestAnswerRecord>>(new Map());

  // Overall Exam Timer
  const [overallTimeLeft, setOverallTimeLeft] = useState<number>(0);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive available matching error list
  const availableErrors = errorsListResolved.filter((item) => {
    if (filterSubject !== 'All' && item.subject !== filterSubject) return false;
    if (filterSubTopic !== 'All' && item.subTopic !== filterSubTopic) return false;
    if (filterMistake !== 'All' && item.mistakeType !== filterMistake) return false;

    if (filterMastery === 'Confused') return item.masteryStatus === 'Confused';
    if (filterMastery === 'Learning') return item.masteryStatus === 'Learning';
    if (filterMastery === 'ConfusedOrLearning')
      return item.masteryStatus === 'Confused' || item.masteryStatus === 'Learning';

    return true;
  });

  // Extract available subtopics dynamically
  const uniqueSubTopics = Array.from(
    new Set(
      errorsListResolved
        .filter((i) => filterSubject === 'All' || i.subject === filterSubject)
        .map((i) => i.subTopic)
        .filter(Boolean)
    )
  );

  // Start Exam
  const handleStartExam = () => {
    if (availableErrors.length === 0) return;

    const shuffled = [...availableErrors].sort(() => Math.random() - 0.5);
    const count = Math.min(questionCount, shuffled.length);
    const selected = shuffled.slice(0, count);

    setTestDeck(selected);
    setCurrentIndex(0);
    setTestRecords(new Map());
    setIsQuestionAnswered(false);
    setSelectedChoice(null);
    setTypedResponse('');
    setShowScreenshot(false);
    setStage('testing');

    if (timerMinutes > 0) {
      setOverallTimeLeft(timerMinutes * 60);
    }
  };

  // Exam overall timer effect
  useEffect(() => {
    if (stage !== 'testing' || timerMinutes === 0) return;

    examTimerRef.current = setInterval(() => {
      setOverallTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(examTimerRef.current!);
          setStage('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (examTimerRef.current) clearInterval(examTimerRef.current);
    };
  }, [stage, timerMinutes]);

  // Current item
  const currentItem = testDeck[currentIndex];

  // Convert testDeck to Bluebook Question Format
  const bluebookQuestions: BluebookQuestionItem[] = testDeck.map((err, idx) => {
    const choices =
      err.answerChoices && err.answerChoices.length > 0
        ? err.answerChoices.map((c) => c.text)
        : undefined;

    return {
      id: err.id,
      number: idx + 1,
      passageText: err.passageText,
      questionPrompt: err.questionText,
      choices,
      correctAnswer: err.correctAnswer,
      isGridIn: !choices || choices.length === 0,
      imageDataUrl: err.imageDataUrl,
      graphData: err.graphData,
      explanation: err.explanation,
      subject: err.subject,
      subTopic: err.subTopic,
      mistakeType: err.mistakeType,
    };
  });

  const handleBluebookFinish = ({
    answers,
    timeSpentSeconds,
  }: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => {
    const newMap = new Map<string, TestAnswerRecord>();
    testDeck.forEach((err, idx) => {
      const rawGiven = answers[idx] || '';
      let isCorrect = false;

      if (err.answerChoices && err.answerChoices.length > 0) {
        const choiceIdx = ['A', 'B', 'C', 'D'].indexOf(rawGiven.toUpperCase());
        const selectedChoiceObj = choiceIdx !== -1 ? err.answerChoices[choiceIdx] : undefined;
        const givenLabel = selectedChoiceObj ? selectedChoiceObj.label : rawGiven;
        isCorrect = givenLabel.toUpperCase() === err.correctAnswer.toUpperCase();
      } else {
        const res = gradeStudentResponse(rawGiven, err.correctAnswer);
        isCorrect = res.isCorrect;
      }

      newMap.set(err.id, {
        item: err,
        userAnswer: rawGiven,
        isCorrect,
        timeSpentSeconds: Math.round(timeSpentSeconds / (testDeck.length || 1)),
      });
    });

    setTestRecords(newMap);
    setStage('results');
  };

  // Submit response for current item
  const handleAnswerQuestion = (givenAnswer: string) => {
    if (!currentItem) return;

    let isCorrect = false;

    // Multiple choice check
    if (currentItem.answerChoices && currentItem.answerChoices.length > 0) {
      isCorrect = givenAnswer.toUpperCase() === currentItem.correctAnswer.toUpperCase();
    } else {
      // Non-selection / Grid-In evaluation
      const res = gradeStudentResponse(givenAnswer, currentItem.correctAnswer);
      isCorrect = res.isCorrect;
    }

    const record: TestAnswerRecord = {
      item: currentItem,
      userAnswer: givenAnswer,
      isCorrect,
      timeSpentSeconds: 0,
    };

    const newMap = new Map(testRecords);
    newMap.set(currentItem.id, record);
    setTestRecords(newMap);
    setIsQuestionAnswered(true);
  };

  const handleNextOrFinish = () => {
    if (currentIndex + 1 < testDeck.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);

      // Restore if already recorded
      const nextItem = testDeck[nextIdx];
      const existing = testRecords.get(nextItem.id);
      if (existing) {
        setSelectedChoice(existing.userAnswer);
        setTypedResponse(existing.userAnswer);
        setIsQuestionAnswered(true);
      } else {
        setSelectedChoice(null);
        setTypedResponse('');
        setIsQuestionAnswered(false);
      }
      setShowScreenshot(false);
    } else {
      setStage('results');
    }
  };

  // Auto update question masteries
  const [masteryUpdated, setMasteryUpdated] = useState(false);
  const handleApplyMasteryUpdates = async () => {
    for (const record of Array.from(testRecords.values())) {
      const item = record.item;
      let newStatus: MasteryStatus = item.masteryStatus;

      if (record.isCorrect) {
        newStatus = item.masteryStatus === 'Confused' ? 'Learning' : 'Mastered';
      } else {
        newStatus = 'Confused';
      }

      await saveError({
        ...item,
        masteryStatus: newStatus,
        masteryLevel: record.isCorrect ? (item.masteryLevel || 0) + 1 : 0,
        nextReviewDate: new Date(Date.now() + 86400000 * (record.isCorrect ? 3 : 1)).toISOString(),
      });
    }

    setMasteryUpdated(true);
    onRefreshData();
  };

  // Score statistics
  const totalAnswered = testRecords.size;
  const totalCorrect = Array.from(testRecords.values()).filter((r) => r.isCorrect).length;
  const scorePercent = testDeck.length > 0 ? Math.round((totalCorrect / testDeck.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">SAT Error Question Practice Test</h2>
              <p className="text-xs text-slate-400">
                Customizable diagnostic drill & simulated exam mode
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
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                  <span className="font-bold">Error Database Ready:</span> You have{' '}
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">
                    {errorsListResolved.length} total logged errors
                  </span>
                  . Filter by subject, mistake type, or sub-topic to launch a targeted practice test.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                {/* Subject Filter */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    1. Subject Category
                  </label>
                  <select
                    value={filterSubject}
                    onChange={(e) => {
                      setFilterSubject(e.target.value);
                      setFilterSubTopic('All');
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="All">All Subjects (Math + Reading & Writing)</option>
                    <option value="Math">Math Only</option>
                    <option value="Reading & Writing">Reading & Writing Only</option>
                  </select>
                </div>

                {/* Sub-Topic Filter */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    2. Sub-Topic Target
                  </label>
                  <select
                    value={filterSubTopic}
                    onChange={(e) => setFilterSubTopic(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="All">All Sub-Topics</option>
                    {uniqueSubTopics.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mistake Category */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    3. Mistake Type
                  </label>
                  <select
                    value={filterMistake}
                    onChange={(e) => setFilterMistake(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="All">All Mistake Types</option>
                    <option value="Careless Error">Careless Error</option>
                    <option value="Concept Gap">Concept Gap</option>
                    <option value="Misread Question">Misread Question</option>
                    <option value="Time Pressure">Time Pressure</option>
                    <option value="Calculation Error">Calculation Error</option>
                    <option value="Formula Amnesia">Formula Amnesia</option>
                  </select>
                </div>

                {/* Deck Mastery */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    4. Deck Mastery Level
                  </label>
                  <select
                    value={filterMastery}
                    onChange={(e) => setFilterMastery(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ConfusedOrLearning">Confused & Learning Only 🔴🟡</option>
                    <option value="Confused">Confused Only 🔴</option>
                    <option value="Learning">Learning Only 🟡</option>
                    <option value="All">All Errors (Include Mastered)</option>
                  </select>
                </div>

                {/* Question Count & Exam Format */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    5. Question Count
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value={5}>5 Questions (Quick Quiz)</option>
                    <option value={10}>10 Questions (Standard Section)</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions (Full Test)</option>
                    <option value={100}>All Matching Errors</option>
                  </select>
                </div>

                {/* Exam Style */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    6. Test Feedback Mode
                  </label>
                  <select
                    value={examStyle}
                    onChange={(e) => setExamStyle(e.target.value as ExamStyle)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="instant">Instant Feedback & AI Explanations</option>
                    <option value="timed">Simulated Exam Mode (Grade at End)</option>
                  </select>
                </div>

                {/* Overall Timer */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 sm:col-span-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    7. Overall Exam Clock
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Untimed', value: 0 },
                      { label: '10 Minutes', value: 10 },
                      { label: '20 Minutes', value: 20 },
                      { label: '30 Minutes', value: 30 },
                    ].map((tm) => (
                      <button
                        key={tm.value}
                        type="button"
                        onClick={() => setTimerMinutes(tm.value)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          timerMinutes === tm.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {tm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>
                  Matching items available:{' '}
                  <strong className="text-blue-600 dark:text-blue-400">
                    {availableErrors.length} questions
                  </strong>
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartExam}
                  disabled={availableErrors.length === 0}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Start Practice Test</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: ACTIVE TESTING (BLUEBOOK FULLSCREEN) */}
          {stage === 'testing' && (
            <BluebookTestShell
              title="Specialized Training"
              sectionName={`${filterSubject} Practice Test`}
              questions={bluebookQuestions}
              timerSeconds={timerMinutes > 0 ? timerMinutes * 60 : 0}
              instantFeedback={examStyle === 'instant'}
              onFinishTest={handleBluebookFinish}
              onClose={onClose}
            />
          )}

          {/* STAGE 3: RESULTS & DIAGNOSTICS */}
          {stage === 'results' && (
            <div className="space-y-6">
              {/* Score Trophy */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-900 text-white text-center space-y-2 relative overflow-hidden shadow-lg">
                <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                <h3 className="text-xl font-black">SAT Diagnostic Drill Completed!</h3>
                <p className="text-xs text-blue-200">
                  You answered {totalCorrect} out of {testDeck.length} questions correctly.
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 text-white font-extrabold text-lg">
                    {scorePercent}% Accuracy
                  </span>
                </div>
              </div>

              {/* Item Breakdown List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Question Diagnostic Results
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                  {testDeck.map((item, idx) => {
                    const record = testRecords.get(item.id);
                    const isCorrect = record?.isCorrect ?? false;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isCorrect
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            Q{idx + 1}. {item.subject} • {item.subTopic}
                          </span>
                          {isCorrect ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Correct
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                              <XCircle className="w-4 h-4" /> Missed
                            </span>
                          )}
                        </div>

                        <div className="line-clamp-2 text-slate-600 dark:text-slate-300 font-medium">
                          <MathRenderer text={item.questionText} />
                        </div>

                        {!isCorrect && (
                          <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Takeaway:{' '}
                            </span>
                            {item.aiTakeaway}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleStartExam}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Retake Practice Drill
                </button>

                <button
                  type="button"
                  onClick={handleApplyMasteryUpdates}
                  disabled={masteryUpdated}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {masteryUpdated ? 'Masteries Updated!' : 'Auto-Update Question Masteries'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
