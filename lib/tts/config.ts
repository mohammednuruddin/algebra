export type TtsProvider = 'elevenlabs';

export interface TtsRuntimeConfig {
  provider: TtsProvider;
  voiceEnabled: boolean;
  teacherVoiceId: string;
  ttsModelId: string;
}

const DEFAULT_ELEVENLABS_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

export function resolveDefaultTtsProvider(): TtsProvider {
  return 'elevenlabs';
}

export function resolveTtsRuntimeConfig(): TtsRuntimeConfig {
  return {
    provider: resolveDefaultTtsProvider(),
    voiceEnabled: Boolean(process.env.ELEVENLABS_API_KEY),
    teacherVoiceId:
      process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID,
    ttsModelId:
      process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID,
  };
}

export function coerceTtsProvider(value: unknown): TtsProvider | null {
  return value === 'elevenlabs' ? value : null;
}
