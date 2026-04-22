'use client';

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TutorVoiceDock } from './tutor-voice-dock';

describe('TutorVoiceDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {
      // Intentionally unresolved: the test only cares whether auto-connect starts.
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps STT available while the tutor is speaking so the learner can barge in', async () => {
    render(
      <TutorVoiceDock
        runtimeStatus="ready"
        speechToTextEnabled
        teacherSpeaking
        onTranscript={vi.fn()}
      />
    );

    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith('/api/assemblyai/token', { cache: 'no-store' });
  });
});
