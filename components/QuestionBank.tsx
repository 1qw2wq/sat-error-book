'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Search,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Filter,
  BookmarkPlus,
  HelpCircle,
  Eye,
  EyeOff,
  Layers,
  Award,
  BarChart3,
  Calendar,
  Grid,
  FileText,
  Plus,
  Share2,
  Check,
  ChevronDown,
  ArrowUpDown,
  BookMarked,
  Info,
  ListFilter,
  RefreshCw,
  ExternalLink,
  Target,
  GraduationCap,
  Zap,
  Save,
  Trash2,
  History,
  Sliders,
  CheckSquare,
  TrendingUp,
  X,
  Sparkle,
  Bookmark,
  Compass,
  CheckCheck,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import {
  RawSATQuestion,
  SATExamSummary,
  SATCombinedExamSummary,
  SATErrorItem,
  PracticePreset,
  PracticeHistoryItem,
  SavedTestSession,
} from '@/types/sat';
import { SAT_DOMAINS } from '@/lib/satDomains';
import {
  transformRawToBluebookQuestion,
  transformRawToErrorItem,
  splitPassageAndPrompt,
  restoreUnderline,
  formatSelections,
  normalizeAnswer,
} from '@/lib/questionBank';
import { calculateComprehensiveSATScore, ComprehensiveSATScoreReport } from '@/lib/satScoring';
import { evaluateSATQuestionAnswer } from '@/lib/answerGrading';
import BluebookTestShell, { BluebookQuestionItem } from './BluebookTestShell';
import MathRenderer from './MathRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import GraphRenderer from './GraphRenderer';
import QuestionJsonEditModal from './QuestionJsonEditModal';
import PracticeHistoryView from './PracticeHistoryView';
import {
  saveError,
  importErrorsBatch,
  getSavedPracticePresets,
  savePracticePreset,
  deletePracticePreset,
  getPracticeHistory,
  addPracticeHistoryItem,
  clearPracticeHistory,
  getSavedTestSessions,
  deleteSavedTestSession,
} from '@/lib/db';

interface QuestionBankProps {
  onRefreshData?: () => void;
}

// Helper to read initial builder state from localStorage safely
function getStoredBuilderState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('sat_practice_builder_state_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return null;
}

