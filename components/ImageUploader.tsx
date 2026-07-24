'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Clipboard, Image as ImageIcon, Sparkles, FileCode, CheckCircle2 } from 'lucide-react';

interface ImageUploaderProps {
  onImageReady?: (dataUrl: string, mimeType: string, userHint?: string) => void;
  onImagesReady?: (dataUrls: string[], mimeType?: string) => void;
}

export default function ImageUploader({ onImageReady, onImagesReady }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pasteNotification, setPasteNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerReady = React.useCallback((urls: string[], mime: string = 'image/png') => {
    if (onImagesReady) {
      onImagesReady(urls, mime);
    } else if (onImageReady && urls.length > 0) {
      onImageReady(urls[0], mime);
    }
  }, [onImageReady, onImagesReady]);

  // Sample screenshots generated via Canvas for instant user demo testing!
  const generateSampleScreenshot = (type: 'math-algebra' | 'reading-craft' | 'writing-grammar') => {
    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar mimicking College Board Bluebook
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    if (type === 'math-algebra') {
      ctx.fillText('Digital SAT — Section 2: Math', 20, 28);
    } else {
      ctx.fillText('Digital SAT — Section 1: Reading & Writing', 20, 28);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('Question 14 of 22', canvas.width - 120, 28);

    // Divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(canvas.width, 45);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '16px sans-serif';

    if (type === 'math-algebra') {
      ctx.fillText('Line k in the xy-plane is defined by the equation 3x + 4y = 24.', 40, 100);
      ctx.fillText('Line m is perpendicular to line k and passes through the point (2, -1).', 40, 130);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Which equation defines line m?', 40, 170);

      // Choices
      ctx.font = '15px sans-serif';
      ctx.fillText('A) y = (4/3)x - 11/3', 60, 220);
      ctx.fillText('B) y = (-3/4)x + 1/2', 60, 260);
      ctx.fillText('C) y = (3/4)x - 5/2', 60, 300);
      ctx.fillText('D) y = (-4/3)x + 5/3', 60, 340);
    } else if (type === 'reading-craft') {
      ctx.fillText('Text 1:', 40, 85);
      ctx.font = '14px sans-serif';
      ctx.fillText('Architectural historians often laud mid-century modern design for its minimalist', 40, 110);
      ctx.fillText('functionalism, arguing that form should strictly follow structural necessity.', 40, 132);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Text 2:', 40, 165);
      ctx.font = '14px sans-serif';
      ctx.fillText('Recent bio-centric architectural movements suggest that pure functionalism risks', 40, 190);
      ctx.fillText('alienating human occupants from natural spatial rhythms.', 40, 212);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Based on Text 2, the author would most likely critique Text 1\'s view as—', 40, 255);

      ctx.font = '14px sans-serif';
      ctx.fillText('A) Overestimating the environmental durability of synthetic building composites.', 60, 290);
      ctx.fillText('B) Neglecting psychological wellbeing in favor of rigid physical utility.', 60, 320);
      ctx.fillText('C) Misinterpreting historical precedents set by 19th-century artisans.', 60, 350);
      ctx.fillText('D) Underestimating the economic savings associated with modular prefabricated units.', 60, 380);
    } else {
      ctx.fillText('In 1928, chemist Alexander Fleming discovered penicillin by accident when mold', 40, 100);
      ctx.fillText('contaminated a petridish of Staphylococcus bacteria. Fleming noticed that the bacterial', 40, 125);
      ctx.fillText('colonies surrounding the fungus _______ ruined.', 40, 150);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Which choice completes the text so that it conforms to the conventions of Standard English?', 40, 195);

      ctx.font = '15px sans-serif';
      ctx.fillText('A) had been completely', 60, 245);
      ctx.fillText('B) having been completely', 60, 285);
      ctx.fillText('C) was being completely', 60, 325);
      ctx.fillText('D) to have been completely', 60, 365);
    }

    const dataUrl = canvas.toDataURL('image/png');
    triggerReady([dataUrl], 'image/png');
  };

  // Process file upload
  const handleFilesChange = React.useCallback((files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f && f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    const urls: string[] = [];
    let processed = 0;

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          urls.push(dataUrl);
        }
        processed++;
        if (processed === fileList.length && urls.length > 0) {
          triggerReady(urls, fileList[0].type);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [triggerReady]);

  // Listen to window paste event (Ctrl+V or Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        setPasteNotification(true);
        setTimeout(() => setPasteNotification(false), 2500);
        handleFilesChange(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesChange]);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesChange(files);
    }
  };

  return (
    <div className="w-full">
      {/* Toast paste alert */}
      {pasteNotification && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-sm font-medium">Screenshot pasted! Auto-logging with Gemini 3.1 Flash Lite...</span>
        </div>
      )}

      {/* Primary Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-10 transition-all duration-200 text-center ${
          isDragging
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 scale-[1.01] shadow-lg ring-4 ring-blue-500/20'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 shadow-xs'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files?.length) handleFilesChange(e.target.files);
          }}
          accept="image/*"
          multiple
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xs border border-blue-100 dark:border-blue-900/50">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Drop your SAT question screenshot here
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 max-w-sm">
            Or press <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">Ctrl+V</kbd> / <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">Cmd+V</kbd> anywhere to paste from clipboard
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by gemini-3.1-flash-lite
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
              <Clipboard className="w-3.5 h-3.5" />
              Instant 5-sec Auto-Log
            </span>
          </div>
        </div>
      </div>

      {/* Quick Demo Pre-set Screenshots for Instant Testing */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
          Don&apos;t have a screenshot ready? Try a sample SAT problem:
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateSampleScreenshot('math-algebra')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-xs transition-all font-medium flex items-center gap-1"
          >
            <span>📐 Math: Lines</span>
          </button>
          <button
            type="button"
            onClick={() => generateSampleScreenshot('reading-craft')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-xs transition-all font-medium flex items-center gap-1"
          >
            <span>📖 Reading: Paired Passages</span>
          </button>
          <button
            type="button"
            onClick={() => generateSampleScreenshot('writing-grammar')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-xs transition-all font-medium flex items-center gap-1"
          >
            <span>✍️ Grammar: Verb Tense</span>
          </button>
        </div>
      </div>
    </div>
  );
}
