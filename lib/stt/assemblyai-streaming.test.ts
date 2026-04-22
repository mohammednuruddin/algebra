import { describe, expect, it } from 'vitest';

import {
  ASSEMBLY_STREAM_SAMPLE_RATE,
  buildAssemblyAiStreamingQuery,
  resolveAssemblyAiCompletedTranscript,
} from './assemblyai-streaming';

describe('AssemblyAI streaming helpers', () => {
  it('builds the websocket query with current documented turn-detection parameters', () => {
    const query = buildAssemblyAiStreamingQuery();

    expect(query.get('sample_rate')).toBe(String(ASSEMBLY_STREAM_SAMPLE_RATE));
    expect(query.get('speech_model')).toBe('u3-rt-pro');
    expect(query.get('format_turns')).toBe('true');
    expect(query.get('min_turn_silence')).toBe('160');
    expect(query.get('max_turn_silence')).toBe('1000');
    expect(query.has('min_end_of_turn_silence_when_confident')).toBe(false);
  });

  it('treats end_of_turn as the primary completion signal', () => {
    expect(
      resolveAssemblyAiCompletedTranscript({
        type: 'Turn',
        transcript: 'hello there',
        end_of_turn: true,
      })
    ).toBe('hello there');
  });

  it('falls back to turn_is_formatted when needed', () => {
    expect(
      resolveAssemblyAiCompletedTranscript({
        type: 'Turn',
        transcript: 'hello there',
        turn_is_formatted: true,
      })
    ).toBe('hello there');
  });

  it('does not finalize a transcript when the last word is still unstable', () => {
    expect(
      resolveAssemblyAiCompletedTranscript({
        type: 'Turn',
        transcript: 'how is',
        end_of_turn: true,
        words: [{ word_is_final: false }],
      })
    ).toBeNull();
  });
});