export default function QuestionBank({ onRefreshData }: QuestionBankProps) {
  // Main view navigation inside Question Bank
  const [activeTab, setActiveTab] = useState<'exams' | 'builder' | 'browser' | 'history'>('exams');

  // Summary and statistics
  const [stats, setStats] = useState<{
    totalQuestions: number;
    readingWritingCount: number;
    mathCount: number;
    withGraphsCount: number;
    totalExams: number;
  }>({
    totalQuestions: 9568,
    readingWritingCount: 5476,
    mathCount: 4092,
    withGraphsCount: 373,
    totalExams: 100,
  });

  // Exam sets list
  const [exams, setExams] = useState<SATExamSummary[]>([]);
  const [combinedExams, setCombinedExams] = useState<SATCombinedExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(true);
  const [examSearch, setExamSearch] = useState<string>('');
  const [examSectionFilter, setExamSectionFilter] = useState<'Combined' | 'All' | 'Reading and Writing' | 'Math'>('Combined');

  // Domain statistics breakdown
  const [domainBreakdown, setDomainBreakdown] = useState<{
    rwDomains: Array<{ id: string; name: string; description: string; count: number }>;
    mathDomains: Array<{ id: string; name: string; description: string; count: number }>;
  }>({
    rwDomains: [],
    mathDomains: [],
  });

  // Custom Practice Builder State (Initialized with LocalStorage cache if available)
  const [builderSection, setBuilderSection] = useState<'All' | 'Reading and Writing' | 'Math'>(
    () => (getStoredBuilderState()?.section as any) || 'All'
  );
  const [builderDomain, setBuilderDomain] = useState<string>(
    () => getStoredBuilderState()?.domain || 'All'
  );
  const [builderModule, setBuilderModule] = useState<'All' | 'Module 1' | 'Module 2'>(
    () => (getStoredBuilderState()?.module as any) || 'All'
  );
  const [builderYear, setBuilderYear] = useState<string>(
    () => getStoredBuilderState()?.year || 'All'
  );
  const [builderExam, setBuilderExam] = useState<string>(
    () => getStoredBuilderState()?.exam || 'All'
  );
  const [builderDifficultyRange, setBuilderDifficultyRange] = useState<[number, number]>(
    () => (Array.isArray(getStoredBuilderState()?.difficultyRange) && getStoredBuilderState()?.difficultyRange.length === 2)
      ? getStoredBuilderState()?.difficultyRange
      : [5, 10]
  );
  const [builderType, setBuilderType] = useState<'All' | 'Single Choice' | 'Fill-in-the-Blank / Free Response'>(
    () => (getStoredBuilderState()?.type as any) || 'All'
  );
  const [builderOnlyGraphs, setBuilderOnlyGraphs] = useState<boolean>(
    () => Boolean(getStoredBuilderState()?.onlyGraphs)
  );
  const [builderCount, setBuilderCount] = useState<number>(
    () => (typeof getStoredBuilderState()?.count === 'number' ? getStoredBuilderState()?.count : 20)
  );
  const [builderTimerMode, setBuilderTimerMode] = useState<'official' | 'speed30' | 'speed60' | 'untimed'>(
    () => (getStoredBuilderState()?.timerMode as any) || 'official'
  );
  const [builderDeliveryMode, setBuilderDeliveryMode] = useState<'exam' | 'instant_feedback'>(
    () => (getStoredBuilderState()?.deliveryMode as any) || 'instant_feedback'
  );

  // Live pool counter and generation state
  const [livePoolCount, setLivePoolCount] = useState<number>(9568);
  const [isCountingPool, setIsCountingPool] = useState<boolean>(false);
  const [isGeneratingTest, setIsGeneratingTest] = useState<boolean>(false);

  // Saved Presets, Saved Test Sessions & Drill History State (initialized lazily)
  const [presets, setPresets] = useState<PracticePreset[]>(() => getSavedPracticePresets());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [drillHistory, setDrillHistory] = useState<PracticeHistoryItem[]>(() => getPracticeHistory());
  const [savedSessions, setSavedSessions] = useState<SavedTestSession[]>(() => getSavedTestSessions());
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);
  const [newPresetTitle, setNewPresetTitle] = useState<string>('');
  const [newPresetDesc, setNewPresetDesc] = useState<string>('');

  const refreshHistoryAndSaved = useCallback(() => {
    setDrillHistory(getPracticeHistory());
    setSavedSessions(getSavedTestSessions());
  }, []);

  // Question Browser State
  const [browserQuestions, setBrowserQuestions] = useState<RawSATQuestion[]>([]);
  const [browserTotal, setBrowserTotal] = useState<number>(0);
  const [browserPage, setBrowserPage] = useState<number>(1);
  const [browserLimit] = useState<number>(15);
  const [browserTotalPages, setBrowserTotalPages] = useState<number>(1);
  const [browserQuery, setBrowserQuery] = useState<string>('');
  const [browserSection, setBrowserSection] = useState<string>('All');
  const [browserDifficulty, setBrowserDifficulty] = useState<string>('All');
  const [browserExamFilter, setBrowserExamFilter] = useState<string>('All');
  const [browserOnlyGraphs, setBrowserOnlyGraphs] = useState<boolean>(false);
  const [isLoadingBrowser, setIsLoadingBrowser] = useState<boolean>(false);

  // Expanded explanations in browser
  const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({});
  const [addedToErrorBook, setAddedToErrorBook] = useState<Record<number, boolean>>({});

  // JSON Math & Question Editor Modal
  const [editingJsonQuestion, setEditingJsonQuestion] = useState<RawSATQuestion | null>(null);
  const [showJsonEditor, setShowJsonEditor] = useState<boolean>(false);

  const handleOpenJsonEditor = (q: RawSATQuestion) => {
    setEditingJsonQuestion(q);
    setShowJsonEditor(true);
  };

  const handleJsonQuestionSaved = (updatedQ: RawSATQuestion) => {
    // Update question in browser list if present
    setBrowserQuestions((prev) =>
      prev.map((q) => (q.question_id === updatedQ.question_id ? updatedQ : q))
    );

    // Update test results raw questions if present
    setTestResults((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rawQuestions: prev.rawQuestions.map((q) =>
          q.question_id === updatedQ.question_id ? updatedQ : q
        ),
      };
    });

    if (onRefreshData) {
      onRefreshData();
    }
  };

  // Active Bluebook Testing Session
  const [testingSession, setTestingSession] = useState<{
    isOpen: boolean;
    title: string;
    sectionName: string;
    questions: BluebookQuestionItem[];
    rawQuestions: RawSATQuestion[];
    timerSeconds: number;
    perQuestionTimerSeconds: number;
    isUntimed?: boolean;
    isOfficialExam?: boolean;
    instantFeedback: boolean;
    initialAnswers?: Record<number, string>;
    initialMarkedForReview?: Record<number, boolean>;
    initialCurrentIndex?: number;
    initialCurrentModuleIdx?: number;
    initialTimeSpentSeconds?: number;
    initialModuleTimeLeft?: number;
    savedSessionId?: string;
    examType?: 'official_full' | 'official_section' | 'custom_drill' | 'single_question';
    presetConfig?: any;
  } | null>(null);

  // Completed Test Results with Comprehensive Scoring
  const [testResults, setTestResults] = useState<{
    title: string;
    rawQuestions: RawSATQuestion[];
    bluebookQuestions: BluebookQuestionItem[];
    userAnswers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
    scoreReport: ComprehensiveSATScoreReport;
  } | null>(null);

  const [savingAllMissed, setSavingAllMissed] = useState<boolean>(false);
  const [savedAllMissedSuccess, setSavedAllMissedSuccess] = useState<boolean>(false);
  const [aiAnalyses, setAiAnalyses] = useState<Record<number, string>>({});
  const [loadingAiAnalysis, setLoadingAiAnalysis] = useState<Record<number, boolean>>({});

  // Load Exam Summary, Combined Exams, Domains, Presets, History, and Builder State on mount
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [sumRes, combRes, domRes] = await Promise.all([
          fetch('/api/questions?action=stats'),
          fetch('/api/questions?action=combined_exams'),
          fetch('/api/questions?action=domains'),
        ]);

        const sumData = await sumRes.json();
        const combData = await combRes.json();
        const domData = await domRes.json();

        if (!ignore && sumData.success) {
          setStats({
            totalQuestions: sumData.totalQuestions,
            readingWritingCount: sumData.readingWritingCount,
            mathCount: sumData.mathCount,
            withGraphsCount: sumData.withGraphsCount,
            totalExams: sumData.totalExams,
          });
          setExams(sumData.exams || []);
        }

        if (!ignore && combData.success) {
          setCombinedExams(combData.combinedExams || []);
        }

        if (!ignore && domData.success) {
          setDomainBreakdown({
            rwDomains: domData.rwDomains || [],
            mathDomains: domData.mathDomains || [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch questions summary:', err);
      } finally {
        if (!ignore) setIsLoadingExams(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // Save builder state to localStorage and dynamically calculate pool count on filter change
  useEffect(() => {
    // 1. Persist state to prevent data loss
    try {
      localStorage.setItem(
        'sat_practice_builder_state_v1',
        JSON.stringify({
          section: builderSection,
          domain: builderDomain,
          module: builderModule,
          year: builderYear,
          exam: builderExam,
          difficultyRange: builderDifficultyRange,
          type: builderType,
          onlyGraphs: builderOnlyGraphs,
          count: builderCount,
          timerMode: builderTimerMode,
          deliveryMode: builderDeliveryMode,
        })
      );
    } catch (e) {
      // ignore
    }

    // 2. Fetch live pool count
    let isCurrent = true;

    const timer = setTimeout(async () => {
      try {
        setIsCountingPool(true);

        // Gather all practiced question IDs to exclude
        const history = getPracticeHistory();
        const completedIds = new Set<number>();
        history.forEach((item) => {
          item.questionSummaries?.forEach((qs) => {
            const id = typeof qs.questionId === 'number' ? qs.questionId : parseInt(String(qs.questionId), 10);
            if (!isNaN(id)) completedIds.add(id);
          });
        });

        const params = new URLSearchParams({
          action: 'pool_count',
          section: builderSection,
          domain: builderDomain,
          module: builderModule,
          year: builderYear,
          exam_name: builderExam,
          minDiff: String(builderDifficultyRange[0]),
          maxDiff: String(builderDifficultyRange[1]),
          type: builderType,
          hasGraphs: String(builderOnlyGraphs),
        });

        if (completedIds.size > 0) {
          params.set('excludeIds', Array.from(completedIds).join(','));
        }

        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = await res.json();
        if (isCurrent && data.success && typeof data.poolCount === 'number') {
          setLivePoolCount(data.poolCount);
        }
      } catch (err) {
        // fallback
      } finally {
        if (isCurrent) setIsCountingPool(false);
      }
    }, 120);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [
    builderSection,
    builderDomain,
    builderModule,
    builderYear,
    builderExam,
    builderDifficultyRange,
    builderType,
    builderOnlyGraphs,
    builderCount,
    builderTimerMode,
    builderDeliveryMode,
  ]);

  // Adjust domain selection if section changes to avoid incompatible domain selections
  const handleSectionChange = (newSection: 'All' | 'Reading and Writing' | 'Math') => {
    setBuilderSection(newSection);
    setActivePresetId(null);
    if (newSection === 'Reading and Writing') {
      const isMathDomain = domainBreakdown.mathDomains.some((d) => d.name === builderDomain);
      if (isMathDomain) setBuilderDomain('All');
      if (builderExam !== 'All') {
        const examObj = exams.find((e) => e.exam_name === builderExam);
        if (examObj && examObj.section === 'Math') setBuilderExam('All');
      }
    } else if (newSection === 'Math') {
      const isRwDomain = domainBreakdown.rwDomains.some((d) => d.name === builderDomain);
      if (isRwDomain) setBuilderDomain('All');
      if (builderExam !== 'All') {
        const examObj = exams.find((e) => e.exam_name === builderExam);
        if (examObj && examObj.section === 'Reading and Writing') setBuilderExam('All');
      }
    }
  };

  // Preset Handlers
  const handleApplyPreset = (preset: PracticePreset) => {
    setActivePresetId(preset.id);
    setBuilderSection(preset.section);
    setBuilderDomain(preset.domain || 'All');
    setBuilderModule(preset.module || 'All');
    setBuilderYear(preset.year || 'All');
    setBuilderExam(preset.exam || 'All');
    setBuilderDifficultyRange(preset.difficultyRange || [1, 10]);
    setBuilderType(preset.type || 'All');
    setBuilderOnlyGraphs(Boolean(preset.onlyGraphs));
    setBuilderCount(preset.questionCount || 20);
    setBuilderTimerMode(preset.timerMode || 'official');
    setBuilderDeliveryMode(preset.deliveryMode || 'instant_feedback');
  };

  const handleSaveCurrentAsPreset = () => {
    if (!newPresetTitle.trim()) return;
    const newPreset: PracticePreset = {
      id: `custom-preset-${Date.now()}`,
      title: newPresetTitle.trim(),
      description: newPresetDesc.trim() || 'Custom user practice preset',
      section: builderSection,
      domain: builderDomain,
      module: builderModule,
      year: builderYear,
      exam: builderExam,
      difficultyRange: builderDifficultyRange,
      type: builderType,
      onlyGraphs: builderOnlyGraphs,
      questionCount: builderCount,
      timerMode: builderTimerMode,
      deliveryMode: builderDeliveryMode,
      createdAt: new Date().toISOString(),
    };

    const updated = savePracticePreset(newPreset);
    setPresets(updated);
    setActivePresetId(newPreset.id);
    setShowSavePresetModal(false);
    setNewPresetTitle('');
    setNewPresetDesc('');
  };

  const handleDeletePresetItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deletePracticePreset(id);
    setPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleResetBuilder = () => {
    setActivePresetId(null);
    setBuilderSection('All');
    setBuilderDomain('All');
    setBuilderModule('All');
    setBuilderYear('All');
    setBuilderExam('All');
    setBuilderDifficultyRange([5, 10]);
    setBuilderType('All');
    setBuilderOnlyGraphs(false);
    setBuilderCount(20);
    setBuilderTimerMode('official');
    setBuilderDeliveryMode('instant_feedback');
  };

  // Quick difficulty range buttons (Scale: 5 = Hardest, 10 = Easiest)
  const handleSetDifficultyTier = (tier: 'all' | 'hardest' | 'medium' | 'easiest') => {
    setActivePresetId(null);
    if (tier === 'all') setBuilderDifficultyRange([5, 10]);
    else if (tier === 'hardest') setBuilderDifficultyRange([5, 6]);
    else if (tier === 'medium') setBuilderDifficultyRange([7, 8]);
    else if (tier === 'easiest') setBuilderDifficultyRange([9, 10]);
  };

  // Fetch Browser Questions
  useEffect(() => {
    let ignore = false;
    async function searchBrowser() {
      if (activeTab !== 'browser') return;
      setIsLoadingBrowser(true);
      try {
        const params = new URLSearchParams({
          action: 'search',
          page: String(browserPage),
          limit: String(browserLimit),
        });
        if (browserQuery) params.set('q', browserQuery);
        if (browserSection !== 'All') params.set('section', browserSection);
        if (browserDifficulty !== 'All') params.set('difficulty', browserDifficulty);
        if (browserExamFilter !== 'All') params.set('exam_name', browserExamFilter);
        if (browserOnlyGraphs) params.set('hasGraphs', 'true');

        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = await res.json();
        if (!ignore && data.success) {
          setBrowserQuestions(data.questions || []);
          setBrowserTotal(data.total || 0);
          setBrowserTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        console.error('Failed to search questions:', err);
      } finally {
        if (!ignore) setIsLoadingBrowser(false);
      }
    }

    searchBrowser();
    return () => {
      ignore = true;
    };
  }, [activeTab, browserPage, browserLimit, browserQuery, browserSection, browserDifficulty, browserExamFilter, browserOnlyGraphs]);

  // Filtered single-section exams
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (examSectionFilter !== 'All' && examSectionFilter !== 'Combined' && e.section !== examSectionFilter) return false;
      if (examSearch) {
        const query = examSearch.toLowerCase();
        return e.exam_name.toLowerCase().includes(query) || e.category.toLowerCase().includes(query);
      }
      return true;
    });
  }, [exams, examSectionFilter, examSearch]);

  // Filtered combined exams
  const filteredCombinedExams = useMemo(() => {
    if (!examSearch) return combinedExams;
    const query = examSearch.toLowerCase();
    return combinedExams.filter((c) =>
      c.title.toLowerCase().includes(query) || c.baseName.toLowerCase().includes(query)
    );
  }, [combinedExams, examSearch]);

  // Launch Full Combined Exam (Reading & Writing + Math merged with 4 modules)
  const handleStartCombinedExam = async (combined: SATCombinedExamSummary) => {
    setIsGeneratingTest(true);
    try {
      const params = new URLSearchParams({
        action: 'get_combined_exam',
        base_name: combined.baseName,
        rw_exam_name: combined.readingWritingExamName,
        math_exam_name: combined.mathExamName,
      });

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !data.questions || data.questions.length === 0) {
        alert('No questions found for this combined exam selection.');
        return;
      }

      const rawList: RawSATQuestion[] = data.questions;
      const bluebookList: BluebookQuestionItem[] = rawList.map((q, idx) =>
        transformRawToBluebookQuestion(q, idx)
      );

      setTestingSession({
        isOpen: true,
        title: `${combined.baseName} Full-Length Digital SAT Exam`,
        sectionName: 'Complete Official Practice Test (Reading, Writing & Math)',
        questions: bluebookList,
        rawQuestions: rawList,
        timerSeconds: 0, // BluebookTestShell will use official per-module timers (32m + 32m + 35m + 35m)
        perQuestionTimerSeconds: 0,
        isOfficialExam: true,
        isUntimed: false,
        instantFeedback: false,
      });
    } catch (err) {
      console.error('Failed to launch combined exam:', err);
      alert('Error loading combined exam.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Launch Single-Section Full Exam or Module Test
  const handleStartExamTest = async (examName: string, moduleFilter?: 'Module 1' | 'Module 2') => {
    setIsGeneratingTest(true);
    try {
      const params = new URLSearchParams({
        action: 'get_exam',
        exam_name: examName,
      });
      if (moduleFilter) params.set('module', moduleFilter);

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !data.questions || data.questions.length === 0) {
        alert('No questions found for this exam selection.');
        return;
      }

      const rawList: RawSATQuestion[] = data.questions;
      const bluebookList: BluebookQuestionItem[] = rawList.map((q, idx) =>
        transformRawToBluebookQuestion(q, idx)
      );

      const firstQ = rawList[0];
      const isRW = firstQ.section === 'Reading and Writing';
      const sectionTitle = isRW ? 'Section 1: Reading and Writing' : 'Section 2: Math';
      const moduleTitle = moduleFilter ? ` • ${moduleFilter}` : '';

      setTestingSession({
        isOpen: true,
        title: `${examName}${moduleTitle}`,
        sectionName: `${sectionTitle}${moduleTitle}`,
        questions: bluebookList,
        rawQuestions: rawList,
        timerSeconds: 0, // Auto-handled per module for official exam
        perQuestionTimerSeconds: 0,
        isOfficialExam: true,
        isUntimed: false,
        instantFeedback: false,
      });
    } catch (err) {
      console.error('Failed to launch exam test:', err);
      alert('Error loading exam test. Please try again.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Launch Custom Drill from Builder
  const handleStartCustomDrill = async () => {
    setIsGeneratingTest(true);
    try {
      // Gather all practiced question IDs to exclude
      const history = getPracticeHistory();
      const completedIds = new Set<number>();
      history.forEach((item) => {
        item.questionSummaries?.forEach((qs) => {
          const id = typeof qs.questionId === 'number' ? qs.questionId : parseInt(String(qs.questionId), 10);
          if (!isNaN(id)) completedIds.add(id);
        });
      });

      const params = new URLSearchParams({
        action: 'random',
        count: String(builderCount),
        section: builderSection,
        domain: builderDomain,
        module: builderModule,
        year: builderYear,
        exam_name: builderExam,
        minDiff: String(builderDifficultyRange[0]),
        maxDiff: String(builderDifficultyRange[1]),
        type: builderType,
        hasGraphs: String(builderOnlyGraphs),
      });

      if (completedIds.size > 0) {
        params.set('excludeIds', Array.from(completedIds).join(','));
      }

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !data.questions || data.questions.length === 0) {
        alert('No questions matched your custom drill criteria. Try broadening your difficulty tier or filters.');
        return;
      }

      const rawList: RawSATQuestion[] = data.questions;
      const bluebookList: BluebookQuestionItem[] = rawList.map((q, idx) =>
        transformRawToBluebookQuestion(q, idx)
      );

      let overallTimer = 0;
      let perQTimer = 0;
      const isUntimedDrill = builderTimerMode === 'untimed';

      if (builderTimerMode === 'official') {
        const rwCount = rawList.filter((q) => q.section === 'Reading and Writing').length;
        const mathCount = rawList.filter((q) => q.section === 'Math').length;
        overallTimer = Math.round(rwCount * 71.1 + mathCount * 95.5);
      } else if (builderTimerMode === 'speed30') {
        perQTimer = 30;
        overallTimer = rawList.length * 30;
      } else if (builderTimerMode === 'speed60') {
        perQTimer = 60;
        overallTimer = rawList.length * 60;
      }

      const domainSub = builderDomain !== 'All' ? ` • ${builderDomain}` : '';
      const sectionSub = builderSection !== 'All' ? builderSection : 'SAT Mixed Drill';

      setTestingSession({
        isOpen: true,
        title: `Custom SAT Drill (${rawList.length} Questions)`,
        sectionName: `${sectionSub}${domainSub}`,
        questions: bluebookList,
        rawQuestions: rawList,
        timerSeconds: overallTimer,
        perQuestionTimerSeconds: perQTimer,
        isUntimed: isUntimedDrill,
        isOfficialExam: false,
        instantFeedback: builderDeliveryMode === 'instant_feedback',
        presetConfig: {
          section: builderSection,
          domain: builderDomain,
          module: builderModule,
          difficultyRange: builderDifficultyRange,
          type: builderType,
          timerMode: builderTimerMode,
          deliveryMode: builderDeliveryMode,
        },
      });
    } catch (err) {
      console.error('Failed to start drill:', err);
      alert('Failed to generate practice drill.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Launch Quick Single Question Test
  const handleTestSingleQuestion = (raw: RawSATQuestion) => {
    const bluebookQ = transformRawToBluebookQuestion(raw, 0);
    setTestingSession({
      isOpen: true,
      title: `Question #${raw.question_no} • ${raw.exam_name}`,
      sectionName: `${raw.section} • ${raw.module}`,
      questions: [bluebookQ],
      rawQuestions: [raw],
      timerSeconds: 0,
      perQuestionTimerSeconds: 0,
      isUntimed: true,
      isOfficialExam: false,
      instantFeedback: true,
    });
  };

  // Finish Bluebook Test Handler - Runs Advanced Scoring Engine & Persists History
  const handleFinishTest = (results: {
    answers: Record<number, string>;
    markedForReview: Record<number, boolean>;
    timeSpentSeconds: number;
  }) => {
    if (!testingSession) return;

    // Advanced IRT Adaptive Score Calculation
    const scoreReport = calculateComprehensiveSATScore(
      testingSession.rawQuestions,
      testingSession.questions,
      results.answers,
      results.timeSpentSeconds
    );

    setTestResults({
      title: testingSession.title,
      rawQuestions: testingSession.rawQuestions,
      bluebookQuestions: testingSession.questions,
      userAnswers: results.answers,
      markedForReview: results.markedForReview,
      timeSpentSeconds: results.timeSpentSeconds,
      scoreReport,
    });

    // Build question-by-question summaries for Practice History Review
    const questionSummaries = testingSession.rawQuestions.map((raw, idx) => {
      const userAns = results.answers[idx] || '';
      const parsed = splitPassageAndPrompt(raw.question, raw.section, raw.explanations);
      const isCorrect = evaluateSATQuestionAnswer(userAns, raw.answers, formatSelections(raw.selections));
      return {
        questionId: raw.question_id,
        questionNo: raw.question_no || idx + 1,
        section: raw.section,
        subTopic: raw.category || raw.section,
        questionPrompt: parsed.questionPrompt,
        passageText: parsed.passageText,
        userAnswer: userAns,
        correctAnswer: raw.answers,
        isCorrect,
        explanation: raw.explanations,
        difficulty: raw.difficulty,
        choices: formatSelections(raw.selections),
        graphData: raw.graphs,
      };
    });

    // Determine Exam Category for History
    const examType: 'official_full' | 'official_section' | 'custom_drill' | 'single_question' = testingSession.isOfficialExam
      ? testingSession.title.includes('Full-Length')
        ? 'official_full'
        : 'official_section'
      : testingSession.questions.length === 1
      ? 'single_question'
      : 'custom_drill';

    const firstQ = testingSession.rawQuestions[0];
    const defaultSectionName = firstQ ? firstQ.section : testingSession.sectionName;

    const historyItem: PracticeHistoryItem = {
      id: `practice-hist-${Date.now()}`,
      title: testingSession.title,
      section: defaultSectionName,
      domain: builderDomain || 'All',
      examType,
      examName: testingSession.title,
      questionCount: testingSession.rawQuestions.length,
      totalQuestions: scoreReport.totalQuestions,
      score: scoreReport.totalCorrect,
      percentage: Math.round((scoreReport.totalCorrect / Math.max(1, scoreReport.totalQuestions)) * 100),
      scaledTotalScore: scoreReport.totalScaledScore,
      scaledRwScore: scoreReport.readingWriting?.scaledScore,
      scaledMathScore: scoreReport.math?.scaledScore,
      timeSpentSeconds: results.timeSpentSeconds,
      completedAt: new Date().toISOString(),
      presetConfig: {
        section: builderSection,
        domain: builderDomain,
        module: builderModule,
        difficultyRange: builderDifficultyRange,
        type: builderType,
        timerMode: builderTimerMode,
        deliveryMode: builderDeliveryMode,
      },
      questionSummaries,
    };

    const updatedHistory = addPracticeHistoryItem(historyItem);
    setDrillHistory(updatedHistory);

    // If this test was resumed from a saved session, delete that saved session now
    if (testingSession.savedSessionId) {
      deleteSavedTestSession(testingSession.savedSessionId);
      setSavedSessions(getSavedTestSessions());
    }

    setSavedAllMissedSuccess(false);
    setTestingSession(null);
  };

  // Resume a saved test session from Save & Exit
  const handleResumeSavedTest = (session: SavedTestSession) => {
    setTestingSession({
      isOpen: true,
      title: session.title,
      sectionName: session.sectionName,
      questions: session.questions,
      rawQuestions: session.rawQuestions,
      timerSeconds: session.timerSeconds || 0,
      perQuestionTimerSeconds: session.perQuestionTimerSeconds || 0,
      isUntimed: session.isUntimed,
      isOfficialExam: session.isOfficialExam,
      instantFeedback: session.instantFeedback || false,
      initialAnswers: session.answers,
      initialMarkedForReview: session.markedForReview,
      initialCurrentIndex: session.currentIndex,
      initialCurrentModuleIdx: session.currentModuleIdx,
      initialTimeSpentSeconds: session.timeSpentSeconds,
      initialModuleTimeLeft: session.moduleTimeLeft,
      savedSessionId: session.id,
      examType: session.examType,
      presetConfig: session.presetConfig,
    });
  };

  // Discard an auto-saved in-progress session
  const handleDiscardSavedSession = (id: string) => {
    deleteSavedTestSession(id);
    setSavedSessions(getSavedTestSessions());
  };

  // Add individual question to SAT Error Book
  const handleAddToErrorBook = async (raw: RawSATQuestion, userAns?: string) => {
    try {
      const errorItem = transformRawToErrorItem(
        raw,
        userAns ? `Incorrectly answered as "${userAns}"` : 'Saved from Question Bank'
      );
      await saveError(errorItem);
      setAddedToErrorBook((prev) => ({ ...prev, [raw.question_id]: true }));
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to add question to error book:', err);
    }
  };

  // Save all missed questions from completed test directly to SAT Error Book
  const handleSaveAllMissedToErrorBook = async () => {
    if (!testResults) return;
    setSavingAllMissed(true);
    try {
      const missedErrors: SATErrorItem[] = [];

      testResults.bluebookQuestions.forEach((q, idx) => {
        const raw = testResults.rawQuestions[idx];
        const userAns = testResults.userAnswers[idx] || '';
        const correctAns = q.correctAnswer || raw?.answers || '';
        const isCorrect = evaluateSATQuestionAnswer(userAns, correctAns, q.choices || raw?.selections || []);

        if (!isCorrect && raw) {
          const errorItem = transformRawToErrorItem(
            raw,
            `Missed during ${testResults.title} (Your answer: "${userAns || 'Blank'}", Correct: "${correctAns}")`
          );
          missedErrors.push(errorItem);
        }
      });

      if (missedErrors.length > 0) {
        await importErrorsBatch(missedErrors);
      }

      setSavedAllMissedSuccess(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to batch save missed questions:', err);
    } finally {
      setSavingAllMissed(false);
    }
  };

  const handleGenerateAiAnalysis = async (idx: number) => {
    if (!testResults) return;
    const q = testResults.bluebookQuestions[idx];
    const raw = testResults.rawQuestions[idx];
    const userAns = testResults.userAnswers[idx] || '';
    if (!q) return;

    setLoadingAiAnalysis((prev) => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: q.questionPrompt || raw?.question || '',
          passageText: q.passageText || '',
          choices: q.choices || raw?.selections || [],
          correctAnswer: q.correctAnswer || raw?.answers || '',
          userSelectedAnswer: userAns || '',
          explanation: q.explanation || raw?.explanations || '',
          subject: raw?.section || q.subject || 'SAT',
          subTopic: raw?.category || q.subTopic || '',
          mode: 'answer_analysis',
        }),
      });

      const data = await res.json();
      if (data.text) {
        setAiAnalyses((prev) => ({ ...prev, [idx]: data.text }));
      } else {
        alert(data.error || 'Failed to generate AI analysis.');
      }
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      alert('Error communicating with AI analysis service.');
    } finally {
      setLoadingAiAnalysis((prev) => ({ ...prev, [idx]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-6 sm:p-8 md:p-10 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Official SAT Real Exam Question Bank</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Test & Master {stats.totalQuestions.toLocaleString()} Authentic SAT Questions
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Complete collection of past SAT exam papers from 2026, 2025, and previous tests with combined Reading & Writing and Math sections, per-module timed testing, IRT scaled scoring, and instant Error Book synchronization.
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono">{stats.totalQuestions.toLocaleString()}</p>
              <p className="text-xs text-slate-300 font-medium">Total Questions</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">{combinedExams.length || stats.totalExams}</p>
              <p className="text-xs text-slate-300 font-medium">Combined Full Tests</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">{stats.readingWritingCount.toLocaleString()}</p>
              <p className="text-xs text-slate-300 font-medium">Reading & Writing</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">{stats.mathCount.toLocaleString()}</p>
              <p className="text-xs text-slate-300 font-medium">Math Questions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Saved In-Progress Test Resume Alert */}
      {savedSessions.length > 0 && !testingSession && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-2 border-amber-300 dark:border-amber-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Auto-Saved Test Detected
                </span>
                <span className="text-[11px] text-slate-500">
                  ({savedSessions.length} in progress)
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {savedSessions[0].title} — <span className="font-normal text-slate-600 dark:text-slate-300">{Object.values(savedSessions[0].answers || {}).filter(Boolean).length} of {savedSessions[0].questions?.length || 0} answered</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={() => handleResumeSavedTest(savedSessions[0])}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Resume Test</span>
            </button>
            <button
              onClick={() => handleDiscardSavedSession(savedSessions[0].id)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main View Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'exams'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Official Exam Sets</span>
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'builder'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Custom Practice Builder</span>
          </button>

          <button
            onClick={() => setActiveTab('browser')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'browser'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Question Explorer</span>
          </button>

          <button
            onClick={() => {
              refreshHistoryAndSaved();
              setActiveTab('history');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Practice History & Saved Tests</span>
            {savedSessions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {savedSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick Action Button */}
        {activeTab === 'exams' && combinedExams.length > 0 && (
          <button
            onClick={() => handleStartCombinedExam(combinedExams[0])}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Take Complete 2026 Exam (RW + Math)</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OFFICIAL EXAM SETS BROWSER                                          */}
      {/* ========================================================================= */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          {/* Filter and Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Search exam sets (e.g., 2026年6月, 数学, 阅读语法, Complete)..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Section Switcher */}
            <div className="flex items-center gap-1.5 self-center sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['Combined', 'All', 'Reading and Writing', 'Math'] as const).map((sec) => (
                <button
                  key={sec}
                  onClick={() => setExamSectionFilter(sec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    examSectionFilter === sec
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sec === 'Combined'
                    ? 'Combined (RW + Math)'
                    : sec === 'All'
                    ? 'All Single Sections'
                    : sec}
                </button>
              ))}
            </div>
          </div>

          {/* Exam Sets Cards Grid */}
          {isLoadingExams ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Loading official exam sets...</p>
            </div>
          ) : examSectionFilter === 'Combined' ? (
            /* COMBINED EXAMS (READING & WRITING + MATH COMBINED) */
            filteredCombinedExams.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-base font-bold text-slate-700 dark:text-slate-300">No combined exams match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCombinedExams.map((combined, cIdx) => (
                  <div
                    key={combined.id || `comb-${combined.baseName}-${cIdx}`}
                    className="flex flex-col justify-between bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
                  >
                    <div className="space-y-4">
                      {/* Badge Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                          Complete SAT (RW + Math)
                        </span>
                        <div className="text-xs text-slate-500 font-mono font-semibold">
                          <span>Diff: </span>
                          <strong className="text-slate-900 dark:text-white">{combined.avgDifficulty}/10</strong>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {combined.baseName} Full-Length Exam
                      </h3>

                      {/* Module Structure Breakdown */}
                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span>Total: {combined.totalQuestions} Questions</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">4 Timed Modules</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>📖 Reading & Writing:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{combined.readingWritingTotal} Qs (M1 {combined.readingWritingM1} + M2 {combined.readingWritingM2})</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>📐 Math:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{combined.mathTotal} Qs (M1 {combined.mathM1} + M2 {combined.mathM2})</span>
                        </div>
                      </div>
                    </div>

                    {/* Launch Combined Exam Action */}
                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <button
                        onClick={() => handleStartCombinedExam(combined)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all active:scale-98 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Start Complete Exam ({combined.totalQuestions} Questions)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* SINGLE SECTION EXAMS */
            filteredExams.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-base font-bold text-slate-700 dark:text-slate-300">No exam sets match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredExams.map((exam) => {
                  const isRW = exam.section === 'Reading and Writing';
                  return (
                    <div
                      key={exam.exam_name}
                      className="flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                              isRW
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            }`}
                          >
                            {exam.section}
                          </span>

                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono font-semibold">
                            <span>Avg Diff:</span>
                            <span className="font-bold text-slate-900 dark:text-white px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {exam.avgDifficulty}/10
                            </span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {exam.exam_name}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1 font-medium">
                            <Grid className="w-3.5 h-3.5 text-slate-400" />
                            <span>Total: <strong className="text-slate-900 dark:text-white font-mono">{exam.totalQuestions} Qs</strong></span>
                          </div>
                          {exam.module1Count > 0 && (
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                          )}
                          {exam.module1Count > 0 && (
                            <span>M1: <strong className="font-mono text-slate-700 dark:text-slate-300">{exam.module1Count}</strong></span>
                          )}
                          {exam.module2Count > 0 && (
                            <span>M2: <strong className="font-mono text-slate-700 dark:text-slate-300">{exam.module2Count}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                        <button
                          onClick={() => handleStartExamTest(exam.exam_name)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-2xs transition-all active:scale-98 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Take Section Test ({exam.totalQuestions} Questions)</span>
                        </button>

                        {exam.module1Count > 0 && exam.module2Count > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleStartExamTest(exam.exam_name, 'Module 1')}
                              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Module 1 ({exam.module1Count}Q)
                            </button>
                            <button
                              onClick={() => handleStartExamTest(exam.exam_name, 'Module 2')}
                              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Module 2 ({exam.module2Count}Q)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CUSTOM PRACTICE BUILDER                                            */}
      {/* ========================================================================= */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* Top Header & Preset Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Targeted SAT Practice Engine
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">
                  Assemble Custom Digital SAT Practice Drills
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Filter by Digital SAT domain, test year, question type, difficulty tier, and delivery mode.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="View past practice drills"
                >
                  <History className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Drill History</span>
                  {drillHistory.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[10px] text-white font-mono">
                      {drillHistory.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowSavePresetModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Save current filters as a reusable preset"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Save Preset</span>
                </button>

                <button
                  onClick={handleResetBuilder}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Reset all filters to default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Carousel */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Targeted Presets & Curated Drills
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {presets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`group relative shrink-0 px-3.5 py-2 rounded-2xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate max-w-[160px]">{preset.title}</span>
                      <span className="text-[10px] opacity-60 font-mono">
                        {preset.questionCount}Q
                      </span>
                      {preset.id.startsWith('custom-preset-') && (
                        <button
                          onClick={(e) => handleDeletePresetItem(preset.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity p-0.5"
                          title="Delete custom preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Builder Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {/* CARD 1: Section & Domain Targeting */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    1. Subject & Digital SAT Domain
                  </h3>
                </div>

                {/* Section selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Subject Section
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['All', 'Reading and Writing', 'Math'] as const).map((sec) => (
                      <button
                        key={sec}
                        onClick={() => handleSectionChange(sec)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all truncate text-center cursor-pointer ${
                          builderSection === sec
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {sec === 'All' ? 'All (Mixed)' : sec === 'Reading and Writing' ? 'RW Only' : 'Math Only'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between items-center">
                    <span>Target Domain / Skill</span>
                    <span className="text-[10px] text-indigo-500 font-mono">
                      {builderDomain !== 'All' ? 'Filtered' : 'All Domains'}
                    </span>
                  </label>
                  <select
                    value={builderDomain}
                    onChange={(e) => {
                      const selectedDom = e.target.value;
                      setActivePresetId(null);
                      setBuilderDomain(selectedDom);
                      if (selectedDom !== 'All') {
                        const isRw = domainBreakdown.rwDomains.some((d) => d.name === selectedDom);
                        const isMath = domainBreakdown.mathDomains.some((d) => d.name === selectedDom);
                        if (isRw && builderSection === 'Math') {
                          setBuilderSection('Reading and Writing');
                        } else if (isMath && builderSection === 'Reading and Writing') {
                          setBuilderSection('Math');
                        }
                      }
                    }}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="All">All Domains & Subtopics (Comprehensive)</option>
                    
                    {(builderSection === 'All' || builderSection === 'Reading and Writing') && (
                      <optgroup label="Reading & Writing Domains">
                        {domainBreakdown.rwDomains.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name} ({d.count} Qs)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {(builderSection === 'All' || builderSection === 'Math') && (
                      <optgroup label="Math Domains">
                        {domainBreakdown.mathDomains.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name} ({d.count} Qs)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Module Stage Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Module Stage
                  </label>
                  <select
                    value={builderModule}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderModule(e.target.value as any);
                    }}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="All">All Modules (Module 1 & Module 2)</option>
                    <option value="Module 1">Module 1 (Standard / Baseline)</option>
                    <option value="Module 2">Module 2 (Hard / Adaptive)</option>
                  </select>
                </div>
              </div>

              {/* CARD 2: Source Exam & Format */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    2. Exam Source & Format
                  </h3>
                </div>

                {/* Year filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Exam Year
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {['All', '2026', '2025', '2024'].map((yr) => (
                      <button
                        key={yr}
                        onClick={() => {
                          setActivePresetId(null);
                          setBuilderYear(yr);
                          if (yr !== 'All' && builderExam !== 'All' && !builderExam.includes(yr)) {
                            setBuilderExam('All');
                          }
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                          builderYear === yr
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {yr === 'All' ? 'All' : yr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Exam Paper */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Specific Exam Paper
                  </label>
                  <select
                    value={builderExam}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderExam(e.target.value);
                    }}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="All">All 100 Real SAT Exam Papers</option>
                    {exams
                      .filter((e) => builderYear === 'All' || e.exam_name.includes(builderYear))
                      .map((e) => (
                        <option key={e.exam_name} value={e.exam_name}>
                          {e.exam_name} ({e.totalQuestions} Qs)
                        </option>
                      ))}
                  </select>
                </div>

                {/* Question Type */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Question Format
                  </label>
                  <select
                    value={builderType}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderType(e.target.value as any);
                    }}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="All">All Formats (Multiple Choice & Grid-in)</option>
                    <option value="Single Choice">Multiple Choice (4 Options)</option>
                    <option value="Fill-in-the-Blank / Free Response">Student-Produced Response (Grid-in)</option>
                  </select>
                </div>

                {/* Only Graphs Checkbox */}
                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={builderOnlyGraphs}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderOnlyGraphs(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Only Questions with Graphs & Figures</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-[10px] text-amber-800 dark:text-amber-300 font-mono">
                      {stats.withGraphsCount} Qs
                    </span>
                  </span>
                </label>
              </div>

              {/* CARD 3: Difficulty & Target Band */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    3. Difficulty & Score Target
                  </h3>
                </div>

                {/* Quick Difficulty Presets (5 = Hardest, 10 = Easiest) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Difficulty Preset Bands</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">5 = Hardest • 10 = Easiest</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleSetDifficultyTier('all')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        builderDifficultyRange[0] === 5 && builderDifficultyRange[1] === 10
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      All (5-10)
                    </button>
                    <button
                      onClick={() => handleSetDifficultyTier('hardest')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        builderDifficultyRange[0] === 5 && builderDifficultyRange[1] === 6
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      Hardest (5-6)
                    </button>
                    <button
                      onClick={() => handleSetDifficultyTier('medium')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        builderDifficultyRange[0] === 7 && builderDifficultyRange[1] === 8
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      Medium (7-8)
                    </button>
                    <button
                      onClick={() => handleSetDifficultyTier('easiest')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        builderDifficultyRange[0] === 9 && builderDifficultyRange[1] === 10
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      Easiest (9-10)
                    </button>
                  </div>
                </div>

                {/* Custom Range Sliders */}
                <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Range: <span className="font-mono text-amber-600 dark:text-amber-400 font-extrabold">{builderDifficultyRange[0]}</span> to <span className="font-mono text-amber-600 dark:text-amber-400 font-extrabold">{builderDifficultyRange[1]}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Scale 5-10</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-8">Min:</span>
                      <input
                        type="range"
                        min="5"
                        max="10"
                        value={builderDifficultyRange[0]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setActivePresetId(null);
                          setBuilderDifficultyRange([val, Math.max(val, builderDifficultyRange[1])]);
                        }}
                        className="flex-1 accent-amber-600 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold w-4 text-right text-slate-700 dark:text-slate-300">
                        {builderDifficultyRange[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-8">Max:</span>
                      <input
                        type="range"
                        min="5"
                        max="10"
                        value={builderDifficultyRange[1]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setActivePresetId(null);
                          setBuilderDifficultyRange([Math.min(builderDifficultyRange[0], val), val]);
                        }}
                        className="flex-1 accent-amber-600 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold w-4 text-right text-slate-700 dark:text-slate-300">
                        {builderDifficultyRange[1]}
                      </span>
                    </div>
                  </div>

                  {/* Difficulty interpretation banner */}
                  <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200">
                    {builderDifficultyRange[0] <= 6 ? (
                      <span>⚡ <strong>Hardest SAT Tier (5-6)</strong>: Includes the most deceptive traps and multi-layered reasoning items.</span>
                    ) : builderDifficultyRange[0] <= 8 ? (
                      <span>🎯 <strong>Medium Tier (7-8)</strong>: Standard target score questions.</span>
                    ) : (
                      <span>📖 <strong>Easiest Tier (9-10)</strong>: Foundational rules and baseline questions.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 4: Question Count & Timing */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    4. Question Count & Timing
                  </h3>
                </div>

                {/* Quick Count Chips */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Quick Question Targets
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 15, 20, 22, 27, 44, 54].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() => {
                          setActivePresetId(null);
                          setBuilderCount(cnt);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                          builderCount === cnt
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {cnt}Q
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine Count Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Number of Questions:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                      {builderCount} Questions
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="54"
                    step="1"
                    value={builderCount}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderCount(parseInt(e.target.value, 10));
                    }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>5 Blitz</span>
                    <span>27 RW Module</span>
                    <span>54 Full Section</span>
                  </div>
                </div>

                {/* Timing Strategy */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Pacing & Timer Mode
                  </label>
                  <select
                    value={builderTimerMode}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setBuilderTimerMode(e.target.value as any);
                    }}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="official">Official Digital SAT (~71s RW / ~95s Math)</option>
                    <option value="speed60">Paced Sprint (60 seconds / question)</option>
                    <option value="speed30">Rapid Reflex (30 seconds / question)</option>
                    <option value="untimed">Untimed Deep-Thinking Mode</option>
                  </select>
                </div>
              </div>

              {/* CARD 5: Test Delivery & Learning Mode */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-4 md:col-span-2 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    5. Delivery & Feedback Experience
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Instant Feedback Mode */}
                  <div
                    onClick={() => {
                      setActivePresetId(null);
                      setBuilderDeliveryMode('instant_feedback');
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      builderDeliveryMode === 'instant_feedback'
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkle className={`w-4 h-4 ${builderDeliveryMode === 'instant_feedback' ? 'text-purple-600' : 'text-slate-400'}`} />
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Practice & Learn Mode
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Instant feedback per question. Reveals correct answer, option breakdowns, and step-by-step solutions right after submitting.
                    </p>
                  </div>

                  {/* Simulated Bluebook Exam Mode */}
                  <div
                    onClick={() => {
                      setActivePresetId(null);
                      setBuilderDeliveryMode('exam');
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      builderDeliveryMode === 'exam'
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className={`w-4 h-4 ${builderDeliveryMode === 'exam' ? 'text-purple-600' : 'text-slate-400'}`} />
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Simulated Bluebook Exam Mode
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Full exam environment with timer countdown, flagging, review screen, and comprehensive IRT score report at test completion.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE POOL & ACTION FOOTER */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Matching Question Pool:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-black font-mono">
                    {isCountingPool ? 'Computing...' : `${livePoolCount} Available`}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    • Drill Target: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{Math.min(builderCount, livePoolCount || builderCount)}Q</span>
                  </span>
                  <span className="text-slate-400 text-xs font-normal">
                    (Est. ~{Math.round((Math.min(builderCount, livePoolCount || builderCount) * (builderSection === 'Math' ? 95 : 71)) / 60)} mins)
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Active Filters:</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                    {builderSection === 'All' ? 'All Subjects' : builderSection}
                  </span>
                  {builderDomain !== 'All' && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-[200px]">
                      {builderDomain}
                    </span>
                  )}
                  {builderYear !== 'All' && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                      Year: {builderYear}
                    </span>
                  )}
                  {builderExam !== 'All' && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium truncate max-w-[180px]">
                      {builderExam}
                    </span>
                  )}
                  {builderModule !== 'All' && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
                      {builderModule}
                    </span>
                  )}
                  {builderType !== 'All' && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                      {builderType === 'Single Choice' ? 'Multiple Choice' : 'Grid-in'}
                    </span>
                  )}
                  {builderOnlyGraphs && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                      Graphs Only
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                    Diff {builderDifficultyRange[0]}-{builderDifficultyRange[1]}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                    {builderDeliveryMode === 'instant_feedback' ? 'Instant Feedback' : 'Simulated Exam'}
                  </span>
                  {(builderDomain !== 'All' || builderYear !== 'All' || builderExam !== 'All' || builderModule !== 'All' || builderType !== 'All' || builderOnlyGraphs) && (
                    <button
                      onClick={handleResetBuilder}
                      className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer ml-1"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleStartCustomDrill}
                disabled={isGeneratingTest}
                className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isGeneratingTest ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>Generate & Begin Drill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: QUESTION EXPLORER                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'browser' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={browserQuery}
                  onChange={(e) => {
                    setBrowserQuery(e.target.value);
                    setBrowserPage(1);
                  }}
                  placeholder="Search question text, vocabulary, topics..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={browserSection}
                onChange={(e) => {
                  setBrowserSection(e.target.value);
                  setBrowserPage(1);
                }}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="All">All Sections</option>
                <option value="Reading and Writing">Reading and Writing</option>
                <option value="Math">Math</option>
              </select>
            </div>
          </div>

          {/* Question List */}
          {isLoadingBrowser ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm font-medium">Searching questions...</p>
            </div>
          ) : browserQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">No questions found</p>
              <p className="text-xs">Try different search keywords or clearing section filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {browserQuestions.map((q) => {
                const isExpanded = !!expandedExplanations[q.question_id];
                const isAdded = !!addedToErrorBook[q.question_id];
                const isDummySelections =
                  !q.selections ||
                  q.selections.length === 0 ||
                  q.selections.every((s) => !s || /^[A-Da-d][.)\s]*$/.test(s.trim()));
                const has4GraphChoices = Array.isArray(q.graphs) && q.graphs.length === 4 && isDummySelections;
                const has5GraphChoices = Array.isArray(q.graphs) && q.graphs.length === 5 && isDummySelections;
                const choices = formatSelections(q.selections, q.section === 'Math', q.graphs);

                let stemGraphUrl: string | undefined = undefined;
                if (has5GraphChoices && Array.isArray(q.graphs)) {
                  stemGraphUrl = q.graphs[0];
                } else if (!has4GraphChoices && q.graphs) {
                  if (Array.isArray(q.graphs) && q.graphs.length > 0) {
                    stemGraphUrl = q.graphs[0];
                  } else if (typeof q.graphs === 'string' && q.graphs.trim().length > 0) {
                    stemGraphUrl = q.graphs.trim();
                  }
                }

                return (
                  <div
                    key={q.question_id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold">
                          #{q.question_no}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {q.section} • {q.module}
                        </span>
                        <span className="text-xs text-slate-400 hidden sm:inline">• {q.exam_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenJsonEditor(q)}
                          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Manually edit math formulas and content in all_questions.json"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit in JSON</span>
                        </button>

                        <button
                          onClick={() => handleAddToErrorBook(q)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                            isAdded
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          }`}
                        >
                          {isAdded ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                          <span>{isAdded ? 'In Error Book' : 'Add to Error Book'}</span>
                        </button>

                        <button
                          onClick={() => handleTestSingleQuestion(q)}
                          className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Practice</span>
                        </button>
                      </div>
                    </div>

                    {/* Diagram/Graph if present */}
                    {stemGraphUrl && (
                      <div className="my-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-center shadow-2xs">
                        <img
                          src={stemGraphUrl}
                          alt="SAT Diagram"
                          referrerPolicy="no-referrer"
                          className="max-h-60 object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {/* Question Content with MathRenderer / Split Layout */}
                    {(() => {
                      const split = splitPassageAndPrompt(q.question, q.section, q.explanations);
                      if (split.passageText && split.questionPrompt) {
                        return (
                          <div className="space-y-3 my-2 w-full">
                            <div className="text-base text-slate-900 dark:text-slate-100 leading-relaxed font-serif p-3.5 sm:p-4.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 overflow-x-auto min-w-0 w-full">
                              <MathRenderer text={split.passageText} />
                            </div>
                            <div className="text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed font-serif p-3 sm:p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 overflow-x-auto min-w-0 w-full">
                              <MathRenderer text={split.questionPrompt} />
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="text-base text-slate-900 dark:text-slate-100 leading-relaxed font-serif my-2 p-3 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 overflow-x-auto min-w-0 w-full">
                          <MathRenderer text={restoreUnderline(q.question, q.explanations)} />
                        </div>
                      );
                    })()}

                    {/* Choices */}
                    {choices.length > 0 && (
                      <div className="flex flex-col gap-3 pt-1 w-full">
                        {choices.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-3.5 sm:p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center gap-3.5 shadow-2xs w-full"
                          >
                            <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
                              {String.fromCharCode(65 + cIdx)}
                            </span>
                            <span className="flex-1 font-serif text-base text-slate-900 dark:text-slate-100 leading-relaxed overflow-x-auto overflow-y-hidden min-w-0 w-full">
                              <MathRenderer text={c} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Explanation Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        onClick={() =>
                          setExpandedExplanations((prev) => ({ ...prev, [q.question_id]: !prev[q.question_id] }))
                        }
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                      >
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Hide Official Explanation' : 'View Official Explanation'}</span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-slate-800 border border-blue-200 dark:border-blue-900/50 space-y-2 text-xs sm:text-sm font-serif">
                        <p className="font-bold text-slate-900 dark:text-white">
                          Official Answer: <span className="text-emerald-600 dark:text-emerald-400 font-mono text-base ml-1">{q.answers}</span>
                        </p>
                        <MarkdownRenderer content={q.explanations} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setBrowserPage((p) => Math.max(1, p - 1))}
                  disabled={browserPage <= 1}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-mono text-slate-500">
                  Page {browserPage} of {browserTotalPages} ({browserTotal} Qs)
                </span>
                <button
                  onClick={() => setBrowserPage((p) => Math.min(browserTotalPages, p + 1))}
                  disabled={browserPage >= browserTotalPages}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PRACTICE HISTORY & SAVED PAUSED TEST SESSIONS                      */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <PracticeHistoryView
          history={drillHistory}
          savedSessions={savedSessions}
          onResumeSavedTest={handleResumeSavedTest}
          onRetakeTest={(item) => {
            if (item.questionSummaries && item.questionSummaries.length > 0) {
              const rawList: RawSATQuestion[] = item.questionSummaries.map((qs, idx) => ({
                question_id: typeof qs.questionId === 'number' ? qs.questionId : parseInt(String(qs.questionId), 10) || idx + 1,
                question_no: typeof qs.questionNo === 'number' ? qs.questionNo : idx + 1,
                question: qs.passageText ? `${qs.passageText}\n\n${qs.questionPrompt}` : (qs.questionPrompt || ''),
                section: (qs.section || item.section || 'Reading and Writing') as any,
                category: qs.subTopic || '',
                difficulty: typeof qs.difficulty === 'number' ? qs.difficulty : 5,
                answers: qs.correctAnswer || '',
                selections: qs.choices || [],
                explanations: qs.explanation || '',
                graphs: qs.graphData?.croppedGraphUrl ? [qs.graphData.croppedGraphUrl] : [],
                exam_name: item.examName || item.title || 'SAT Practice Test',
                module: 'Module 1',
                question_type: qs.choices && qs.choices.length > 0 ? 'Single Choice' : 'Fill-in-the-Blank / Free Response',
              }));

              const bluebookList: BluebookQuestionItem[] = rawList.map((q, idx) =>
                transformRawToBluebookQuestion(q, idx)
              );

              const isOfficial = item.examType === 'official_full' || item.examType === 'official_section';
              setTestingSession({
                isOpen: true,
                title: `Retake: ${item.title.replace(/^Retake:\s*/, '')}`,
                sectionName: item.section || 'SAT Practice Retake',
                questions: bluebookList,
                rawQuestions: rawList,
                timerSeconds: isOfficial ? 0 : Math.round(bluebookList.length * 75),
                perQuestionTimerSeconds: 0,
                isUntimed: false,
                isOfficialExam: isOfficial,
                instantFeedback: item.presetConfig?.deliveryMode === 'instant_feedback',
                presetConfig: item.presetConfig,
              });
            } else if (item.presetConfig) {
              if (item.presetConfig.section) setBuilderSection(item.presetConfig.section as any);
              if (item.presetConfig.domain) setBuilderDomain(item.presetConfig.domain);
              if (item.presetConfig.module) setBuilderModule(item.presetConfig.module as any);
              if (item.presetConfig.difficultyRange) setBuilderDifficultyRange(item.presetConfig.difficultyRange);
              if (item.presetConfig.type) setBuilderType(item.presetConfig.type as any);
              if (item.presetConfig.timerMode) setBuilderTimerMode(item.presetConfig.timerMode as any);
              if (item.presetConfig.deliveryMode) setBuilderDeliveryMode(item.presetConfig.deliveryMode as any);
              setActiveTab('builder');
            } else if (item.examName && combinedExams.length > 0) {
              const matched = combinedExams.find(c => item.title.includes(c.baseName));
              if (matched) {
                handleStartCombinedExam(matched);
              }
            }
          }}
          onRefreshData={refreshHistoryAndSaved}
        />
      )}

      {/* ========================================================================= */}
      {/* ACTIVE BLUEBOOK TEST SHELL MODAL                                           */}
      {/* ========================================================================= */}
      {testingSession && (
        <BluebookTestShell
          title={testingSession.title}
          sectionName={testingSession.sectionName}
          questions={testingSession.questions}
          rawQuestions={testingSession.rawQuestions}
          timerSeconds={testingSession.timerSeconds}
          perQuestionTimerSeconds={testingSession.perQuestionTimerSeconds}
          isUntimed={testingSession.isUntimed}
          isOfficialExam={testingSession.isOfficialExam}
          instantFeedback={testingSession.instantFeedback}
          initialAnswers={testingSession.initialAnswers}
          initialMarkedForReview={testingSession.initialMarkedForReview}
          initialCurrentIndex={testingSession.initialCurrentIndex}
          initialCurrentModuleIdx={testingSession.initialCurrentModuleIdx}
          initialTimeSpentSeconds={testingSession.initialTimeSpentSeconds}
          initialModuleTimeLeft={testingSession.initialModuleTimeLeft}
          savedSessionId={testingSession.savedSessionId}
          examType={testingSession.examType}
          presetConfig={testingSession.presetConfig}
          onFinishTest={handleFinishTest}
          onSaveAndExit={() => {
            setSavedSessions(getSavedTestSessions());
            setTestingSession(null);
          }}
          onClose={() => setTestingSession(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* POST-TEST COMPREHENSIVE DIAGNOSTIC REPORT MODAL                           */}
      {/* ========================================================================= */}
      {testResults && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header with Digital SAT Score Card */}
            <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-blue-400">
                  <GraduationCap className="w-4 h-4" />
                  <span>Official Digital SAT Score Report</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {testResults.title}
                </h2>
                <p className="text-xs text-slate-300">
                  Adaptive Item Response Theory (IRT) Algorithmic Scaling • {Math.floor(testResults.timeSpentSeconds / 60)}m {testResults.timeSpentSeconds % 60}s Duration
                </p>
              </div>

              {/* Total Scaled Score Badge */}
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/15">
                <div className="text-center pr-4 border-r border-white/15">
                  <span className="text-3xl sm:text-4xl font-black text-white font-mono">
                    {testResults.scoreReport.totalScaledScore}
                  </span>
                  <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
                    Score / {testResults.scoreReport.readingWriting && testResults.scoreReport.math ? '1600' : '800'}
                  </p>
                </div>

                <div className="text-left text-xs space-y-1">
                  <p className="font-bold text-emerald-400 font-mono">
                    {testResults.scoreReport.nationalPercentile}th Percentile
                  </p>
                  <p className="text-slate-300">
                    Readiness: <strong>{testResults.scoreReport.readinessBand}</strong>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {testResults.scoreReport.totalCorrect} / {testResults.scoreReport.totalQuestions} Correct
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body: Scaled Sections, Domain Mastery, & Error Book Actions */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
              {/* Section Scores Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {testResults.scoreReport.readingWriting && (
                  <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-1.5">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      Reading and Writing
                    </span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {testResults.scoreReport.readingWriting.scaledScore} <span className="text-xs text-slate-500 font-sans font-normal">/ 800</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Adaptive route: <strong>{testResults.scoreReport.readingWriting.routedDifficulty}</strong> ({testResults.scoreReport.readingWriting.accuracy}% accuracy)
                    </p>
                  </div>
                )}

                {testResults.scoreReport.math && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Math Section
                    </span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {testResults.scoreReport.math.scaledScore} <span className="text-xs text-slate-500 font-sans font-normal">/ 800</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Adaptive route: <strong>{testResults.scoreReport.math.routedDifficulty}</strong> ({testResults.scoreReport.math.accuracy}% accuracy)
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Pacing Efficiency
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {Math.round(testResults.timeSpentSeconds / testResults.scoreReport.totalQuestions)}s
                  </p>
                  <p className="text-xs text-slate-500">Average time per question</p>
                </div>
              </div>

              {/* BATCH SAVE TO ERROR BOOK BANNER */}
              {testResults.scoreReport.totalIncorrect > 0 && (
                <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-indigo-700/50">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center shrink-0 text-indigo-300">
                      <BookmarkPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        Sync {testResults.scoreReport.totalIncorrect} Missed Questions to Error Book
                      </h4>
                      <p className="text-xs text-slate-300">
                        Automatically saves questions with your answers and full KaTeX math explanations for spaced-repetition flashcard drills.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAllMissedToErrorBook}
                    disabled={savingAllMissed || savedAllMissedSuccess}
                    className="px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {savedAllMissedSuccess ? (
                      <span className="flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Added to Error Book
                      </span>
                    ) : savingAllMissed ? (
                      'Saving to Error Book...'
                    ) : (
                      'Save All Missed to Error Book'
                    )}
                  </button>
                </div>
              )}

              {/* AI DIAGNOSTICS */}
              {testResults.scoreReport.aiDiagnostics && testResults.scoreReport.aiDiagnostics.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Algorithmic Diagnostic Takeaways</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-serif">
                    {testResults.scoreReport.aiDiagnostics.map((diag, dIdx) => (
                      <li key={dIdx} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>{diag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* DOMAIN MASTERY ANALYSIS */}
              {testResults.scoreReport.allDomains && testResults.scoreReport.allDomains.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Skill & Domain Mastery Breakdown</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {testResults.scoreReport.allDomains.map((domain) => (
                      <div
                        key={domain.domain}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200">{domain.domain}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              domain.percentage >= 85
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : domain.percentage >= 65
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {domain.percentage >= 85 ? 'Mastered' : domain.percentage >= 65 ? 'Proficient' : 'Needs Practice'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              domain.percentage >= 85
                                ? 'bg-emerald-500'
                                : domain.percentage >= 65
                                ? 'bg-blue-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${domain.percentage}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                          <span>{domain.correct} / {domain.total} Correct</span>
                          <span>{domain.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DETAILED QUESTION REVIEW LIST */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Detailed Item Review
                </h3>

                <div className="space-y-4">
                  {testResults.bluebookQuestions.map((q, idx) => {
                    const raw = testResults.rawQuestions[idx];
                    const userAns = testResults.userAnswers[idx] || '(Blank)';
                    const correctAns = q.correctAnswer || raw?.answers || '';
                    const isCorrect = evaluateSATQuestionAnswer(userAns, correctAns, q.choices || raw?.selections || []);
                    const isAdded = !!addedToErrorBook[raw?.question_id || idx];

                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-3xl border space-y-3 ${
                          isCorrect
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                            : 'border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {raw?.section} • {raw?.module || `Module ${idx < 27 ? '1' : '2'}`}
                            </span>
                            {raw?.difficulty && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-bold font-mono">
                                Diff: {raw.difficulty}/10
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-slate-500">
                                Your: <strong className={isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>{userAns}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                Correct: <strong className="text-emerald-700 dark:text-emerald-300">{correctAns}</strong>
                              </span>
                            </div>

                            {raw && (
                              <button
                                onClick={() => handleOpenJsonEditor(raw)}
                                className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Manually edit math formulas and content in all_questions.json"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit in JSON</span>
                              </button>
                            )}

                            {/* AI Generate Answer Analysis Button */}
                            <button
                              onClick={() => handleGenerateAiAnalysis(idx)}
                              disabled={loadingAiAnalysis[idx]}
                              className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                aiAnalyses[idx]
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200'
                                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                              }`}
                              title="Generate comprehensive AI Answer Analysis & Strategy"
                            >
                              {loadingAiAnalysis[idx] ? (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                  <span>Analyzing...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>{aiAnalyses[idx] ? 'AI Analysis' : 'AI Analysis'}</span>
                                </>
                              )}
                            </button>

                            {!isCorrect && raw && (
                              <button
                                onClick={() => handleAddToErrorBook(raw, userAns)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {isAdded ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                                <span>{isAdded ? 'Added' : 'Add to Error Book'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Passage stimulus if present */}
                        {q.passageText && (
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 font-serif leading-relaxed">
                            <MathRenderer text={q.passageText} />
                          </div>
                        )}

                        {/* Question Stem with MathRenderer */}
                        <div className="text-sm sm:text-base text-slate-900 dark:text-slate-100 font-serif leading-relaxed overflow-x-auto min-w-0">
                          <MathRenderer text={q.questionPrompt || raw?.question || ''} />
                        </div>

                        {/* Choices */}
                        {q.choices && q.choices.length > 0 && (
                          <div className="flex flex-col gap-2.5 pt-1">
                            {q.choices.map((c, cIdx) => {
                              const choiceLetter = String.fromCharCode(65 + cIdx);
                              const isChoiceCorrect = correctAns.toUpperCase() === choiceLetter;
                              const isChoiceUser = userAns.toUpperCase() === choiceLetter;

                              return (
                                <div
                                  key={cIdx}
                                  className={`p-3.5 sm:p-4 rounded-xl border flex items-center gap-3.5 transition-colors ${
                                    isChoiceCorrect
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold shadow-xs ring-1 ring-emerald-500/30'
                                      : isChoiceUser
                                      ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 line-through ring-1 ring-rose-400/30'
                                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${
                                    isChoiceCorrect
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : isChoiceUser
                                      ? 'bg-rose-600 text-white border-rose-600'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                  }`}>
                                    {choiceLetter}
                                  </span>
                                  <span className="flex-1 font-serif text-sm leading-relaxed overflow-x-auto min-w-0">
                                    <MathRenderer text={c} />
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation with MathRenderer */}
                        {(q.explanation || raw?.explanations) && (
                          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-1.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                              Detailed Solution & Analysis:
                            </span>
                            <div className="text-xs text-slate-700 dark:text-slate-300 font-serif leading-relaxed">
                              <MarkdownRenderer content={q.explanation || raw?.explanations || ''} />
                            </div>
                          </div>
                        )}

                        {/* AI Deep Answer Analysis Card */}
                        {aiAnalyses[idx] && (
                          <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-200">
                                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span>AI Comprehensive Answer Analysis & Strategy</span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(aiAnalyses[idx]);
                                  alert('AI Analysis copied to clipboard!');
                                }}
                                className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                              >
                                Copy Analysis
                              </button>
                            </div>
                            <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                              <MarkdownRenderer content={aiAnalyses[idx]} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setTestResults(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-extrabold cursor-pointer"
              >
                Close Score Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SAVE CUSTOM PRESET MODAL                                                  */}
      {/* ========================================================================= */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Save className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Save Practice Preset
                  </h3>
                  <p className="text-xs text-slate-500">
                    Save this custom filter combination for quick 1-click access.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Preset Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                  placeholder="e.g., Hard Words in Context Blitz"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="e.g., Focus on Module 2 vocabulary questions (Difficulty 6-10)"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Current Configuration Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Configuration to save:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <div>• Section: <strong className="text-slate-800 dark:text-slate-200">{builderSection}</strong></div>
                  <div>• Domain: <strong className="text-slate-800 dark:text-slate-200 truncate">{builderDomain}</strong></div>
                  <div>• Difficulty: <strong className="text-slate-800 dark:text-slate-200">{builderDifficultyRange[0]} - {builderDifficultyRange[1]}</strong></div>
                  <div>• Questions: <strong className="text-slate-800 dark:text-slate-200">{builderCount} Qs</strong></div>
                  <div>• Timer: <strong className="text-slate-800 dark:text-slate-200">{builderTimerMode}</strong></div>
                  <div>• Delivery: <strong className="text-slate-800 dark:text-slate-200">{builderDeliveryMode === 'instant_feedback' ? 'Instant Feedback' : 'Exam'}</strong></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentAsPreset}
                disabled={!newPresetTitle.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRACTICE DRILL HISTORY MODAL                                              */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Practice Drill History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review and re-attempt your previous custom practice drills.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {drillHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear your practice drill history?')) {
                        clearPracticeHistory();
                        setDrillHistory([]);
                      }
                    }}
                    className="text-xs text-rose-500 hover:text-rose-600 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {drillHistory.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No Practice Drills Completed Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Assemble a practice drill in the builder and complete it to track your performance history here.
                  </p>
                </div>
              ) : (
                drillHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.completedAt).toLocaleDateString()} at{' '}
                          {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                          {item.section}
                        </span>
                        {item.domain && item.domain !== 'All' && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                            {item.domain}
                          </span>
                        )}
                        <span className="text-slate-500">
                          {item.questionCount} Questions • {Math.round(item.timeSpentSeconds / 60)}m spent
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {typeof item.score === 'number' && (
                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {item.score} / {item.questionCount}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.percentage}% accuracy
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (item.presetConfig) {
                            setBuilderSection(item.presetConfig.section || 'All');
                            setBuilderDomain(item.presetConfig.domain || 'All');
                            setBuilderModule(item.presetConfig.module || 'All');
                            if (item.presetConfig.difficultyRange) {
                              setBuilderDifficultyRange(item.presetConfig.difficultyRange);
                            }
                            if (item.presetConfig.type) setBuilderType(item.presetConfig.type);
                            if (item.presetConfig.timerMode) setBuilderTimerMode(item.presetConfig.timerMode);
                            if (item.presetConfig.deliveryMode) setBuilderDeliveryMode(item.presetConfig.deliveryMode);
                            setShowHistoryModal(false);
                            setActiveTab('builder');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Load configuration into builder"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Re-load</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-extrabold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual JSON & Math Editor Modal */}
      <QuestionJsonEditModal
        isOpen={showJsonEditor}
        question={editingJsonQuestion}
        onClose={() => {
          setShowJsonEditor(false);
          setEditingJsonQuestion(null);
        }}
        onSaved={handleJsonQuestionSaved}
      />
    </div>
  );
}
