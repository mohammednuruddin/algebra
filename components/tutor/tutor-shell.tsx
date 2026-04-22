'use client';

import { useMemo, useState } from 'react';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';
import type { TutorCodeExecutionResult } from '@/lib/types/tutor';
import type { LessonArticleRecord } from '@/lib/types/database';

import { TutorCanvasHost } from '@/components/tutor/tutor-canvas-host';
import { TutorSpeech } from '@/components/tutor/tutor-speech';
import { TutorVoiceDock } from '@/components/tutor/tutor-voice-dock';
import { TutorVoicePlayer } from '@/components/tutor/tutor-voice-player';
import { SessionSidebar } from '@/components/tutor/session-sidebar';

interface TutorShellProps {
  snapshot: TutorRuntimeSnapshot;
  isSubmittingTurn?: boolean;
  speechToTextEnabled?: boolean;
  voiceEnabled?: boolean;
  teacherAudioPending?: boolean;
  teacherStopSignal?: number;
  ttsProvider: 'inworld' | 'elevenlabs';
  ttsModelId: string;
  teacherVoiceId: string;
  runtimeStatus: 'loading' | 'ready' | 'error';
  onTranscript: (text: string) => Promise<void>;
  onMoveToken: (tokenId: string, zoneId: string | null) => void;
  onChooseEquationAnswer: (choiceId: string) => void;
  onFillBlankSubmit?: (answers: Record<string, string>) => void;
  onCodeSubmit?: (code: string, result: TutorCodeExecutionResult) => void;
  onCanvasSubmit?: (mode: string, data: unknown) => void;
  isGeneratingArticle?: boolean;
  article?: LessonArticleRecord | null;
  teacherSpeaking: boolean;
  onTeacherSpeakingChange: (value: boolean) => void;
  onTeacherAudioPendingChange?: (value: boolean) => void;
  onTeacherInterrupt?: () => void;
}

function hasVisibleCanvasScene(snapshot: TutorRuntimeSnapshot) {
  const canvas = snapshot.canvas;

  if (
    canvas.fillBlank ||
    canvas.codeBlock ||
    canvas.multipleChoice ||
    canvas.numberLine ||
    canvas.tableGrid ||
    canvas.graphPlot ||
    canvas.matchingPairs ||
    canvas.ordering ||
    canvas.textResponse ||
    canvas.drawing ||
    canvas.equation
  ) {
    return true;
  }

  return canvas.tokens.length > 0 || canvas.zones.length > 0;
}

