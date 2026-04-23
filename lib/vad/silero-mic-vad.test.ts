import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SileroMicVadController } from './silero-mic-vad';

const mockStart = vi.fn();
const mockPause = vi.fn();
const mockDestroy = vi.fn();
const mockSetOptions = vi.fn();
const mockMicVADNew = vi.fn();

let capturedOptions:
  | {
      model?: string;
      getStream?: () => Promise<MediaStream>;
      resumeStream?: (stream: MediaStream) => Promise<MediaStream>;
      pauseStream?: (stream: MediaStream) => Promise<void>;
      onSpeechStart?: () => void;
      onSpeechRealStart?: () => void;
      onSpeechEnd?: (audio: Float32Array) => void;
      onVADMisfire?: () => void;
    }
  | undefined;

vi.mock('@ricky0123/vad-web', () => ({
  MicVAD: {
    new: (options: unknown) => mockMicVADNew(options),
  },
}));

describe('SileroMicVadController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = undefined;
    mockMicVADNew.mockImplementation(async (options) => {
      capturedOptions = options as typeof capturedOptions;
      return {
        listening: false,
        start: mockStart,
        pause: mockPause,
        destroy: mockDestroy,
        setOptions: mockSetOptions,
      };
    });
  });

  it('forwards provisional barge-in callbacks on speech start', async () => {
    const controller = new SileroMicVadController();
    const stream = { id: 'stream-1' } as MediaStream;
    const onSpeechStart = vi.fn();

    await controller.start(stream, onSpeechStart);

    expect(mockMicVADNew).toHaveBeenCalledTimes(1);
    expect(capturedOptions?.model).toBe('v5');
    await expect(capturedOptions?.getStream?.()).resolves.toBe(stream);

    capturedOptions?.onSpeechStart?.();

    expect(onSpeechStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('reuses the same Silero instance across resumed mic streams', async () => {
    const controller = new SileroMicVadController();
    const firstStream = { id: 'stream-1' } as MediaStream;
    const secondStream = { id: 'stream-2' } as MediaStream;

    await controller.start(firstStream, vi.fn());
    await controller.start(secondStream, vi.fn());

    expect(mockMicVADNew).toHaveBeenCalledTimes(1);
    await expect(capturedOptions?.resumeStream?.(firstStream)).resolves.toBe(secondStream);
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('raises Silero thresholds while the tutor is speaking and relaxes them afterward', async () => {
    const controller = new SileroMicVadController();

    await controller.start({ id: 'stream-1' } as MediaStream, vi.fn());

    controller.setTeacherSpeaking(true);
    controller.setTeacherSpeaking(false);

    expect(mockSetOptions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        positiveSpeechThreshold: expect.any(Number),
        negativeSpeechThreshold: expect.any(Number),
      })
    );
    expect(mockSetOptions).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        positiveSpeechThreshold: expect.any(Number),
        negativeSpeechThreshold: expect.any(Number),
      })
    );
  });

  it('forwards completed speech segments to the supplied speech-end handler', async () => {
    const controller = new SileroMicVadController();
    const onSpeechEnd = vi.fn();
    const audio = new Float32Array([0.2, 0.3]);

    await controller.start({ id: 'stream-1' } as MediaStream, vi.fn(), onSpeechEnd);

    capturedOptions?.onSpeechEnd?.(audio);

    expect(onSpeechEnd).toHaveBeenCalledWith(audio);
  });

  it('forwards VAD misfires to the supplied misfire handler', async () => {
    const controller = new SileroMicVadController();
    const onVADMisfire = vi.fn();

    await controller.start({ id: 'stream-1' } as MediaStream, vi.fn(), undefined, onVADMisfire);

    capturedOptions?.onVADMisfire?.();

    expect(onVADMisfire).toHaveBeenCalledTimes(1);
  });
});
