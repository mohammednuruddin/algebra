export type AssemblyAiTurnMessage = {
  type?: string;
  transcript?: string;
  turn_is_formatted?: boolean;
  end_of_turn?: boolean;
  words?: Array<{
    word_is_final?: boolean;
  }>;
};

export const ASSEMBLY_STREAM_SAMPLE_RATE = 16000;

export function buildAssemblyAiStreamingQuery(sampleRate = ASSEMBLY_STREAM_SAMPLE_RATE) {
  return new URLSearchParams({
    sample_rate: String(sampleRate),
    speech_model: 'u3-rt-pro',
    format_turns: 'true',
    end_of_turn_confidence_threshold: '0.5',
    min_turn_silence: '160',
    max_turn_silence: '1000',
    vad_threshold: '0.4',
  });
}

export function resolveAssemblyAiCompletedTranscript(payload: AssemblyAiTurnMessage) {
  const transcript = payload.transcript?.trim() || '';
  if (!transcript) {
    return null;
  }

  const lastWord = payload.words?.at(-1);
  if (lastWord?.word_is_final === false) {
    return null;
  }

  if (payload.end_of_turn === true) {
    return transcript;
  }

  if (payload.turn_is_formatted === true) {
    return transcript;
  }

  return null;
}
