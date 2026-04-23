'use client';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TutorShell } from './tutor-shell';
import { createEmptyTutorCanvasState } from '@/lib/tutor/runtime';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

const mockTutorVoiceDock = vi.fn((props: unknown) => {
  void props;
  return <div data-testid="voice-dock">voice dock</div>;
});

const mockTutorVoicePlayer = vi.fn((props: unknown) => {
  void props;
  return null;
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
  TutorVoicePlayer: (props: unknown) => mockTutorVoicePlayer(props),
}));

function buildSnapshot(overrides: Partial<TutorRuntimeSnapshot> = {}): TutorRuntimeSnapshot {
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
      ...createEmptyTutorCanvasState(),
      headline: 'Tutor workspace',
      instruction: 'Listen and respond.',
    },
    turns: [],
    intake: {
      status: 'active',
      topic: null,
      learnerLevel: null,
    },
    ...overrides,
  };
}

describe('TutorShell', () => {
  it('treats new canvas modes as visible stage content', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
          canvas: {
            ...createEmptyTutorCanvasState(),
            mode: 'image_hotspot',
            imageHotspot: {
              prompt: 'Tap the nucleus.',
              backgroundImageUrl: 'https://example.com/cell.png',
              hotspots: [{ id: 'nucleus', label: 'Nucleus', x: 40, y: 40, radius: 12 }],
              selectedHotspotIds: [],
              allowMultiple: false,
              submitted: false,
            },
          },
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    expect(screen.getByTestId('canvas-host')).toBeInTheDocument();
  });

  it('keeps only the centered start surface visible before the live tutor begins', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          speech: 'Welcome to Algebra. Click Start to begin your lesson.',
        })}
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
        isPendingStart
      />
    );

    expect(screen.getByTestId('tutor-start-surface')).toBeInTheDocument();
    expect(screen.getByText(/welcome to algebra\. click start to begin your lesson\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    expect(screen.queryByTestId('tutor-live-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canvas-host')).not.toBeInTheDocument();
  });

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

    fireEvent.click(screen.getByRole('button', { name: /enable voice and mic/i }));

    expect(mockTutorVoiceDock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        teacherSpeaking: false,
        teacherAudioPending: true,
      })
    );
  });

  it('shows a one-tap unlock before arming voice controls', () => {
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

    expect(screen.getByRole('button', { name: /enable voice and mic/i })).toBeInTheDocument();
    expect(screen.queryByTestId('voice-dock')).not.toBeInTheDocument();
    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('arms the current tutor turn after the learner unlocks browser voice controls', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /enable voice and mic/i }));

    expect(screen.getByTestId('voice-dock')).toBeInTheDocument();
    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it('shows an in-shell loading state after Start is clicked and before the first tutor turn arrives', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          speech: 'Starting your live tutor. One sec...',
        })}
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
        isStartingSession
      />
    );

    expect(
      screen.getAllByText(/starting your live tutor\. one sec/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('tutor-start-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('tutor-live-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('voice-dock')).not.toBeInTheDocument();
    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('pauses tutor playback during provisional barge-in and resumes it when rejected', () => {
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
        teacherSpeaking
        onTeacherSpeakingChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /enable voice and mic/i }));

    const dockProps = mockTutorVoiceDock.mock.lastCall?.[0] as {
      onBargeInStart?: () => void;
      onBargeInCancel?: () => void;
    };

    act(() => {
      dockProps.onBargeInStart?.();
    });

    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ paused: true })
    );

    act(() => {
      dockProps.onBargeInCancel?.();
    });

    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ paused: false })
    );
  });

  it('does not render a blank canvas stage when the tutor is only speaking', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    expect(screen.queryByTestId('canvas-host')).not.toBeInTheDocument();
  });

  it('shows the active image in the stage area when the tutor references it', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/leaf.png',
              altText: 'Leaf diagram',
              description: 'Photosynthesis diagram',
            },
          ],
          activeImageId: 'img-1',
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    expect(screen.getByTestId('active-image-stage')).toBeInTheDocument();
  });

  it('hides the standalone image stage when drawing mode already owns the image', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/flower.png',
              altText: 'Flower diagram',
              description: 'Pollination diagram',
            },
          ],
          activeImageId: 'img-1',
          canvas: {
            ...buildSnapshot().canvas,
            mode: 'drawing',
            drawing: {
              prompt: 'Mark the anther.',
              backgroundImageUrl: 'https://example.com/flower.png',
              canvasWidth: 800,
              canvasHeight: 600,
              brushColor: '#000000',
              brushSize: 3,
              submitted: false,
            },
          },
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    expect(screen.queryByTestId('active-image-stage')).not.toBeInTheDocument();
    expect(screen.getByTestId('canvas-host')).toBeInTheDocument();
  });

  it('hides the standalone image stage when image hotspot mode already owns the image', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/curve.png',
              altText: 'Gradient descent curve',
              description: 'Ball rolling downhill',
            },
          ],
          activeImageId: 'img-1',
          canvas: {
            ...buildSnapshot().canvas,
            mode: 'image_hotspot',
            imageHotspot: {
              prompt: 'Tap where the ball rolls next.',
              backgroundImageUrl: 'https://example.com/curve.png',
              hotspots: [
                { id: 'downhill', label: 'Downhill', x: 70, y: 60, radius: 15 },
              ],
              selectedHotspotIds: [],
              allowMultiple: false,
              submitted: false,
            },
          },
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    expect(screen.queryByTestId('active-image-stage')).not.toBeInTheDocument();
    expect(screen.getByTestId('canvas-host')).toBeInTheDocument();
  });

  it('keeps the interaction stage shrinkable so canvas work stays inside the viewport', () => {
    render(
      <TutorShell
        snapshot={buildSnapshot({
          intake: null,
          canvas: {
            ...buildSnapshot().canvas,
            mode: 'code_block',
            codeBlock: {
              prompt: 'Write a print statement.',
              language: 'python',
              starterCode: 'print("hi")',
              userCode: 'print("hi")',
              expectedOutput: 'hi',
              submitted: false,
            },
          },
        })}
        speechToTextEnabled={false}
        voiceEnabled={false}
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

    const canvasHost = screen.getByTestId('canvas-host');

    expect(canvasHost.parentElement).toHaveClass('min-w-0');
    expect(canvasHost.parentElement?.parentElement).toHaveClass('min-w-0');
    expect(canvasHost.parentElement?.parentElement).toHaveClass('overflow-x-hidden');
  });
});
