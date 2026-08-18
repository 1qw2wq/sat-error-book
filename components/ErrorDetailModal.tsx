'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  Trash2,
  Edit3,
  Save,
  Calendar,
  ImageIcon,
  Award,
  Clock,
  BookMarked,
  Plus,
  Eye,
  EyeOff,
  Type,
  Underline as UnderlineIcon,
  Bold as BoldIcon,
  Calculator,
  RotateCcw,
  Crop,
} from 'lucide-react';
import { SATErrorItem, MasteryStatus, MistakeType, SATSubject, AnswerChoice, GraphData } from '@/types/sat';
import { saveError, deleteError } from '@/lib/db';
import MathRenderer from './MathRenderer';
import GraphRenderer from './GraphRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import AddVocabModal from './AddVocabModal';
import ImageCropModal from './ImageCropModal';

interface ErrorDetailModalProps {
  item: SATErrorItem | null;
  onClose: () => void;
  onUpdated: () => void;
  initialEditMode?: boolean;
}

const MATH_SUBTOPICS = [
  'Algebra',
  'Advanced Math',
  'Problem-Solving & Data Analysis',
  'Geometry & Trigonometry',
  'General',
];

const RW_SUBTOPICS = [
  'Information & Ideas',
  'Craft & Structure',
  'Expression of Ideas',
  'Standard English Conventions',
  'General',
];

