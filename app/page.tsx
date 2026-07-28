'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Dashboard from '@/components/Dashboard';
import FlashcardEngine from '@/components/FlashcardEngine';
import ErrorListTable from '@/components/ErrorListTable';
import QuickReviewModal from '@/components/QuickReviewModal';
import ErrorDetailModal from '@/components/ErrorDetailModal';
import UploadModal from '@/components/UploadModal';
import VocabBank from '@/components/VocabBank';
import ErrorQuizModal from '@/components/ErrorQuizModal';
import { getAllErrors, getUserStats, getAllVocab } from '@/lib/db';
import { SATErrorItem, UserStats, VocabItem } from '@/types/sat';
import { Sparkles, Brain } from 'lucide-react';

export default function HomePage() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'review' | 'vocab' | 'directory'>('dashboard');
  const [errors, setErrors] = useState<SATErrorItem[]>([]);
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [stats, setStats] = useState<UserStats>({
    id: 'default_user',
    streakDays: 1,
    lastStudyDate: new Date().toISOString().split('T')[0],
    totalLogged: 0,
    totalMastered: 0,
    totalReviewsCompleted: 0,
    studyDates: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Auto-log modal state
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [pastedImages, setPastedImages] = useState<string[] | null>(null);
  const [pastedMime, setPastedMime] = useState<string>('image/png');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Single error detail modal & Error practice quiz modal
  const [selectedItem, setSelectedItem] = useState<SATErrorItem | null>(null);
  const [isErrorQuizOpen, setIsErrorQuizOpen] = useState(false);

  // Review Filter Override from Dashboard quick launch buttons
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<string>('All');
  const [reviewMasteryFilter, setReviewMasteryFilter] = useState<string>('ConfusedOrDue');

  const refreshData = async () => {
    try {
      const allErr = await getAllErrors();
      const currentStats = await getUserStats();
      const allVocab = await getAllVocab();
      setErrors(allErr);
      setStats(currentStats);
      setVocabList(allVocab);
    } catch (err) {
      console.error('Error fetching data from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const allErr = await getAllErrors();
        const currentStats = await getUserStats();
        const allVocab = await getAllVocab();
        if (!ignore) {
          setErrors(allErr);
          setStats(currentStats);
          setVocabList(allVocab);
        }
      } catch (err) {
        console.error('Error fetching data from IndexedDB:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  // Launch review session with custom filter preset
  const handleStartReview = (subjectFilter?: string, masteryFilter?: string) => {
    if (subjectFilter) setReviewSubjectFilter(subjectFilter);
    if (masteryFilter) setReviewMasteryFilter(masteryFilter);
    setCurrentTab('review');
  };

  // Called when image is pasted, dropped, or selected
  const handleImageReady = (dataUrl: string, mimeType: string) => {
    setPastedImage(dataUrl);
    setPastedImages([dataUrl]);
    setPastedMime(mimeType);
  };

  const handleImagesReady = (dataUrls: string[], mimeType: string = 'image/png') => {
    if (dataUrls.length > 0) {
      setPastedImage(dataUrls[0]);
      setPastedImages(dataUrls);
      setPastedMime(mimeType);
    }
  };

  // Due for review count calculation
  const now = new Date().getTime();
  const dueCount = errors.filter(
    (e) =>
      e.masteryStatus === 'Confused' ||
      e.masteryStatus === 'Learning' ||
      new Date(e.nextReviewDate).getTime() <= now
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        stats={stats}
        dueCount={dueCount}
        vocabCount={vocabList.length}
        onOpenUploader={() => {
          setIsUploadModalOpen(true);
        }}
      />

      {/* Main Body View */}
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Brain className="w-8 h-8 animate-pulse text-blue-500" />
            <p className="text-sm font-medium">Loading SAT Error Book Database...</p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <Dashboard
                errors={errors}
                stats={stats}
                onStartReview={handleStartReview}
                onStartErrorTest={() => setIsErrorQuizOpen(true)}
                onImageReady={handleImageReady}
                onImagesReady={handleImagesReady}
              />
            )}

            {currentTab === 'review' && (
              <FlashcardEngine
                errors={errors}
                onReviewCompleted={(updatedItem) => {
                  refreshData();
                }}
                onExitReview={() => setCurrentTab('dashboard')}
              />
            )}

            {currentTab === 'vocab' && (
              <VocabBank vocabList={vocabList} onRefreshVocab={refreshData} />
            )}

            {currentTab === 'directory' && (
              <ErrorListTable
                errors={errors}
                onSelectError={(item) => setSelectedItem(item)}
                onRefreshData={refreshData}
                onStartErrorTest={() => setIsErrorQuizOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">
            SAT Error Book — AI Auto-Extraction & Active Recall Spaced Repetition System
          </p>
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Powered by Gemini Vision</span>
          </div>
        </div>
      </footer>

      {/* Upload/Paste Screenshot Modal */}
      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onImageReady={(dataUrl, mimeType) => {
            setIsUploadModalOpen(false);
            handleImageReady(dataUrl, mimeType || 'image/png');
          }}
          onImagesReady={(dataUrls, mimeType) => {
            setIsUploadModalOpen(false);
            handleImagesReady(dataUrls, mimeType || 'image/png');
          }}
        />
      )}

      {/* Auto-Log Quick Review Modal (Triggers when image pasted/uploaded) */}
      {(pastedImage || (pastedImages && pastedImages.length > 0)) && (
        <QuickReviewModal
          imageDataUrl={pastedImage}
          imageDataUrls={pastedImages || undefined}
          mimeType={pastedMime}
          onClose={() => {
            setPastedImage(null);
            setPastedImages(null);
          }}
          onSaved={(newItem) => {
            setPastedImage(null);
            setPastedImages(null);
            refreshData();
          }}
        />
      )}

      {/* Error Detail Modal (Triggers when clicking error card in Directory) */}
      {selectedItem && (
        <ErrorDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={() => {
            refreshData();
            setSelectedItem(null);
          }}
        />
      )}

      {/* Error Practice Test Quiz Modal */}
      {isErrorQuizOpen && (
        <ErrorQuizModal
          errors={errors}
          onClose={() => setIsErrorQuizOpen(false)}
          onRefreshData={refreshData}
        />
      )}
    </div>
  );
}
