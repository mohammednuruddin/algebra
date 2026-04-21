'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { VoiceOutput } from './voice-output';
import TeachingActionRenderer, { MediaAsset, TeachingAction as RenderTeachingAction } from './teaching-action-renderer';
import { TeacherResponse, TeachingAction as LessonTeachingAction } from '../../lib/types/lesson';

interface TeachingResponseProps {
  /**
   * The teacher response data containing actions and text to speak
   */
  response: TeacherResponse;
  /**
   * Available media assets to be referenced by actions
   */
  mediaAssets?: MediaAsset[];
  /**
   * Callback triggered when both voice and visual actions are complete
   */
  onComplete?: () => void;
}

/**
 * TeachingResponse Component
 * Integrates visual action rendering with voice output for a complete educational turn.
 */
export function TeachingResponse({ 
  response, 
  mediaAssets, 
  onComplete 
}: TeachingResponseProps) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const completionTimerRef = useRef<number | null>(null);

  const clearCompletionTimer = useCallback(() => {
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCompletionTimer, [clearCompletionTimer]);

  const scheduleCompletion = useCallback(
    (delayMs: number) => {
      clearCompletionTimer();
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        onComplete?.();
      }, delayMs);
    },
    [clearCompletionTimer, onComplete]
  );

  // Handle voice completion
  const handleVoiceComplete = useCallback(() => {
    setIsVoiceActive(false);
    setIsComplete(true);
    
    // Notify parent after a short delay to let animations settle
    scheduleCompletion(1200);
  }, [scheduleCompletion]);

  // Handle voice start/errors
  const handleVoiceStart = () => {
    setIsVoiceActive(true);
    setHasStarted(true);
  };

  const handleVoiceError = (error: Error) => {
    console.error('Voice playback error:', error);
    // Continue even if voice fails so the student isn't stuck
    setIsComplete(true);
    scheduleCompletion(1000);
  };

  const voiceBarHeights = [32, 56, 44, 78, 50];

  const renderableActions: RenderTeachingAction[] = response.actions
    .map((action: LessonTeachingAction): RenderTeachingAction | null => {
      switch (action.type) {
        case 'show_media':
          return { type: 'display_media', data: action.params };
        case 'highlight_concept':
          return { type: 'highlight_concept', data: action.params };
        case 'provide_feedback':
          return { type: 'provide_feedback', data: action.params };
        default:
          return null;
      }
    })
    .filter((action): action is RenderTeachingAction => action !== null);

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto space-y-8 py-6 animate-in fade-in duration-500">
      {/* Teacher Status & Voice Controls Header */}
      <div className="sticky top-4 z-20 flex items-center justify-between bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-gray-100 shadow-lg transition-all duration-500 hover:shadow-xl animate-in slide-in-from-top-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`p-3 rounded-2xl transition-all duration-500 ${
              isVoiceActive 
                ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg scale-105' 
                : 'bg-gray-100 text-gray-400'
            }`}>
              {isVoiceActive ? (
                <Sparkles className="w-5 h-5 animate-pulse" />
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </div>
            {isVoiceActive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-gray-900 leading-none tracking-tight">
              {isVoiceActive ? 'Teacher is explaining...' : isComplete ? 'Explanation finished' : 'Ready to start'}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex gap-0.5 h-3 items-end">
                {voiceBarHeights.map((height, i) => (
                  <div 
                    key={i} 
                    className={`w-0.5 rounded-full transition-all duration-300 ${
                      isVoiceActive ? 'bg-blue-400' : 'bg-gray-200'
                    }`} 
                    style={{ 
                      height: isVoiceActive ? `${height}%` : '20%',
                      transitionDelay: `${i * 50}ms`
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                AI Voice Engine
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
        <VoiceOutput 
          text={response.speech || ''}
          autoPlay={true}
          onStart={handleVoiceStart}
          onComplete={handleVoiceComplete}
          onError={handleVoiceError}
        />
        </div>
      </div>

      {/* Main Content Area: Visual Actions */}
      <div className="relative px-2">
        <TeachingActionRenderer 
          actions={renderableActions} 
          mediaAssets={mediaAssets || []} 
        />
        
        {/* Subtle progress indicator */}
        {!isComplete && hasStarted && (
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gray-50 rounded-full overflow-hidden">
            <div className="w-full bg-blue-500/30 animate-pulse h-full" />
          </div>
        )}
      </div>

      {/* Interactive Completion Footer */}
      {isComplete && (
        <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
          <div className="flex items-center gap-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gray-200" />
            <div className="p-2 bg-gray-50 rounded-full">
              <Sparkles className="w-4 h-4 text-gray-300" />
            </div>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gray-200" />
          </div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] text-center">
            Ready for your input
          </p>
        </div>
      )}
    </div>
  );
}
