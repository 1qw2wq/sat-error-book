'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Crop,
  RotateCcw,
  Trash2,
  Maximize2,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';
import { cropImageBoundingBox } from '@/lib/imageCropper';

interface ImageCropModalProps {
  images: string[];
  initialBox2d?: [number, number, number, number] | number[] | null;
  initialImageIndex?: number;
  onClose: () => void;
  onSaveCrop: (croppedDataUrl: string, box2d: [number, number, number, number], imageIndex: number) => void;
  onRemoveCrop?: () => void;
}

type DragHandle =
  | 'none'
  | 'draw'
  | 'move'
  | 'tl'
  | 'tm'
  | 'tr'
  | 'mr'
  | 'br'
  | 'bm'
  | 'bl'
  | 'ml';

export default function ImageCropModal({
  images,
  initialBox2d,
  initialImageIndex = 0,
  onClose,
  onSaveCrop,
  onRemoveCrop,
}: ImageCropModalProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState<number>(
    Math.min(Math.max(0, initialImageIndex), Math.max(0, images.length - 1))
  );

  // Normalized bounding box: [ymin, xmin, ymax, xmax] in 0..1000 scale
  const [box2d, setBox2d] = useState<[number, number, number, number]>(() => {
    if (initialBox2d && initialBox2d.length === 4) {
      const [ymin, xmin, ymax, xmax] = initialBox2d;
      if (ymin < ymax && xmin < xmax) {
        return [
          Math.max(0, Math.min(1000, ymin)),
          Math.max(0, Math.min(1000, xmin)),
          Math.max(0, Math.min(1000, ymax)),
          Math.max(0, Math.min(1000, xmax)),
        ];
      }
    }
    // Default initial crop box (center 60% of image)
    return [150, 150, 850, 850];
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Drag interaction state
  const isDraggingRef = useRef<boolean>(false);
  const dragHandleRef = useRef<DragHandle>('none');
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startBoxRef = useRef<[number, number, number, number]>([0, 0, 1000, 1000]);

  const activeImage = images[selectedImgIdx] || images[0] || '';

  // Update live preview when box2d or activeImage changes
  useEffect(() => {
    let isCurrent = true;
    if (!activeImage) return;

    cropImageBoundingBox(activeImage, box2d, 0).then((res) => {
      if (isCurrent) {
        setPreviewUrl(res);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [activeImage, box2d]);

  // Convert mouse event to 0..1000 normalized image coordinate
  const getImageCoords = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } | null => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    const normX = Math.max(0, Math.min(1000, Math.round(rawX * 1000)));
    const normY = Math.max(0, Math.min(1000, Math.round(rawY * 1000)));

    return { x: normX, y: normY };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();

    const coords = getImageCoords(e);
    if (!coords) return;

    isDraggingRef.current = true;
    dragHandleRef.current = handle;
    startPosRef.current = coords;
    startBoxRef.current = [...box2d];

    if (handle === 'draw') {
      // Start drawing a new box from this point
      setBox2d([coords.y, coords.x, coords.y + 10, coords.x + 10]);
      startBoxRef.current = [coords.y, coords.x, coords.y, coords.x];
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const coords = getImageCoords(e);
      if (!coords) return;

      const dx = coords.x - startPosRef.current.x;
      const dy = coords.y - startPosRef.current.y;
      const [sYmin, sXmin, sYmax, sXmax] = startBoxRef.current;
      const handle = dragHandleRef.current;

      let [newYmin, newXmin, newYmax, newXmax] = [sYmin, sXmin, sYmax, sXmax];

      if (handle === 'draw') {
        const x1 = Math.min(startPosRef.current.x, coords.x);
        const x2 = Math.max(startPosRef.current.x, coords.x);
        const y1 = Math.min(startPosRef.current.y, coords.y);
        const y2 = Math.max(startPosRef.current.y, coords.y);
        newXmin = x1;
        newXmax = Math.max(x1 + 20, x2);
        newYmin = y1;
        newYmax = Math.max(y1 + 20, y2);
      } else if (handle === 'move') {
        const boxW = sXmax - sXmin;
        const boxH = sYmax - sYmin;

        newXmin = Math.max(0, Math.min(1000 - boxW, sXmin + dx));
        newXmax = newXmin + boxW;
        newYmin = Math.max(0, Math.min(1000 - boxH, sYmin + dy));
        newYmax = newYmin + boxH;
      } else {
        // Corner and side handles
        if (handle.includes('t')) {
          newYmin = Math.min(sYmax - 20, Math.max(0, sYmin + dy));
        }
        if (handle.includes('b')) {
          newYmax = Math.max(sYmin + 20, Math.min(1000, sYmax + dy));
        }
        if (handle.includes('l')) {
          newXmin = Math.min(sXmax - 20, Math.max(0, sXmin + dx));
        }
        if (handle.includes('r')) {
          newXmax = Math.max(sXmin + 20, Math.min(1000, sXmax + dx));
        }
      }

      setBox2d([
        Math.round(newYmin),
        Math.round(newXmin),
        Math.round(newYmax),
        Math.round(newXmax),
      ]);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragHandleRef.current = 'none';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getImageCoords]);

  const handleApply = async () => {
    if (!activeImage) return;
    setIsApplying(true);
    try {
      const cropped = await cropImageBoundingBox(activeImage, box2d, 0);
      onSaveCrop(cropped, box2d, selectedImgIdx);
      onClose();
    } catch (e) {
      console.error('Failed to crop:', e);
    } finally {
      setIsApplying(false);
    }
  };

  const handleResetFull = () => {
    setBox2d([0, 0, 1000, 1000]);
  };

  const handlePreset = (aspect: '1:1' | '4:3' | '16:9') => {
    const [ymin, xmin, ymax, xmax] = box2d;
    const curW = xmax - xmin;
    const curH = ymax - ymin;
    const midX = (xmin + xmax) / 2;
    const midY = (ymin + ymax) / 2;

    let targetW = curW;
    let targetH = curH;

    if (aspect === '1:1') {
      const size = Math.min(curW, curH);
      targetW = size;
      targetH = size;
    } else if (aspect === '4:3') {
      targetH = Math.round((targetW * 3) / 4);
    } else if (aspect === '16:9') {
      targetH = Math.round((targetW * 9) / 16);
    }

    const nXmin = Math.max(0, Math.min(1000 - targetW, Math.round(midX - targetW / 2)));
    const nYmin = Math.max(0, Math.min(1000 - targetH, Math.round(midY - targetH / 2)));
    setBox2d([nYmin, nXmin, Math.min(1000, nYmin + targetH), Math.min(1000, nXmin + targetW)]);
  };

  const [ymin, xmin, ymax, xmax] = box2d;
  const boxTopPct = `${(ymin / 1000) * 100}%`;
  const boxLeftPct = `${(xmin / 1000) * 100}%`;
  const boxWidthPct = `${((xmax - xmin) / 1000) * 100}%`;
  const boxHeightPct = `${((ymax - ymin) / 1000) * 100}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in select-none">
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Adjust Diagram / Graph Crop
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Drag handles or click-drag to crop the exact coordinate graph, diagram, or geometry figure
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multiple Screenshot Selector */}
        {images.length > 1 && (
          <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              Source Screenshot:
            </span>
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedImgIdx(idx)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedImgIdx === idx
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Screenshot #{idx + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main Work Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-[380px]">
          {/* Left / Center: Interactive Crop Canvas */}
          <div
            ref={containerRef}
            className="lg:col-span-8 bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden select-none"
            onMouseDown={(e) => {
              // Click on dark area starts drawing a new crop box
              if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
                handleMouseDown(e, 'draw');
              }
            }}
          >
            <div className="relative inline-block max-h-[60vh] max-w-full">
              <img
                ref={imgRef}
                src={activeImage}
                alt="Source screenshot for cropping"
                className="max-h-[60vh] max-w-full object-contain block pointer-events-auto cursor-crosshair rounded-xs"
                draggable={false}
              />

              {/* Dimmed Overlay outside crop box */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `0 0 0 9999px rgba(15, 23, 42, 0.65)`,
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 
                    ${boxLeftPct} 100%, 
                    ${boxLeftPct} ${boxTopPct}, 
                    calc(${boxLeftPct} + ${boxWidthPct}) ${boxTopPct}, 
                    calc(${boxLeftPct} + ${boxWidthPct}) calc(${boxTopPct} + ${boxHeightPct}), 
                    ${boxLeftPct} calc(${boxTopPct} + ${boxHeightPct}), 
                    ${boxLeftPct} 100%, 
                    100% 100%, 100% 0%
                  )`,
                }}
              />

              {/* Active Crop Box */}
              <div
                className="absolute border-2 border-blue-400 dark:border-blue-400 bg-blue-500/10 shadow-lg cursor-move select-none"
                style={{
                  top: boxTopPct,
                  left: boxLeftPct,
                  width: boxWidthPct,
                  height: boxHeightPct,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* 3x3 Grid Guidelines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-blue-300" />
                  <div className="border-r border-b border-blue-300" />
                  <div className="border-b border-blue-300" />
                  <div className="border-r border-b border-blue-300" />
                  <div className="border-r border-b border-blue-300" />
                  <div className="border-b border-blue-300" />
                  <div className="border-r border-blue-300" />
                  <div className="border-r border-blue-300" />
                  <div />
                </div>

                {/* 8 Resize Handles */}
                {/* Top-Left */}
                <div
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tl')}
                />
                {/* Top-Middle */}
                <div
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tm')}
                />
                {/* Top-Right */}
                <div
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tr')}
                />
                {/* Middle-Right */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'mr')}
                />
                {/* Bottom-Right */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'br')}
                />
                {/* Bottom-Middle */}
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bm')}
                />
                {/* Bottom-Left */}
                <div
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bl')}
                />
                {/* Middle-Left */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'ml')}
                />
              </div>
            </div>
          </div>

          {/* Right: Live Preview & Presets Pane */}
          <div className="lg:col-span-4 p-5 bg-slate-50 dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Cropped Diagram Live Preview
                </span>
                <div className="w-full min-h-[160px] max-h-[220px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 flex items-center justify-center shadow-xs overflow-hidden">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Cropped graph live preview"
                      className="max-h-[190px] max-w-full object-contain rounded"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Loading crop preview...</span>
                  )}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Quick Ratio Presets
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePreset('1:1')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    1:1 Square
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('4:3')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    4:3 Graph
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('16:9')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    16:9 Wide
                  </button>
                </div>
              </div>

              {/* Reset / Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetFull}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Select Full Image</span>
                </button>

                {onRemoveCrop && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveCrop();
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
                    title="Remove graph diagram completely"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>No Diagram</span>
                  </button>
                )}
              </div>

              {/* Tip info */}
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Tip: SAT data tables are automatically formatted as Markdown text. Use this tool only to crop coordinate graphs, geometry figures, or visual curves.
                </span>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isApplying ? 'Applying...' : 'Apply & Save Crop'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
