import { ELEVENLABS_SCRIBE_SAMPLE_RATE } from './elevenlabs-scribe';

export const ELEVENLABS_PCM_CHUNK_SAMPLES = Math.round(
  ELEVENLABS_SCRIBE_SAMPLE_RATE * 0.1
);

export function appendPcmChunks(
  pendingSamples: number[],
  pcm: Int16Array,
  chunkSize = ELEVENLABS_PCM_CHUNK_SAMPLES
) {
  for (const sample of pcm) {
    pendingSamples.push(sample);
  }

  const chunks: Int16Array[] = [];
  while (pendingSamples.length >= chunkSize) {
    chunks.push(Int16Array.from(pendingSamples.splice(0, chunkSize)));
  }

  return chunks;
}
