import { describe, expect, it } from 'vitest';

import {
  ELEVENLABS_SCRIBE_SAMPLE_RATE,
  buildElevenLabsScribeRealtimeUrl,
  encodePcm16ChunkToBase64,
  resolveElevenLabsCommittedTranscript,
} from './elevenlabs-scribe';

describe('elevenlabs scribe helpers', () => {
  it('builds the realtime URL with the current scribe VAD parameters', () => {
    const url = new URL(buildElevenLabsScribeRealtimeUrl('test-token'));

    expect(url.origin).toBe('wss://api.elevenlabs.io');
    expect(url.pathname).toBe('/v1/speech-to-text/realtime');
    expect(url.searchParams.get('model_id')).toBe('scribe_v2_realtime');
    expect(url.searchParams.get('token')).toBe('test-token');
    expect(url.searchParams.get('commit_strategy')).toBe('vad');
    expect(url.searchParams.get('audio_format')).toBe('pcm_16000');
    expect(url.searchParams.get('vad_silence_threshold_secs')).toBe('1.5');
    expect(url.searchParams.get('vad_threshold')).toBe('0.4');
    expect(url.searchParams.get('min_speech_duration_ms')).toBe('100');
    expect(url.searchParams.get('min_silence_duration_ms')).toBe('100');
    expect(url.searchParams.get('sample_rate')).toBeNull();
  });

  it('encodes 16-bit PCM chunks as base64', () => {
    const chunk = Int16Array.from([1, -2, 32767, -32768]);

    expect(encodePcm16ChunkToBase64(chunk)).toBe(
      Buffer.from(new Uint8Array(chunk.buffer)).toString('base64')
    );
  });

  it('treats committed transcript events as completed learner turns', () => {
    expect(
      resolveElevenLabsCommittedTranscript({
        message_type: 'committed_transcript',
        text: 'wait can you repeat that',
      })
    ).toBe('wait can you repeat that');
  });

  it('also accepts committed transcript events with timestamps', () => {
    expect(
      resolveElevenLabsCommittedTranscript({
        message_type: 'committed_transcript_with_timestamps',
        text: 'please slow down',
      })
    ).toBe('please slow down');
  });

  it('does not finalize partial transcript events', () => {
    expect(
      resolveElevenLabsCommittedTranscript({
        message_type: 'partial_transcript',
        text: 'please',
      })
    ).toBeNull();
  });

  it('keeps the scribe sample rate at 16 kHz', () => {
    expect(ELEVENLABS_SCRIBE_SAMPLE_RATE).toBe(16000);
  });
});
