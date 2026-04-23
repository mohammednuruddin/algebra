'use client';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingIntake } from './onboarding-intake';

const mockTutorVoiceDock = vi.fn((props: unknown) => {
  void props;
  return <div data-testid="voice-dock">voice dock</div>;
});

const mockTutorVoicePlayer = vi.fn((props: unknown) => {
  void props;
  return null;
});

vi.mock('@/components/tutor/tutor-speech', () => ({
  TutorSpeech: ({ speech }: { speech: string }) => <div>{speech}</div>,
}));

vi.mock('@/components/tutor/tutor-voice-dock', () => ({
  TutorVoiceDock: (props: unknown) => mockTutorVoiceDock(props),
}));

vi.mock('@/components/tutor/tutor-voice-player', () => ({
  TutorVoicePlayer: (props: unknown) => mockTutorVoicePlayer(props),
}));

describe('OnboardingIntake', () => {
  it('passes the current teacher speech into the shared voice dock', () => {
    render(
      <OnboardingIntake
        onStart={vi.fn()}
        runtimeStatus="ready"
        speechToTextEnabled
        voiceEnabled
        ttsProvider="elevenlabs"
        ttsModelId="eleven_flash_v2_5"
        teacherVoiceId="voice-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /begin session/i }));

    expect(mockTutorVoiceDock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        teacherSpeechText: 'What do you want to learn? You can say it or type it.',
      })
    );
  });

  it('stops onboarding tutor playback when the learner barges in', async () => {
    render(
      <OnboardingIntake
        onStart={vi.fn()}
        runtimeStatus="ready"
        speechToTextEnabled
        voiceEnabled
        ttsProvider="elevenlabs"
        ttsModelId="eleven_flash_v2_5"
        teacherVoiceId="voice-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /begin session/i }));

    const dockProps = mockTutorVoiceDock.mock.lastCall?.[0] as {
      onBargeInStart?: () => void;
      onBargeInCommit?: () => void;
    };

    act(() => {
      dockProps.onBargeInStart?.();
    });

    expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paused: true,
      })
    );

    act(() => {
      dockProps.onBargeInCommit?.();
    });

    await waitFor(() => {
      expect(mockTutorVoicePlayer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          stopSignal: 1,
        })
      );
    });
  });
});
