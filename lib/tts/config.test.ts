import { afterEach, describe, expect, it } from 'vitest';

import { resolveDefaultTtsProvider } from './config';

const originalEnv = {
  TTS_PROVIDER: process.env.TTS_PROVIDER,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  INWORLD_API_KEY: process.env.INWORLD_API_KEY,
};

afterEach(() => {
  process.env.TTS_PROVIDER = originalEnv.TTS_PROVIDER;
  process.env.ELEVENLABS_API_KEY = originalEnv.ELEVENLABS_API_KEY;
  process.env.INWORLD_API_KEY = originalEnv.INWORLD_API_KEY;
});

describe('resolveDefaultTtsProvider', () => {
  it('uses inworld by default when both providers are configured', () => {
    process.env.TTS_PROVIDER = '';
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';
    process.env.INWORLD_API_KEY = 'inworld-key';

    expect(resolveDefaultTtsProvider()).toBe('inworld');
  });

  it('honors an explicit inworld provider when both providers are configured', () => {
    process.env.TTS_PROVIDER = 'inworld';
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';
    process.env.INWORLD_API_KEY = 'inworld-key';

    expect(resolveDefaultTtsProvider()).toBe('inworld');
  });

  it('honors an explicit elevenlabs provider when both providers are configured', () => {
    process.env.TTS_PROVIDER = 'elevenlabs';
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';
    process.env.INWORLD_API_KEY = 'inworld-key';

    expect(resolveDefaultTtsProvider()).toBe('elevenlabs');
  });

  it('uses inworld when it is the only configured provider', () => {
    process.env.TTS_PROVIDER = 'inworld';
    process.env.ELEVENLABS_API_KEY = '';
    process.env.INWORLD_API_KEY = 'inworld-key';

    expect(resolveDefaultTtsProvider()).toBe('inworld');
  });
});