export default function ErrorDetailModal({
  item,
  onClose,
  onUpdated,
  initialEditMode = false,
}: ErrorDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isAddVocabOpen, setIsAddVocabOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Form states for full question & analysis editing
  const [subject, setSubject] = useState<SATSubject>(item?.subject || 'Math');
  const [subTopic, setSubTopic] = useState<string>(item?.subTopic || 'Algebra');
  const [questionText, setQuestionText] = useState<string>(item?.questionText || '');
  const [answerChoices, setAnswerChoices] = useState<AnswerChoice[]>(item?.answerChoices || []);
  const [correctAnswer, setCorrectAnswer] = useState<string>(item?.correctAnswer || 'A');
  const [aiTakeaway, setAiTakeaway] = useState<string>(item?.aiTakeaway || '');
  const [explanation, setExplanation] = useState<string>(item?.explanation || '');
  const [userNotes, setUserNotes] = useState<string>(item?.userNotes || '');
  const [mistakeType, setMistakeType] = useState<MistakeType>(item?.mistakeType || 'Careless Error');
  const [masteryStatus, setMasteryStatus] = useState<MasteryStatus>(item?.masteryStatus || 'Confused');
  const [testSource, setTestSource] = useState<string>(item?.testSource || '');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>(item?.difficulty || 'Medium');
  const [graphData, setGraphData] = useState<GraphData | undefined>(item?.graphData);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isGeneratingAiAnalysis, setIsGeneratingAiAnalysis] = useState(false);
  const [generatedAiAnalysis, setGeneratedAiAnalysis] = useState<string | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  if (!item) return null;

  const handleGenerateAiAnalysis = async () => {
    setIsGeneratingAiAnalysis(true);
    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionText || item.questionText,
          passageText: item.passageText || '',
          choices: answerChoices.length > 0 ? answerChoices : item.answerChoices,
          correctAnswer: correctAnswer || item.correctAnswer,
          explanation: explanation || item.explanation,
          aiTakeaway: aiTakeaway || item.aiTakeaway,
          subject: subject || item.subject,
          subTopic: subTopic || item.subTopic,
          mode: 'answer_analysis',
        }),
      });

      const data = await res.json();
      if (data.text) {
        setGeneratedAiAnalysis(data.text);
      } else {
        alert(data.error || 'Failed to generate AI analysis.');
      }
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      alert('Error connecting to AI analysis service.');
    } finally {
      setIsGeneratingAiAnalysis(false);
    }
  };

  const handleApplyAnalysisToFields = async () => {
    if (!generatedAiAnalysis) return;
    setExplanation(generatedAiAnalysis);
    const updated: SATErrorItem = {
      ...item,
      explanation: generatedAiAnalysis,
    };
    await saveError(updated);
    onUpdated();
    alert('AI Analysis successfully applied to question solution and saved!');
  };

  const imagesList =
    item.imageDataUrls && item.imageDataUrls.length > 0
      ? item.imageDataUrls
      : item.imageDataUrl
      ? [item.imageDataUrl]
      : [];

  const handleInsertFormatting = (prefix: string, suffix: string, defaultText = 'text') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = questionText;
    const selected = currentText.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;
    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    setQuestionText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleAddChoice = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const currentLabels = answerChoices.map((c) => c.label.toUpperCase());
    const nextLetter = letters.find((l) => !currentLabels.includes(l)) || `Option ${answerChoices.length + 1}`;
    setAnswerChoices([...answerChoices, { label: nextLetter, text: '' }]);
  };

  const handleRemoveChoice = (index: number) => {
    const updated = answerChoices.filter((_, idx) => idx !== index);
    setAnswerChoices(updated);
  };

  const handleChoiceTextChange = (index: number, text: string) => {
    const updated = [...answerChoices];
    updated[index] = { ...updated[index], text };
    setAnswerChoices(updated);
  };

  const handleChoiceLabelChange = (index: number, label: string) => {
    const updated = [...answerChoices];
    updated[index] = { ...updated[index], label };
    setAnswerChoices(updated);
  };

  const handleSaveEdits = async () => {
    const updated: SATErrorItem = {
      ...item,
      subject,
      subTopic: subTopic.trim() || 'General',
      questionText: questionText.trim(),
      answerChoices,
      correctAnswer: correctAnswer.trim(),
      aiTakeaway: aiTakeaway.trim(),
      explanation: explanation.trim(),
      userNotes: userNotes.trim(),
      mistakeType,
      masteryStatus,
      testSource: testSource.trim(),
      difficulty,
      graphData,
    };
    await saveError(updated);
    setIsEditing(false);
    onUpdated();
  };

  const handleDirectCropSave = async (
    croppedDataUrl: string,
    box2d: [number, number, number, number] | number[],
    imageIndex: number
  ) => {
    const newGraphData: GraphData = {
      hasGraph: true,
      croppedGraphUrl: croppedDataUrl,
      box2d,
      imageIndex,
      title: graphData?.title || 'Cropped Figure',
      graphType: graphData?.graphType || 'diagram',
    };

    setGraphData(newGraphData);

    // If not editing, save directly to database
    if (!isEditing) {
      const updated: SATErrorItem = {
        ...item,
        graphData: newGraphData,
      };
      await saveError(updated);
      onUpdated();
    }
  };

  const handleRemoveCrop = async () => {
    setGraphData(undefined);
    if (!isEditing) {
      const updated: SATErrorItem = {
        ...item,
        graphData: undefined,
      };
      await saveError(updated);
      onUpdated();
    }
  };

  const handleDeleteConfirm = async () => {
    await deleteError(item.id);
    onClose();
    onUpdated();
  };

  const subtopicOptions = subject === 'Math' ? MATH_SUBTOPICS : RW_SUBTOPICS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                (isEditing ? subject : item.subject) === 'Math'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
              }`}
            >
              {isEditing ? subject : item.subject}
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isEditing ? subTopic : item.subTopic}
            </span>
            {isEditing && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[11px] font-bold">
                Editing Question
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsAddVocabOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200/50 dark:border-indigo-800/50 text-xs font-bold transition-colors"
                title="Add a vocabulary word from this question"
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Vocab</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  // Reset form to current item state
                  setSubject(item.subject);
                  setSubTopic(item.subTopic);
                  setQuestionText(item.questionText);
                  setAnswerChoices(item.answerChoices || []);
                  setCorrectAnswer(item.correctAnswer || 'A');
                  setAiTakeaway(item.aiTakeaway || '');
                  setExplanation(item.explanation || '');
                  setUserNotes(item.userNotes || '');
                  setMistakeType(item.mistakeType || 'Careless Error');
                  setMasteryStatus(item.masteryStatus || 'Confused');
                  setTestSource(item.testSource || '');
                  setDifficulty(item.difficulty || 'Medium');
                }
                setIsEditing(!isEditing);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isEditing
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/60'
              }`}
              title={isEditing ? 'Cancel Editing' : 'Modify Question, Choices, or Error Details'}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel' : 'Edit Question'}</span>
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={handleSaveEdits}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            )}

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
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* EDIT MODE */}
          {isEditing ? (
            <div className="space-y-6">
              {/* Subject, Topic & Difficulty Selection */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      SAT Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => {
                        const newSub = e.target.value as SATSubject;
                        setSubject(newSub);
                        setSubTopic(newSub === 'Math' ? MATH_SUBTOPICS[0] : RW_SUBTOPICS[0]);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Math">Math</option>
                      <option value="Reading & Writing">Reading & Writing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Sub-Topic
                    </label>
                    <div className="space-y-1.5">
                      <select
                        value={subtopicOptions.includes(subTopic) ? subTopic : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            setSubTopic(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                      >
                        {subtopicOptions.map((top) => (
                          <option key={top} value={top}>
                            {top}
                          </option>
                        ))}
                        <option value="custom">Custom topic...</option>
                      </select>
                      {(!subtopicOptions.includes(subTopic) || subTopic === 'custom') && (
                        <input
                          type="text"
                          value={subTopic}
                          onChange={(e) => setSubTopic(e.target.value)}
                          placeholder="Enter custom topic..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Question Text & Formatting Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-blue-500" />
                    Question Text & Passage
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Quick Formatting Toolbar */}
                    <button
                      type="button"
                      onClick={() => handleInsertFormatting('**', '**', 'bold word')}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
                      title="Insert bold text (**word**)"
                    >
                      <BoldIcon className="w-3 h-3" />
                      <span>Bold</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInsertFormatting('<u>', '</u>', 'underlined sentence')}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
                      title="Insert underlined sentence (<u>sentence</u>)"
                    >
                      <UnderlineIcon className="w-3 h-3" />
                      <span>Underline</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInsertFormatting('$', '$', 'f(x) = 2x + 1')}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
                      title="Insert LaTeX formula ($x^2$)"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>Math</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInsertFormatting('$\\frac{', '}{b}$', 'a')}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                      title="Insert fraction (\\frac{a}{b})"
                    >
                      <span>Fraction</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${
                        previewMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {previewMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{previewMode ? 'Edit' : 'Preview'}</span>
                    </button>
                  </div>
                </div>

                {previewMode ? (
                  <div className="min-h-[140px] p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-blue-400 dark:border-blue-500/50 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                      Live Formatted Preview (KaTeX Math, Bold & Underline):
                    </span>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                      <MarkdownRenderer content={questionText || '*(No question text entered)*'} />
                    </div>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={6}
                    placeholder="Enter full question passage and prompt... (Use **bold** for bold, <u>sentence</u> for underlines, and $latex$ for math formulas)"
                    className="w-full p-3.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}
              </div>

              {/* Answer Choices Editor */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Answer Choices & Correct Answer
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select the radio button next to the correct answer choice.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddChoice}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Choice</span>
                    </button>
                  </div>
                </div>

                {answerChoices.length > 0 ? (
                  <div className="space-y-2.5">
                    {answerChoices.map((choice, idx) => {
                      const isSelectedCorrect = choice.label.toUpperCase() === correctAnswer.toUpperCase();
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                            isSelectedCorrect
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {/* Radio button to designate correct choice */}
                          <button
                            type="button"
                            onClick={() => setCorrectAnswer(choice.label)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelectedCorrect
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                            }`}
                            title="Mark as correct answer"
                          >
                            {isSelectedCorrect && <Check className="w-3 h-3" />}
                          </button>

                          {/* Choice Label */}
                          <input
                            type="text"
                            value={choice.label}
                            onChange={(e) => handleChoiceLabelChange(idx, e.target.value)}
                            className="w-8 text-center font-bold text-xs py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                          />

                          {/* Choice Text Input */}
                          <input
                            type="text"
                            value={choice.text}
                            onChange={(e) => handleChoiceTextChange(idx, e.target.value)}
                            placeholder={`Choice ${choice.label} text or formula...`}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />

                          {isSelectedCorrect && (
                            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                              Correct
                            </span>
                          )}

                          {/* Delete choice */}
                          <button
                            type="button"
                            onClick={() => handleRemoveChoice(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove choice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                    <p className="font-semibold">Student-Produced (Grid-In) Math Question</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">Numeric Correct Answer:</span>
                      <input
                        type="text"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                        placeholder="e.g. 42 or 3/4"
                        className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* AI Takeaway & Explanation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Analysis & Solutions
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateAiAnalysis}
                    disabled={isGeneratingAiAnalysis}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAiAnalysis ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAiAnalysis ? 'Generating AI Analysis...' : 'Generate AI Answer Analysis'}</span>
                  </button>
                </div>

                {generatedAiAnalysis && (
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        AI Generated Analysis & Trap Breakdown
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedAiAnalysis);
                            alert('Copied to clipboard!');
                          }}
                          className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAnalysisToFields}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 cursor-pointer shadow-xs"
                        >
                          Apply to Solution
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                      <MarkdownRenderer content={generatedAiAnalysis} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    AI Active Recall Takeaway
                  </label>
                  <textarea
                    value={aiTakeaway}
                    onChange={(e) => setAiTakeaway(e.target.value)}
                    rows={2}
                    placeholder="Short 2-sentence key takeaway or rule..."
                    className="w-full p-3 text-xs rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Step-by-Step Explanation
                  </label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    rows={4}
                    placeholder="Full step-by-step solution..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Mistake Category, Mastery Status, Test Source, Personal Note */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mastery Status
                    </label>
                    <select
                      value={masteryStatus}
                      onChange={(e) => setMasteryStatus(e.target.value as MasteryStatus)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="Confused">Confused 🔴</option>
                      <option value="Learning">Learning 🟡</option>
                      <option value="Mastered">Mastered 🟢</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mistake Category
                    </label>
                    <select
                      value={mistakeType}
                      onChange={(e) => setMistakeType(e.target.value as MistakeType)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
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
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Test Source
                    </label>
                    <input
                      type="text"
                      value={testSource}
                      onChange={(e) => setTestSource(e.target.value)}
                      placeholder="e.g. Bluebook Practice Test 1"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Personal Study Note
                  </label>
                  <input
                    type="text"
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Add personal reflections, reminders, or tricky points..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Edit Mode: Diagram Crop Controls */}
              {imagesList.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Crop className="w-3.5 h-3.5 text-blue-500" />
                      Question Diagram / Coordinate Graph
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCropModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>{graphData?.hasGraph ? 'Adjust Crop' : '+ Crop Diagram'}</span>
                    </button>
                  </div>

                  {graphData && graphData.hasGraph ? (
                    <div className="space-y-2">
                      <GraphRenderer
                        graphData={graphData}
                        imageDataUrl={item.imageDataUrl}
                        imageDataUrls={imagesList}
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setGraphData(undefined)}
                          className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Cropped Diagram</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No diagram cropped. Markdown tables are preserved as text. If there is a geometry figure or coordinate graph in your screenshot, click &quot;+ Crop Diagram&quot; to crop it.
                    </p>
                  )}
                </div>
              )}

              {/* Save & Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            /* READ / DETAIL MODE */
            <>
              {/* Screenshot image(s) if available */}
              {imagesList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Original Screenshot{imagesList.length > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCropModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                      title="Adjust or create diagram crop"
                    >
                      <Crop className="w-3 h-3 text-blue-500" />
                      <span>{graphData?.hasGraph ? 'Adjust Diagram Crop' : 'Crop Diagram'}</span>
                    </button>
                  </div>

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
              {graphData && graphData.hasGraph && (
                <div className="space-y-1.5">
                  <GraphRenderer
                    graphData={graphData}
                    imageDataUrl={item.imageDataUrl}
                    imageDataUrls={item.imageDataUrls}
                  />
                  <div className="flex items-center justify-end gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => setIsCropModalOpen(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Crop className="w-3 h-3" />
                      <span>Adjust Crop</span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleRemoveCrop}
                      className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Diagram</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Question text */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                    Question Text & Prompt
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                  <MarkdownRenderer content={item.questionText} />
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
                          <span className="flex-1">
                            <MarkdownRenderer content={choice.text} />
                          </span>
                          {isCorrect && (
                            <span className="ml-auto text-[10px] uppercase font-extrabold text-emerald-600">
                              (Correct)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Generator Action in Read Mode */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-900/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                    Need deeper breakdown or College Board trap analysis?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAiAnalysis}
                  disabled={isGeneratingAiAnalysis}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAiAnalysis ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAiAnalysis ? 'Analyzing...' : 'Generate AI Answer Analysis'}</span>
                </button>
              </div>

              {/* Generated AI Analysis in Read Mode */}
              {generatedAiAnalysis && (
                <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>AI Comprehensive Answer Analysis & Strategy</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAiAnalysis);
                          alert('Copied to clipboard!');
                        }}
                        className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                      >
                        Copy Analysis
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyAnalysisToFields}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 cursor-pointer shadow-xs"
                      >
                        Save to Question
                      </button>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    <MarkdownRenderer content={generatedAiAnalysis} />
                  </div>
                </div>
              )}

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

              {/* Read-Only Status & Note Details */}
              <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300 block font-medium">
                    Personal Note: {item.userNotes ? `"${item.userNotes}"` : 'None added'}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 block">
                    Mistake Type: <strong className="text-slate-800 dark:text-slate-200">{item.mistakeType}</strong> • Source:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{item.testSource || 'N/A'}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors"
                    title="Modify Question & Error Log"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
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

      {isCropModalOpen && imagesList.length > 0 && (
        <ImageCropModal
          images={imagesList}
          initialBox2d={graphData?.box2d}
          initialImageIndex={graphData?.imageIndex ?? selectedImageIndex}
          onClose={() => setIsCropModalOpen(false)}
          onSaveCrop={(croppedDataUrl, box2d, imgIndex) => {
            handleDirectCropSave(croppedDataUrl, box2d, imgIndex);
            setIsCropModalOpen(false);
          }}
          onRemoveCrop={() => {
            handleRemoveCrop();
          }}
        />
      )}
    </div>
  );
}
