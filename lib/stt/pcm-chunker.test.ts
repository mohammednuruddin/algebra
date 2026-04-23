import { describe, expect, it } from 'vitest';

import {
  appendPcmChunks,
  ELEVENLABS_PCM_CHUNK_SAMPLES,
} from './pcm-chunker';

describe('appendPcmChunks', () => {
  it('waits until enough audio is buffered before emitting a chunk', () => {
    const pending: number[] = [];

    const early = appendPcmChunks(
      pending,
      new Int16Array(ELEVENLABS_PCM_CHUNK_SAMPLES - 10)
    );
    expect(early).toHaveLength(0);

    const ready = appendPcmChunks(pending, new Int16Array(10));
    expect(ready).toHaveLength(1);
    expect(ready[0]).toHaveLength(ELEVENLABS_PCM_CHUNK_SAMPLES);
    expect(pending).toHaveLength(0);
  });

  it('emits multiple chunks when enough buffered audio is present', () => {
    const pending: number[] = [];

    const chunks = appendPcmChunks(
      pending,
      new Int16Array(ELEVENLABS_PCM_CHUNK_SAMPLES * 2 + 25)
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(ELEVENLABS_PCM_CHUNK_SAMPLES);
    expect(chunks[1]).toHaveLength(ELEVENLABS_PCM_CHUNK_SAMPLES);
    expect(pending).toHaveLength(25);
  });
});
