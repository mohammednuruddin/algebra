import { ASSEMBLY_STREAM_SAMPLE_RATE } from './assemblyai-streaming';

export const ASSEMBLY_PCM_CHUNK_SAMPLES = Math.round(
  ASSEMBLY_STREAM_SAMPLE_RATE * 0.1
);

export function appendPcmChunks(
  pendingSamples: number[],
  pcm: Int16Array,
  chunkSize = ASSEMBLY_PCM_CHUNK_SAMPLES
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
