'use client';

import { useEffect, useState } from 'react';

import { OnboardingIntake } from '@/components/tutor/onboarding-intake';
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
    startSession,
    submitTranscript,
    moveToken,
    chooseEquationAnswer,
  } = useTutorSession();
  const [runtimeStatus, setRuntimeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);

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

  if (!snapshot || phase === 'intake' || phase === 'preparing' || phase === 'error') {
    return (
      <OnboardingIntake
        onStart={startSession}
        isPreparing={phase === 'preparing'}
        error={error}
        speechToTextEnabled={runtimeConfig.speechToTextEnabled}
        runtimeStatus={runtimeStatus}
        voiceEnabled={runtimeConfig.voiceEnabled}
        ttsProvider={runtimeConfig.ttsProvider}
        ttsModelId={runtimeConfig.ttsModelId}
        teacherVoiceId={runtimeConfig.teacherVoiceId}
      />
    );
  }

  return (
    <TutorShell
      snapshot={snapshot}
      isSubmittingTurn={isSubmittingTurn}
      speechToTextEnabled={runtimeConfig.speechToTextEnabled}
      voiceEnabled={runtimeConfig.voiceEnabled}
      ttsProvider={runtimeConfig.ttsProvider}
      ttsModelId={runtimeConfig.ttsModelId}
      teacherVoiceId={runtimeConfig.teacherVoiceId}
      runtimeStatus={runtimeStatus}
      onTranscript={submitTranscript}
      onMoveToken={moveToken}
      onChooseEquationAnswer={chooseEquationAnswer}
      teacherSpeaking={teacherSpeaking}
      onTeacherSpeakingChange={setTeacherSpeaking}
    />
  );
}
