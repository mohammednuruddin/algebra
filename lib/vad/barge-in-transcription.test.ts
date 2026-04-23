import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  isLikelyTeacherEcho,
  shouldAcceptBargeInTranscript,
  transcribeVadAudio,
} from './barge-in-transcription';

const mockEncodeWav = vi.fn(() => new ArrayBuffer(8));

vi.mock('@ricky0123/vad-web', () => ({
  utils: {
    encodeWAV: () => mockEncodeWav(),
  },
}));

describe('barge-in transcription helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats transcripts that substantially match the tutor speech as likely echo', () => {
    expect(
      isLikelyTeacherEcho(
        'Today we are learning fractions and halves',
        'Today we are learning fractions and halves.'
      )
    ).toBe(true);
  });

  it('does not treat a different learner reply as tutor echo', () => {
    expect(
      isLikelyTeacherEcho(
        'wait what is the numerator',
        'Today we are learning fractions and halves.'
      )
    ).toBe(false);
  });

  it('rejects short low-signal transcripts while the tutor is speaking', () => {
    expect(
      shouldAcceptBargeInTranscript(
        'new rule',
        'My name is Nuru and I will be your tutor today.'
      )
    ).toBe(false);
  });

  it('requires a teacher speech reference before accepting a barge-in transcript', () => {
    expect(shouldAcceptBargeInTranscript('wait can you repeat that', '')).toBe(false);
  });

  it('accepts clear learner interrupts that differ from the tutor speech', () => {
    expect(
      shouldAcceptBargeInTranscript(
        'wait can you repeat that',
        'Today we are learning fractions and halves.'
      )
    ).toBe(true);
  });

  it('uploads Silero audio as wav and returns the transcript text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: 'please stop' }),
    }) as typeof global.fetch;

    const transcript = await transcribeVadAudio(new Float32Array([0.1, 0.2]));

    expect(mockEncodeWav).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/elevenlabs/transcribe',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
    expect(transcript).toBe('please stop');
  });
});
