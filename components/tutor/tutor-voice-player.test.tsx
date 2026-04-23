'use client';

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TutorVoicePlayer } from './tutor-voice-player';

class MockAudio {
  static playImpl = vi.fn<() => Promise<void>>();
  static instances: MockAudio[] = [];
  src: string;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn<() => Promise<void>>(() => MockAudio.playImpl());
  pause = vi.fn();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('TutorVoicePlayer', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    MockAudio.instances = [];
    MockAudio.playImpl = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        })
      )
    );
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:audio'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('only marks tutor speaking after playback actually starts', async () => {
    const onStart = vi.fn();
    const onError = vi.fn();
    MockAudio.playImpl = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('NotAllowedError'));

    render(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        onStart={onStart}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    expect(onStart).not.toHaveBeenCalled();
  });

  it('clears the busy state if a pending tutor audio request is interrupted', async () => {
    const onRequestStart = vi.fn();
    const onComplete = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {
        // Intentionally unresolved; cleanup should still clear the busy state.
      }))
    );

    const { unmount } = render(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        onRequestStart={onRequestStart}
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(onRequestStart).toHaveBeenCalled();
    });

    unmount();

    expect(onComplete).toHaveBeenCalled();
  });

  it('times out hung tutor audio requests', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn((_, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => {
            reject(signal.reason instanceof Error ? signal.reason : new Error('Audio request aborted'));
          });
        })
      )
    );

    render(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        onError={onError}
      />
    );

    await vi.advanceTimersByTimeAsync(15000);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tutor audio request timed out' }));
  });

  it('stops active tutor playback when a barge-in stop signal arrives', async () => {
    const onComplete = vi.fn();

    const { rerender } = render(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        stopSignal={0}
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(MockAudio.playImpl).toHaveBeenCalled();
    });

    const audioInstance = MockAudio.instances[0];

    rerender(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        stopSignal={1}
        onComplete={onComplete}
      />
    );

    expect(audioInstance?.pause).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('pauses and resumes active tutor playback while barge-in is being verified', async () => {
    const { rerender } = render(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        paused={false}
      />
    );

    await waitFor(() => {
      expect(MockAudio.playImpl).toHaveBeenCalledTimes(1);
    });

    const audioInstance = MockAudio.instances[0];

    rerender(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        paused
      />
    );

    expect(audioInstance?.pause).toHaveBeenCalledTimes(1);

    rerender(
      <TutorVoicePlayer
        text="Hello there"
        voiceId="voice-1"
        provider="elevenlabs"
        modelId="eleven_flash_v2_5"
        enabled
        playToken={1}
        paused={false}
      />
    );

    await waitFor(() => {
      expect(audioInstance?.play).toHaveBeenCalledTimes(2);
    });
  });
});
