'use client';

import { ImageIcon, PencilRuler } from 'lucide-react';
import type { MediaAsset } from '@/lib/types/lesson';
import { resolveLessonImageUrl } from '@/lib/media/media-url';
import { CanvasContainer } from './canvas-container';

interface TutorStageProps {
  sessionId: string;
  activeImage: MediaAsset | null;
  mediaAssets: MediaAsset[];
  disabled?: boolean;
  onCanvasSnapshot: (url: string, interpretation: unknown) => void;
}

export function TutorStage({
  sessionId,
  activeImage,
  mediaAssets,
  disabled = false,
  onCanvasSnapshot,
}: TutorStageProps) {
  const activeImageUrl = resolveLessonImageUrl(activeImage?.url);

  return (
    <section className="relative flex min-h-[58dvh] flex-col overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        {/* Visual Content */}
        <div className="relative aspect-video overflow-hidden rounded-[1.75rem] bg-slate-950 lg:aspect-auto">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeImageUrl || activeImage.url}
              alt={activeImage.altText}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1),_transparent_40%)] p-12 text-center">
              <div className="max-w-xs space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
                  <ImageIcon className="h-8 w-8 text-cyan-500/80" />
                </div>
                <p className="text-lg font-bold text-white">
                  Visual Field Clear
                </p>
                <p className="text-xs leading-relaxed text-slate-500">
                  Diagrams and focus material will be pinned here by the tutor as the session progresses.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Content */}
        <div className="flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-5 py-3">
            <div className="flex items-center gap-2">
              <PencilRuler className="h-4 w-4 text-cyan-600" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Speak + draw
            </span>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <CanvasContainer
              sessionId={sessionId}
              onSnapshotCaptured={onCanvasSnapshot}
              disabled={disabled}
              mode={activeImage ? 'annotate' : 'draw'}
              referenceImageUrl={activeImageUrl}
            />
          </div>
        </div>
      </div>

      {mediaAssets.length > 1 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Visuals
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className={`group min-w-[14rem] cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                  activeImage?.id === asset.id
                    ? 'border-cyan-500 bg-white ring-4 ring-cyan-500/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      resolveLessonImageUrl(asset.thumbnailUrl || asset.url) ||
                      asset.thumbnailUrl ||
                      asset.url
                    }
                    alt={asset.altText}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {activeImage?.id === asset.id && (
                    <div className="absolute inset-0 bg-cyan-600/10" />
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-xs font-bold text-slate-900">
                    {asset.altText}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {asset.source || asset.domain || 'Visual'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
