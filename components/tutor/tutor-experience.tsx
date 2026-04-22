'use client';

import { useCallback, useEffect, useState } from 'react';

import { TutorShell } from '@/components/tutor/tutor-shell';
import { useTutorSession } from '@/lib/hooks/use-tutor-session';

type RuntimeConfig = {
  voiceEnabled: boolean;
  teacherVoiceId: string;
  ttsProvider: 'inworld' | 'elevenlabs';
  ttsModelId: string;
  speechToTextEnabled: boolean;
};

const defaultRuntimeConfig: RuntimeConfig = {
  voiceEnabled: false,
  teacherVoiceId: 'Ashley',
  ttsProvider: 'inworld',
  ttsModelId: 'inworld-tts-1.5-mini',
  speechToTextEnabled: false,
};

export function TutorExperience() {
  const {
    snapshot,
    phase,
    error,
    isSubmittingTurn,
    startSession: startTutorSession,
    submitTranscript: submitTutorTranscript,
    moveToken,
    chooseEquationAnswer,
  } = useTutorSession();
  const [runtimeStatus, setRuntimeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);
  const [teacherAudioPending, setTeacherAudioPending] = useState(false);
  const [teacherStopSignal, setTeacherStopSignal] = useState(0);

  const startSession = useCallback(
    async (
      input: {
        topic?: string;
        learnerLevel?: string;
        prompt?: string;
      } = {}
    ) => {
      setTeacherSpeaking(false);
      setTeacherAudioPending(true);

      try {
        return await startTutorSession(input);
      } catch (nextError) {
        setTeacherAudioPending(false);
        throw nextError;
      }
    },
    [startTutorSession]
  );

  const submitTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        return;
      }

      setTeacherSpeaking(false);
      setTeacherAudioPending(true);

      try {
        const submitted = await submitTutorTranscript(transcript);
        if (!submitted) {
          setTeacherAudioPending(false);
        }
      } catch (nextError) {
        setTeacherAudioPending(false);
        throw nextError;
      }
    },
    [submitTutorTranscript]
  );

  useEffect(() => {
    let active = true;

    fetch('/api/runtime/config', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Runtime config failed with status ${response.status}`);
        }
        return (await response.json()) as Partial<RuntimeConfig>;
      })
      .then((config) => {
        if (!active) {
          return;
        }
        setRuntimeConfig({
          voiceEnabled: Boolean(config.voiceEnabled),
          teacherVoiceId:
            config.teacherVoiceId || defaultRuntimeConfig.teacherVoiceId,
          ttsProvider:
            config.ttsProvider === 'elevenlabs' ? 'elevenlabs' : 'inworld',
          ttsModelId: config.ttsModelId || defaultRuntimeConfig.ttsModelId,
          speechToTextEnabled: Boolean(config.speechToTextEnabled),
        });
        setRuntimeStatus('ready');
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setRuntimeConfig(defaultRuntimeConfig);
        setRuntimeStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!snapshot && phase === 'intake') {
      queueMicrotask(() => {
        void startSession();
      });
    }
  }, [phase, snapshot, startSession]);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 text-zinc-900">
        <div className="w-full max-w-2xl border border-zinc-200 bg-white p-10 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Live tutor
          </p>
          {phase === 'error' ? (
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-light tracking-tight text-zinc-950">
                Tutor unavailable right now.
              </h1>
              <p className="text-base leading-relaxed text-zinc-600">
                {error || 'The tutor could not start. Try again.'}
              </p>
              <button
                type="button"
                onClick={() => void startSession()}
                className="inline-flex items-center justify-center bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-light tracking-tight text-zinc-950">
                Preparing the tutor conversation...
              </h1>
              <p className="text-base leading-relaxed text-zinc-600">
                Starting a live, model-owned intake so the tutor can ask the first question.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TutorShell
      snapshot={snapshot}
      isSubmittingTurn={isSubmittingTurn}
      speechToTextEnabled={runtimeConfig.speechToTextEnabled}
      voiceEnabled={runtimeConfig.voiceEnabled}
      teacherAudioPending={teacherAudioPending}
      teacherStopSignal={teacherStopSignal}
      ttsProvider={runtimeConfig.ttsProvider}
      ttsModelId={runtimeConfig.ttsModelId}
      teacherVoiceId={runtimeConfig.teacherVoiceId}
      runtimeStatus={runtimeStatus}
      onTranscript={submitTranscript}
      onMoveToken={moveToken}
      onChooseEquationAnswer={chooseEquationAnswer}
      teacherSpeaking={teacherSpeaking}
      onTeacherSpeakingChange={setTeacherSpeaking}
      onTeacherAudioPendingChange={setTeacherAudioPending}
      onTeacherInterrupt={() => {
        setTeacherStopSignal((value) => value + 1);
      }}
    />
  );
}
