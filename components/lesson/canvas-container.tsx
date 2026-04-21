'use client';

import { useState, useCallback, useEffect } from 'react';
import { DrawingCanvas } from './drawing-canvas';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

export interface CanvasContainerProps {
  sessionId: string;
  onSnapshotCaptured?: (snapshotUrl: string, interpretation: unknown) => void;
  disabled?: boolean;
  mode?: 'draw' | 'annotate';
  referenceImageUrl?: string | null;
}

export function CanvasContainer({
  sessionId,
  onSnapshotCaptured,
  disabled = false,
  mode: externalMode,
  referenceImageUrl,
}: CanvasContainerProps) {
  const [internalMode, setInternalMode] = useState<'draw' | 'annotate'>(
    externalMode || 'draw'
  );
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = externalMode ?? internalMode;

  useEffect(() => {
    if (!referenceImageUrl) {
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBackgroundImage(img);
      setInternalMode('annotate');
      setError(null);
    };
    img.onerror = () => {
      setError('Failed to load lesson image');
    };
    img.src = referenceImageUrl;
  }, [referenceImageUrl]);

  // Load image when file is selected
  useEffect(() => {
    if (!imageFile) {
      return;
    }

    const img = new window.Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      setBackgroundImage(img);
      setInternalMode('annotate');
    };

    img.onerror = () => {
      setError('Failed to load image');
      setImageFile(null);
    };

    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);
    setImageFile(file);
  }, []);

  const handleClearImage = useCallback(() => {
    setImageFile(null);
    setBackgroundImage(null);
    setInternalMode('draw');
  }, []);

  const handleSnapshot = useCallback(
    async (dataUrl: string) => {
      setIsUploading(true);
      setError(null);

      try {
        onSnapshotCaptured?.(dataUrl, {
          summary:
            mode === 'annotate'
              ? 'Annotated snapshot captured for lesson review.'
              : 'Drawing snapshot captured for lesson review.',
          markings: [],
          confidence: 0,
          sessionId,
        });
      } catch (err) {
        console.error('Snapshot error:', err);
        setError(err instanceof Error ? err.message : 'Failed to capture snapshot');
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, mode, onSnapshotCaptured]
  );

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Mode Selector */}
      <div className="shrink-0 flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl">
          <button
            onClick={() => {
              setInternalMode('draw');
              handleClearImage();
            }}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'draw'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            } disabled:opacity-50`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Draw</span>
            </div>
          </button>
          <button
            onClick={() => setInternalMode('annotate')}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'annotate'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            } disabled:opacity-50`}
          >
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              <span>Annotate Image</span>
            </div>
          </button>
        </div>

        {/* Image Upload for Annotation Mode */}
        {mode === 'annotate' && (
          <div className="flex items-center gap-2 pr-2">
            {imageFile ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px] uppercase tracking-tight">
                  {imageFile.name}
                </span>
                <button
                  onClick={handleClearImage}
                  disabled={disabled}
                  className="rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
                <label
                 htmlFor="canvas-image-upload"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-all text-xs font-bold uppercase tracking-wider shadow-md shadow-slate-950/20"
                >
                 <input
                   id="canvas-image-upload"
                   type="file"
                   aria-label="Upload Image"
                   accept="image/*"
                   onChange={handleImageUpload}
                   disabled={disabled}
                   className="hidden"
                 />
                <ImageIcon className="h-3.5 w-3.5" />
                 <span>Upload Image</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Status Indicators */}
      {(error || isUploading) && (
        <div className="flex flex-col gap-2">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">{error}</p>
            </div>
          )}
          {isUploading && (
            <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl">
              <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-tight animate-pulse">Syncing snapshot...</p>
            </div>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 min-h-0 relative">
        {mode === 'annotate' && !backgroundImage ? (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100 p-8 text-center transition-all hover:border-slate-200">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-slate-300" />
            </div>
             <p className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight">Upload an image to annotate</p>
            <p className="text-[10px] font-medium text-slate-400 max-w-[160px] leading-relaxed">
              Upload a screenshot or diagram to mark it up for the tutor.
            </p>
          </div>
        ) : (
          <div className="h-full rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-inner">
            <DrawingCanvas
              width={800}
              height={600}
              backgroundImage={backgroundImage}
              onSnapshot={handleSnapshot}
              disabled={disabled || isUploading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
