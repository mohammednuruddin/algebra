export type ElevenLabsScribeMessage = {
  message_type?: string;
  text?: string;
  error?: string;
};

export const ELEVENLABS_SCRIBE_SAMPLE_RATE = 16000;
const ELEVENLABS_SCRIBE_REALTIME_MODEL_ID = 'scribe_v2_realtime';
const ELEVENLABS_SCRIBE_REALTIME_BASE_URL =
  'wss://api.elevenlabs.io/v1/speech-to-text/realtime';

export function buildElevenLabsScribeRealtimeUrl(token: string) {
  const params = new URLSearchParams({
    model_id: ELEVENLABS_SCRIBE_REALTIME_MODEL_ID,
    token,
    commit_strategy: 'vad',
    audio_format: 'pcm_16000',
    vad_silence_threshold_secs: '1.5',
    vad_threshold: '0.4',
    min_speech_duration_ms: '100',
    min_silence_duration_ms: '100',
  });

  return `${ELEVENLABS_SCRIBE_REALTIME_BASE_URL}?${params.toString()}`;
}

export function encodePcm16ChunkToBase64(chunk: Int16Array) {
  const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }

  throw new Error('Base64 encoding is unavailable');
}

export function resolveElevenLabsCommittedTranscript(payload: ElevenLabsScribeMessage) {
  if (
    payload.message_type !== 'committed_transcript' &&
    payload.message_type !== 'committed_transcript_with_timestamps'
  ) {
    return null;
  }

  const text = payload.text?.trim() || '';
  return text || null;
}
