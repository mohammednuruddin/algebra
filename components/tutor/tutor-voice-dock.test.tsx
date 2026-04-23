'use client';

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TutorVoiceDock } from './tutor-voice-dock';

const mockSileroStart = vi.fn();
const mockSileroPause = vi.fn();
const mockSileroDestroy = vi.fn();
const mockSileroSetTeacherSpeaking = vi.fn();
let capturedSpeechStart: (() => void) | undefined;
let capturedSpeechEnd: ((audio: Float32Array) => void | Promise<void>) | undefined;
let deferSileroStart = false;
let resolveDeferredSileroStart: (() => void) | null = null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static autoOpenOnConstruct = false;

  readyState = MockWebSocket.CONNECTING;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void | Promise<void>) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
    if (MockWebSocket.autoOpenOnConstruct) {
      queueMicrotask(() => {
        this.open();
      });
    }
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

class MockAudioWorkletNode {
  port = {
    onmessage: null as ((event: { data: Float32Array }) => void) | null,
  };

  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  sampleRate = 16000;
  destination = {};
  audioWorklet = {
    addModule: vi.fn(async () => undefined),
  };

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  close = vi.fn(async () => undefined);
}

vi.mock('@/lib/vad/silero-mic-vad', () => ({
  SileroMicVadController: class {
    start = vi.fn(async (_stream, onSpeechStart?: () => void, onSpeechEnd?: (audio: Float32Array) => void | Promise<void>) => {
      mockSileroStart();
      capturedSpeechStart = onSpeechStart;
      capturedSpeechEnd = onSpeechEnd;
      if (deferSileroStart) {
        await new Promise<void>((resolve) => {
          resolveDeferredSileroStart = resolve;
        });
      }
    });
    pause = mockSileroPause;
    destroy = mockSileroDestroy;
    setTeacherSpeaking = mockSileroSetTeacherSpeaking;
  },
}));

describe('TutorVoiceDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSpeechStart = undefined;
    capturedSpeechEnd = undefined;
    deferSileroStart = false;
    resolveDeferredSileroStart = null;
    MockWebSocket.instances = [];
    MockWebSocket.autoOpenOnConstruct = false;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {
      // Intentionally unresolved: the test only cares whether auto-connect starts.
    })));
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode as unknown as typeof AudioWorkletNode);
    vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext);
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps STT available while the tutor is speaking so the learner can barge in', async () => {
    render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking
        onTranscript={vi.fn()}
      />
    );

    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith('/api/elevenlabs/token', { cache: 'no-store' });
  });

  it('keeps the STT transport warm while tutor audio is still pending', async () => {
    render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherAudioPending
        onTranscript={vi.fn()}
      />
    );

    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith('/api/elevenlabs/token', { cache: 'no-store' });
  });

  it('syncs tutor-speaking state into the Silero VAD controller', () => {
    const { rerender, unmount } = render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking={false}
        onTranscript={vi.fn()}
      />
    );

    expect(mockSileroSetTeacherSpeaking).toHaveBeenLastCalledWith(false);

    rerender(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking
        onTranscript={vi.fn()}
      />
    );

    expect(mockSileroSetTeacherSpeaking).toHaveBeenLastCalledWith(true);

    unmount();

    expect(mockSileroDestroy).toHaveBeenCalledTimes(1);
  });

  it('uses the live streaming transcript for barge-in instead of the slow batch transcription route', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/elevenlabs/token') {
        return new Response(JSON.stringify({ token: 'test-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ transcript: 'slow fallback' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const onTranscript = vi.fn(async () => undefined);
    const onBargeInStart = vi.fn();
    const onBargeInCommit = vi.fn();

    render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking
        teacherSpeechText="Today we are learning fractions and halves."
        onTranscript={onTranscript}
        onBargeInStart={onBargeInStart}
        onBargeInCommit={onBargeInCommit}
      />
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];
    socket?.open();

    capturedSpeechStart?.();

    await socket?.onmessage?.({
      data: JSON.stringify({
        message_type: 'committed_transcript',
        text: 'wait can you repeat that',
      }),
    });

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('wait can you repeat that');
    });

    expect(onBargeInStart).toHaveBeenCalledTimes(1);
    expect(onBargeInCommit).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/elevenlabs/token', { cache: 'no-store' });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/elevenlabs/transcribe',
      expect.anything()
    );
    expect(capturedSpeechEnd).toBeDefined();
  });

  it('does not submit the same barge-in twice when websocket transcription beats the fallback route', async () => {
    let resolveTranscribeResponse: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/api/elevenlabs/token') {
        return Promise.resolve(
          new Response(JSON.stringify({ token: 'test-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      return new Promise<Response>((resolve) => {
        resolveTranscribeResponse = resolve;
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const onTranscript = vi.fn(async () => undefined);
    const onBargeInCommit = vi.fn();

    render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking
        teacherSpeechText="Today we are learning fractions and halves."
        onTranscript={onTranscript}
        onBargeInCommit={onBargeInCommit}
      />
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];
    socket?.open();

    capturedSpeechStart?.();
    const fallbackPromise = capturedSpeechEnd?.(new Float32Array([0.2, 0.3]));

    await socket?.onmessage?.({
      data: JSON.stringify({
        message_type: 'committed_transcript',
        text: 'wait can you repeat that',
      }),
    });

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledTimes(1);
    });

    if (!resolveTranscribeResponse) {
      throw new Error('Expected fallback transcription request');
    }

    const settleTranscribeResponse = resolveTranscribeResponse as (value: Response) => void;

    settleTranscribeResponse(
      new Response(JSON.stringify({ transcript: 'wait can you repeat that' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fallbackPromise;

    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onBargeInCommit).toHaveBeenCalledTimes(1);
  });

  it('survives a cold-start websocket open that happens before Silero finishes booting', async () => {
    vi.useFakeTimers();

    try {
      deferSileroStart = true;
      MockWebSocket.autoOpenOnConstruct = true;

      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ token: 'test-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      render(
        <TutorVoiceDock
          runtimeStatus="ready"
          speechToTextEnabled
          onTranscript={vi.fn()}
        />
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(MockWebSocket.instances).toHaveLength(1);

      await act(async () => {
        resolveDeferredSileroStart?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(8000);
        await Promise.resolve();
      });

      expect(screen.getByText('Listening...')).toBeInTheDocument();
      expect(
        screen.queryByText('Microphone connection timed out. Tap the mic to retry.')
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