export function TutorShell({
  snapshot,
  isSubmittingTurn = false,
  speechToTextEnabled = false,
  voiceEnabled = false,
  teacherAudioPending = false,
  teacherStopSignal = 0,
  ttsProvider,
  ttsModelId,
  teacherVoiceId,
  runtimeStatus,
  onTranscript,
  onMoveToken,
  onChooseEquationAnswer,
  onFillBlankSubmit,
  onCodeSubmit,
  onCanvasSubmit,
  isGeneratingArticle = false,
  article,
  teacherSpeaking,
  onTeacherSpeakingChange,
  onTeacherAudioPendingChange,
  onTeacherInterrupt,
}: TutorShellProps) {
  const [voiceUnlockRequested, setVoiceUnlockRequested] = useState(false);
  const [teacherSpeechSuspended, setTeacherSpeechSuspended] = useState(false);
  const activeImage = (snapshot.mediaAssets || []).find((asset) => asset.id === snapshot.activeImageId) || null;
  const showCanvas = snapshot.intake?.status !== 'active';
  const showCanvasScene = showCanvas && hasVisibleCanvasScene(snapshot);
  const canvasOwnsStageImage =
    snapshot.canvas.mode === 'drawing' &&
    Boolean(snapshot.canvas.drawing?.backgroundImageUrl);
  const showStandaloneImageStage = Boolean(activeImage) && !canvasOwnsStageImage;
  const showStageVisual = showStandaloneImageStage || showCanvasScene;
  const needsVoiceUnlock = voiceEnabled || speechToTextEnabled;
  const voiceControlsArmed = !needsVoiceUnlock || voiceUnlockRequested;
  const unlockLabel = useMemo(() => {
    if (voiceEnabled && speechToTextEnabled) {
      return 'Enable voice and mic';
    }
    if (voiceEnabled) {
      return 'Enable tutor voice';
    }
    if (speechToTextEnabled) {
      return 'Enable microphone';
    }
    return 'Enable voice';
  }, [speechToTextEnabled, voiceEnabled]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
      <SessionSidebar
        currentSessionId={snapshot.sessionId}
        isGeneratingArticle={isGeneratingArticle}
        article={article}
      />
      {voiceEnabled ? (
        <TutorVoicePlayer
          enabled={voiceEnabled && voiceControlsArmed}
          text={snapshot.speech}
          provider={ttsProvider}
          modelId={ttsModelId}
          voiceId={teacherVoiceId}
          playToken={snapshot.speechRevision}
          paused={teacherSpeechSuspended}
          stopSignal={teacherStopSignal}
          onRequestStart={() => {
            setTeacherSpeechSuspended(false);
            onTeacherAudioPendingChange?.(true);
          }}
          onStart={() => {
            setTeacherSpeechSuspended(false);
            onTeacherAudioPendingChange?.(false);
            onTeacherSpeakingChange(true);
          }}
          onComplete={() => {
            setTeacherSpeechSuspended(false);
            onTeacherAudioPendingChange?.(false);
            onTeacherSpeakingChange(false);
          }}
          onError={() => {
            setTeacherSpeechSuspended(false);
            onTeacherAudioPendingChange?.(false);
            onTeacherSpeakingChange(false);
          }}
        />
      ) : null}

      {/* LEFT SIDEBAR - EDITORIAL / PRESENTATION */}
      <div className="w-full md:w-[480px] lg:w-[540px] h-full flex flex-col border-r border-zinc-200 bg-white z-10 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <header className="px-8 py-6 flex items-center justify-between border-b border-zinc-100 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Live tutor
            </p>
            <p className="mt-1 text-xs font-semibold tracking-widest uppercase text-zinc-900">Live Session</p>
          </div>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 bg-zinc-50 border border-zinc-100">
            {snapshot.status === 'completed' ? 'Finished' : 'Active'}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-12 scrollbar-hide flex flex-col">
          <TutorSpeech
            speech={snapshot.speech}
            thinking={isSubmittingTurn}
          />

          {activeImage ? (
            <section className="mt-16 animate-in fade-in duration-700 md:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">Visual Context</p>
              <div className="border border-zinc-200 bg-[#FAFAFA] p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImage.url}
                  alt={activeImage.altText}
                  className="w-full h-auto object-cover"
                />
              </div>
              <p className="mt-4 text-sm font-light leading-relaxed text-zinc-600">{activeImage.description}</p>
            </section>
          ) : null}
        </main>

        <footer className="px-8 py-6 border-t border-zinc-100 bg-white shrink-0">
          {needsVoiceUnlock && !voiceControlsArmed ? (
            <button
              type="button"
              onClick={() => setVoiceUnlockRequested(true)}
              className="flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {unlockLabel}
            </button>
          ) : (
            <TutorVoiceDock
              disabled={snapshot.status === 'completed' || isSubmittingTurn}
              maintainConnection={snapshot.status !== 'completed'}
              runtimeStatus={runtimeStatus}
              speechToTextEnabled={speechToTextEnabled && voiceControlsArmed}
              teacherSpeaking={teacherSpeaking}
              teacherAudioPending={teacherAudioPending}
              teacherSpeechText={snapshot.speech}
              onBargeInStart={() => {
                setTeacherSpeechSuspended(true);
              }}
              onBargeInCancel={() => {
                setTeacherSpeechSuspended(false);
              }}
              onBargeInCommit={() => {
                setTeacherSpeechSuspended(false);
                onTeacherInterrupt?.();
                onTeacherAudioPendingChange?.(false);
                onTeacherSpeakingChange(false);
              }}
              onTranscript={onTranscript}
            />
          )}
        </footer>
      </div>

      {/* RIGHT PANE - INTERACTION */}
      <div className="hidden md:flex min-w-0 flex-1 h-full overflow-x-hidden overflow-y-auto items-center justify-center relative bg-white">
         <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

         {showStageVisual ? (
           <div className="relative z-10 flex h-full w-full min-w-0 max-w-5xl flex-col justify-center gap-8 p-6 md:p-8 xl:p-12">
              {showStandaloneImageStage && activeImage ? (
                <section
                  data-testid="active-image-stage"
                  className="overflow-hidden border border-zinc-200 bg-white shadow-lg animate-in fade-in duration-700"
                >
                  <div className="border-b border-zinc-100 px-6 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Visual Context
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeImage.url}
                    alt={activeImage.altText}
                    className="max-h-[34dvh] w-full object-contain bg-[#FAFAFA]"
                  />
                  <div className="px-6 py-4">
                    <p className="text-sm font-light leading-relaxed text-zinc-600">
                      {activeImage.description}
                    </p>
                  </div>
                </section>
              ) : null}

              {showCanvasScene ? (
                <TutorCanvasHost
                  canvas={snapshot.canvas}
                  disabled={snapshot.status === 'completed'}
                  onMoveToken={onMoveToken}
                  onChooseEquationAnswer={onChooseEquationAnswer}
                  onFillBlankSubmit={onFillBlankSubmit}
                  onCodeSubmit={onCodeSubmit}
                  onCanvasSubmit={onCanvasSubmit}
                />
              ) : null}
           </div>
         ) : null}
      </div>
    </div>
  );
}
