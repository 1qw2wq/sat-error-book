'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Clipboard, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  onImagesReady: (dataUrls: string[], mimeType?: string) => void;
  onImageReady?: (dataUrl: string, mimeType?: string) => void;
}

export default function UploadModal({ onClose, onImagesReady, onImageReady }: UploadModalProps) {
  const [imageList, setImageList] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isClipboardReading, setIsClipboardReading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addImage = (dataUrl: string) => {
    setImageList((prev) => [...prev, dataUrl]);
    setErrorMessage(null);
  };

  const removeImage = (index: number) => {
    setImageList((prev) => prev.filter((_, i) => i !== index));
  };

  // Read image from clipboard
  const handlePasteFromClipboard = async () => {
    setIsClipboardReading(true);
    setErrorMessage(null);
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        let found = false;
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                addImage(e.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
            found = true;
          }
        }
        if (!found) {
          setErrorMessage('No image found in clipboard. Copy a screenshot or drop files below!');
        }
      } else {
        setErrorMessage('Clipboard API not supported in this browser. Please use the file uploader below or press Ctrl+V.');
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
      setErrorMessage('Could not access clipboard directly. Please press Ctrl+V or drop image files below!');
    } finally {
      setIsClipboardReading(false);
    }
  };

  // Process file upload
  const handleFilesChange = React.useCallback((files: FileList | File[]) => {
    let addedCount = 0;
    Array.from(files).forEach((file) => {
      if (file && file.type.startsWith('image/')) {
        addedCount++;
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            addImage(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    if (addedCount === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WEBP).');
    } else {
      setErrorMessage(null);
    }
  }, []);

  // Global Ctrl+V / Cmd+V paste handler inside modal
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
        handleFilesChange(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesChange]);

  // Generate Sample Screenshots for testing
  const generateSampleScreenshot = (type: 'math-algebra' | 'reading-craft' | 'writing-grammar') => {
    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      ctx.fillText('Line m is perpendicular to line k and passes through point (2, -1).', 40, 130);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Which equation defines line m?', 40, 170);

      ctx.font = '15px sans-serif';
      ctx.fillText('A) y = (4/3)x - 11/3', 60, 220);
      ctx.fillText('B) y = (-3/4)x + 1/2', 60, 260);
      ctx.fillText('C) y = (3/4)x - 5/2', 60, 300);
      ctx.fillText('D) y = (-4/3)x + 5/3', 60, 340);
    } else if (type === 'reading-craft') {
      ctx.fillText('Text 1:', 40, 85);
      ctx.font = '14px sans-serif';
      ctx.fillText('Architectural historians laud mid-century modern design for its minimalist functionalism.', 40, 110);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Text 2:', 40, 150);
      ctx.font = '14px sans-serif';
      ctx.fillText('Bio-centric architectural movements suggest pure functionalism risks alienating occupants.', 40, 175);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Based on Text 2, the author would most likely critique Text 1\'s view as—', 40, 220);
      ctx.font = '14px sans-serif';
      ctx.fillText('A) Overestimating the environmental durability of synthetic building composites.', 60, 260);
      ctx.fillText('B) Neglecting psychological wellbeing in favor of rigid physical utility.', 60, 290);
      ctx.fillText('C) Misinterpreting historical precedents set by 19th-century artisans.', 60, 320);
      ctx.fillText('D) Underestimating the economic savings associated with modular units.', 60, 350);
    } else {
      ctx.fillText('In 1928, chemist Alexander Fleming discovered penicillin by accident when mold', 40, 100);
      ctx.fillText('contaminated a petridish of Staphylococcus bacteria. Fleming noticed that the bacterial', 40, 125);
      ctx.fillText('colonies surrounding the fungus _______ completely ruined.', 40, 150);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Which choice completes the text so that it conforms to Standard English?', 40, 195);
      ctx.font = '15px sans-serif';
      ctx.fillText('A) had been', 60, 245);
      ctx.fillText('B) having been', 60, 285);
      ctx.fillText('C) was being', 60, 325);
      ctx.fillText('D) to have been', 60, 365);
    }

    const dataUrl = canvas.toDataURL('image/png');
    addImage(dataUrl);
  };

  const handleAnalyzeSubmit = () => {
    if (imageList.length === 0) {
      setErrorMessage('Please add at least one screenshot image.');
      return;
    }
    if (onImagesReady) {
      onImagesReady(imageList);
    } else if (onImageReady) {
      onImageReady(imageList[0]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Upload SAT Question Screenshot(s)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Supports single or multiple screenshots (Gemini 3.1 Flash Lite)
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
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Screenshots Preview Gallery */}
          {imageList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  Selected Screenshots ({imageList.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  You can paste (<kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Ctrl+V</kbd>) or add more
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imageList.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden h-32 flex items-center justify-center p-1"
                  >
                    <img
                      src={imgUrl}
                      alt={`Screenshot ${idx + 1}`}
                      className="max-h-full w-auto object-contain rounded"
                    />
                    <div className="absolute top-1 left-1 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold">
                      #{idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-md"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add More Tile */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 h-32 flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-300 transition-all"
                >
                  <Upload className="w-5 h-5 mb-1 text-blue-500" />
                  <span className="text-xs font-bold">+ Add Screenshot</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeSubmit}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Analyze {imageList.length} Screenshot{imageList.length > 1 ? 's' : ''} with Gemini 3.1 Flash Lite</span>
              </button>
            </div>
          )}

          {/* Big Paste Clipboard Action */}
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={isClipboardReading}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 border border-slate-200 dark:border-slate-700"
          >
            <Clipboard className="w-4 h-4 text-blue-500" />
            <span>{isClipboardReading ? 'Reading Clipboard...' : 'Paste Screenshot from Clipboard'}</span>
          </button>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) {
                handleFilesChange(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Click to browse or drag & drop screenshots (Select multiple!)
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Supports PNG, JPG, WEBP • Press <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Ctrl+V</kbd> to paste
            </p>
          </div>

          {/* Quick Demo Pre-sets */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              Test immediately with a sample SAT screenshot:
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => generateSampleScreenshot('math-algebra')}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 font-medium text-center transition-colors"
              >
                📐 Math Line
              </button>
              <button
                type="button"
                onClick={() => generateSampleScreenshot('reading-craft')}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 font-medium text-center transition-colors"
              >
                📖 Reading
              </button>
              <button
                type="button"
                onClick={() => generateSampleScreenshot('writing-grammar')}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 font-medium text-center transition-colors"
              >
                ✍️ Grammar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
