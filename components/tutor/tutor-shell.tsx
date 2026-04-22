'use client';

import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

import { TutorCanvasHost } from '@/components/tutor/tutor-canvas-host';
import { TutorSpeech } from '@/components/tutor/tutor-speech';
import { TutorVoiceDock } from '@/components/tutor/tutor-voice-dock';
import { TutorVoicePlayer } from '@/components/tutor/tutor-voice-player';

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
  teacherSpeaking: boolean;
  onTeacherSpeakingChange: (value: boolean) => void;
  onTeacherAudioPendingChange?: (value: boolean) => void;
  onTeacherInterrupt?: () => void;
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
  teacherSpeaking,
  onTeacherSpeakingChange,
  onTeacherAudioPendingChange,
  onTeacherInterrupt,
}: TutorShellProps) {
  const activeImage = (snapshot.mediaAssets || []).find((asset) => asset.id === snapshot.activeImageId) || null;
  const showCanvas = snapshot.intake?.status !== 'active';
  const teacherBusy = teacherSpeaking || teacherAudioPending;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
      {voiceEnabled ? (
        <TutorVoicePlayer
          enabled={voiceEnabled}
          text={snapshot.speech}
          provider={ttsProvider}
          modelId={ttsModelId}
          voiceId={teacherVoiceId}
          playToken={snapshot.speechRevision}
          stopSignal={teacherStopSignal}
          onRequestStart={() => onTeacherAudioPendingChange?.(true)}
          onStart={() => {
            onTeacherAudioPendingChange?.(false);
            onTeacherSpeakingChange(true);
          }}
          onComplete={() => {
            onTeacherAudioPendingChange?.(false);
            onTeacherSpeakingChange(false);
          }}
          onError={() => {
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
            <section className="mt-16 animate-in fade-in duration-700">
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
          <TutorVoiceDock
            disabled={snapshot.status === 'completed' || isSubmittingTurn}
            runtimeStatus={runtimeStatus}
            speechToTextEnabled={speechToTextEnabled}
            teacherSpeaking={teacherBusy}
            onSpeechStart={() => {
              onTeacherInterrupt?.();
              onTeacherAudioPendingChange?.(false);
              onTeacherSpeakingChange(false);
            }}
            onTranscript={onTranscript}
          />
        </footer>
      </div>

      {/* RIGHT PANE - INTERACTION */}
      <div className="hidden md:flex flex-1 h-full overflow-y-auto items-center justify-center relative bg-white">
         <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

         {showCanvas ? (
           <div className="w-full h-full max-w-5xl relative z-10 flex flex-col justify-center p-12">
              <TutorCanvasHost
                canvas={snapshot.canvas}
                disabled={snapshot.status === 'completed'}
                onMoveToken={onMoveToken}
                onChooseEquationAnswer={onChooseEquationAnswer}
              />
           </div>
         ) : null}
      </div>
    </div>
  );
}
