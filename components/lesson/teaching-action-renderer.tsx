'use client';

import React, { useState, useEffect } from 'react';
import { 
  Info, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Image as ImageIcon 
} from 'lucide-react';
import { OptimizedImage } from './optimized-image';

/**
 * Media asset type definition
 */
export interface MediaAsset {
  id: string;
  url: string;
  type: string;
  caption?: string;
}

/**
 * Supported teaching action types
 */
export type TeachingActionType = 'display_media' | 'highlight_concept' | 'provide_feedback' | 'ask_question';

type DisplayMediaAction = {
  type: 'display_media';
  data: unknown;
};

type HighlightConceptAction = {
  type: 'highlight_concept';
  data: unknown;
};

type ProvideFeedbackAction = {
  type: 'provide_feedback';
  data: unknown;
};

type AskQuestionAction = {
  type: 'ask_question';
  data: unknown;
};

/**
 * Teaching action interface
 */
export type TeachingAction =
  | DisplayMediaAction
  | HighlightConceptAction
  | ProvideFeedbackAction
  | AskQuestionAction;

interface TeachingActionRendererProps {
  actions: TeachingAction[];
  mediaAssets: MediaAsset[];
}

/**
 * TeachingActionRenderer Component
 * Parses and renders teaching actions from teacher response JSON sequentially with animations.
 */
export default function TeachingActionRenderer({ actions, mediaAssets }: TeachingActionRendererProps) {
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setVisibleIndices([]);
    }, 0);

    const timers: number[] = [];

    actions.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setVisibleIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
      }, index * 800); // 800ms stagger for smooth progression
      timers.push(timer);
    });

    return () => {
      window.clearTimeout(resetTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [actions]);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const renderActionContent = (action: TeachingAction, index: number) => {
    const isVisible = visibleIndices.includes(index);
    
    // Base animation classes using standard Tailwind transitions
    const transitionClasses = `transition-all duration-700 ease-out transform ${
      isVisible 
        ? 'opacity-100 translate-y-0 scale-100' 
        : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
    }`;

    switch (action.type) {
      case 'display_media': {
        const assetId =
          typeof action.data === 'string'
            ? action.data
            : isRecord(action.data) && typeof action.data.mediaId === 'string'
              ? action.data.mediaId
              : isRecord(action.data) && typeof action.data.id === 'string'
                ? action.data.id
                : null;
        const asset = mediaAssets.find((a) => a.id === assetId);
        return (
          <div className={`mb-6 ${transitionClasses}`}>
            {asset ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl bg-gray-50 border border-gray-200 shadow-sm">
                  <OptimizedImage
                    src={asset.url} 
                    alt={asset.caption || 'Educational visual'} 
                    className="w-full h-auto object-contain max-h-[400px] mx-auto block"
                    width={800}
                    quality={85}
                    priority={index === 0}
                  />
                </div>
                {asset.caption && (
                  <p className="text-sm text-gray-500 text-center italic font-medium px-4">
                    {asset.caption}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 italic gap-2">
                <ImageIcon className="w-5 h-5" />
                <span>Visual asset not available</span>
              </div>
            )}
          </div>
        );
      }

      case 'highlight_concept': {
        const concept =
          typeof action.data === 'string'
            ? action.data
            : isRecord(action.data) && typeof action.data.concept === 'string'
              ? action.data.concept
              : '';
        const definition =
          isRecord(action.data) && typeof action.data.definition === 'string'
            ? action.data.definition
            : undefined;
        return (
          <div className={`mb-6 ${transitionClasses}`}>
            <div className="flex items-start gap-4 bg-blue-50/80 p-5 rounded-2xl border border-blue-100 shadow-sm">
              <div className="mt-1 p-2.5 bg-blue-600 rounded-full text-white shadow-md ring-4 ring-blue-50">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 block">Key Concept</span>
                <h4 className="text-xl font-bold text-blue-950 leading-tight">
                  {concept}
                </h4>
                {definition && (
                  <p className="text-base text-blue-800/80 mt-2 font-medium leading-relaxed">
                    {definition}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'provide_feedback': {
        const feedbackData = action.data;
        const feedbackType =
          isRecord(feedbackData) && typeof feedbackData.type === 'string'
            ? feedbackData.type
            : isRecord(feedbackData) && feedbackData.isCorrect
              ? 'positive'
              : 'neutral';
        const message =
          typeof feedbackData === 'string'
            ? feedbackData
            : isRecord(feedbackData) && typeof feedbackData.message === 'string'
              ? feedbackData.message
              : '';
        const isPositive = feedbackType === 'positive';
        const isCorrective = feedbackType === 'corrective' || feedbackType === 'negative';
        
        return (
          <div className={`mb-6 ${transitionClasses}`}>
            <div className={`flex items-center gap-4 p-5 rounded-2xl border shadow-sm ${
              isPositive ? 'bg-emerald-50/80 border-emerald-100' : 
              isCorrective ? 'bg-amber-50/80 border-amber-100' : 
              'bg-slate-50/80 border-slate-100'
            }`}>
              <div className={`p-2 rounded-xl ${
                isPositive ? 'bg-emerald-500 text-white' : 
                isCorrective ? 'bg-amber-500 text-white' : 
                'bg-slate-500 text-white'
              }`}>
                {isPositive ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isCorrective ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <p className={`text-lg font-bold leading-tight ${
                isPositive ? 'text-emerald-900' : 
                isCorrective ? 'text-amber-900' : 
                'text-slate-900'
              }`}>
                {message}
              </p>
            </div>
          </div>
        );
      }

      case 'ask_question': {
        const question =
          typeof action.data === 'string'
            ? action.data
            : isRecord(action.data) && typeof action.data.question === 'string'
              ? action.data.question
              : '';
        return (
          <div className={`mb-6 ${transitionClasses}`}>
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl border-none shadow-xl relative overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />
              
              <div className="flex items-start gap-5 relative z-10">
                <div className="mt-1 p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-inner transform -rotate-6">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-black text-indigo-200/70 uppercase tracking-[0.3em] mb-1 block">Teacher Question</span>
                  <p className="text-xl md:text-2xl font-extrabold text-white leading-tight tracking-tight">
                    {question}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-2">
      {actions.map((action, index) => (
        <React.Fragment key={`${action.type}-${index}`}>
          {renderActionContent(action, index)}
        </React.Fragment>
      ))}
    </div>
  );
}
