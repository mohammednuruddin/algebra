import { describe, expect, it } from 'vitest';

import {
  isMeaningfulTutorTranscript,
  shouldTriggerTutorBargeIn,
  shouldAutoStartTutorLesson,
} from './intake-heuristics';

describe('tutor intake heuristics', () => {
  it('rejects filler and trailing continuation fragments', () => {
    expect(isMeaningfulTutorTranscript('Hi.')).toBe(false);
    expect(isMeaningfulTutorTranscript('Um,')).toBe(false);
    expect(isMeaningfulTutorTranscript('How is—')).toBe(false);
    expect(isMeaningfulTutorTranscript('Do just-')).toBe(false);
  });

  it('accepts real learner content', () => {
    expect(isMeaningfulTutorTranscript('Pollination.')).toBe(true);
    expect(isMeaningfulTutorTranscript('How does pollination work?')).toBe(true);
  });

  it('auto-starts once topic and rough level are known', () => {
    expect(
      shouldAutoStartTutorLesson({
        topic: 'pollination',
        learnerLevel: 'beginner',
        latestUserMessage: "I'm new.",
      })
    ).toBe(true);
  });

  it('auto-starts when the learner asks a direct content question on a known topic', () => {
    expect(
      shouldAutoStartTutorLesson({
        topic: 'pollination',
        learnerLevel: null,
        latestUserMessage: 'How does pollination work?',
      })
    ).toBe(true);
  });

  it('triggers barge-in only for real speech energy while the tutor is talking', () => {
    expect(
      shouldTriggerTutorBargeIn({
        teacherSpeaking: true,
        voiceLevel: 0.08,
      })
    ).toBe(true);

    expect(
      shouldTriggerTutorBargeIn({
        teacherSpeaking: false,
        voiceLevel: 0.08,
      })
    ).toBe(false);

    expect(
      shouldTriggerTutorBargeIn({
        teacherSpeaking: true,
        voiceLevel: 0.01,
      })
    ).toBe(false);
  });
});
