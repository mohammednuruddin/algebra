export type TtsProvider = 'inworld' | 'elevenlabs';

export interface TtsRuntimeConfig {
  provider: TtsProvider;
  voiceEnabled: boolean;
  teacherVoiceId: string;
  ttsModelId: string;
}

const DEFAULT_INWORLD_VOICE_ID = 'Ashley';
const DEFAULT_INWORLD_MODEL_ID = 'inworld-tts-1.5-mini';
const DEFAULT_ELEVENLABS_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5';

export function resolveDefaultTtsProvider(): TtsProvider {
  const requested = process.env.TTS_PROVIDER?.trim().toLowerCase();

  if (requested === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
    return 'elevenlabs';
  }

  if (requested === 'inworld' && process.env.INWORLD_API_KEY) {
    return 'inworld';
  }

  // Prefer ElevenLabs when both keys are available (more reliable)
  if (process.env.ELEVENLABS_API_KEY) {
    return 'elevenlabs';
  }

  if (process.env.INWORLD_API_KEY) {
    return 'inworld';
  }

  return 'elevenlabs';
}

export function resolveTtsRuntimeConfig(): TtsRuntimeConfig {
  const provider = resolveDefaultTtsProvider();

  if (provider === 'inworld') {
    return {
      provider,
      voiceEnabled: Boolean(process.env.INWORLD_API_KEY),
      teacherVoiceId:
        process.env.INWORLD_TTS_VOICE_ID || DEFAULT_INWORLD_VOICE_ID,
      ttsModelId:
        process.env.INWORLD_TTS_MODEL_ID || DEFAULT_INWORLD_MODEL_ID,
    };
  }

  return {
    provider,
    voiceEnabled: Boolean(process.env.ELEVENLABS_API_KEY),
    teacherVoiceId:
      process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID,
    ttsModelId:
      process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID,
  };
}

export function coerceTtsProvider(value: unknown): TtsProvider | null {
  return value === 'inworld' || value === 'elevenlabs' ? value : null;
}
