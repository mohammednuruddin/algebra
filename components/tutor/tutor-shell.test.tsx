'use client';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TutorShell } from './tutor-shell';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

const mockTutorVoiceDock = vi.fn((props: unknown) => {
  void props;
  return <div data-testid="voice-dock">voice dock</div>;
});

vi.mock('@/components/tutor/tutor-canvas-host', () => ({
  TutorCanvasHost: () => <div data-testid="canvas-host">canvas</div>,
}));

vi.mock('@/components/tutor/tutor-speech', () => ({
  TutorSpeech: ({ speech }: { speech: string }) => <div>{speech}</div>,
}));

vi.mock('@/components/tutor/tutor-voice-dock', () => ({
  TutorVoiceDock: (props: unknown) => mockTutorVoiceDock(props),
}));

vi.mock('@/components/tutor/tutor-voice-player', () => ({
  TutorVoicePlayer: () => null,
}));

function buildSnapshot(): TutorRuntimeSnapshot {
  return {
    sessionId: 'session-1',
    prompt: '',
    lessonTopic: '',
    learnerLevel: 'unknown',
    lessonOutline: [],
    status: 'active',
    speech: 'What would you like to learn today?',
    awaitMode: 'voice',
    speechRevision: 1,
    mediaAssets: [],
    activeImageId: null,
    canvas: {
      mode: 'distribution',
      headline: 'Tutor workspace',
      instruction: 'Listen and respond.',
      tokens: [],
      zones: [],
      equation: null,
    },
    turns: [],
    intake: {
      status: 'active',
      topic: null,
      learnerLevel: null,
    },
  };
}

describe('TutorShell', () => {
  it('suppresses microphone auto-listen while tutor audio is still pending', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot()}
        speechToTextEnabled
        voiceEnabled
        teacherAudioPending
        ttsProvider="elevenlabs"
        ttsModelId="eleven_turbo_v2_5"
        teacherVoiceId="voice-1"
        runtimeStatus="ready"
        onTranscript={vi.fn()}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        teacherSpeaking={false}
        onTeacherSpeakingChange={vi.fn()}
      />
    );

    expect(mockTutorVoiceDock).toHaveBeenLastCalledWith(
      expect.objectContaining({ teacherSpeaking: true })
    );
  });

  it('shows the voice dock immediately without a separate unlock click', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot()}
        speechToTextEnabled
        voiceEnabled
        ttsProvider="elevenlabs"
        ttsModelId="eleven_turbo_v2_5"
        teacherVoiceId="voice-1"
        runtimeStatus="ready"
        onTranscript={vi.fn()}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        teacherSpeaking={false}
        onTeacherSpeakingChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('voice-dock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enable voice and mic/i })).not.toBeInTheDocument();
  });
});
