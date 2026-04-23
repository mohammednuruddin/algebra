import { afterEach, describe, expect, it } from 'vitest';

import { resolveDefaultTtsProvider, resolveTtsRuntimeConfig } from './config';

const originalEnv = {
  TTS_PROVIDER: process.env.TTS_PROVIDER,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID,
};

afterEach(() => {
  process.env.TTS_PROVIDER = originalEnv.TTS_PROVIDER;
  process.env.ELEVENLABS_API_KEY = originalEnv.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_VOICE_ID = originalEnv.ELEVENLABS_VOICE_ID;
  process.env.ELEVENLABS_MODEL_ID = originalEnv.ELEVENLABS_MODEL_ID;
});

describe('resolveDefaultTtsProvider', () => {
  it('always resolves to elevenlabs when the runtime is available', () => {
    process.env.TTS_PROVIDER = 'unsupported-provider';
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';

    expect(resolveDefaultTtsProvider()).toBe('elevenlabs');
  });

  it('still falls back to elevenlabs even if no env is configured yet', () => {
    process.env.TTS_PROVIDER = '';
    process.env.ELEVENLABS_API_KEY = '';

    expect(resolveDefaultTtsProvider()).toBe('elevenlabs');
  });
});

describe('resolveTtsRuntimeConfig', () => {
  it('reads the ElevenLabs runtime settings only', () => {
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice-123';
    process.env.ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

    expect(resolveTtsRuntimeConfig()).toEqual({
      provider: 'elevenlabs',
      voiceEnabled: true,
      teacherVoiceId: 'voice-123',
      ttsModelId: 'eleven_flash_v2_5',
    });
  });
});
