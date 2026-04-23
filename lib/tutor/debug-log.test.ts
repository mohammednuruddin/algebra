import { describe, expect, it } from 'vitest';

import { formatTutorDebugMessages } from './debug-log';

describe('formatTutorDebugMessages', () => {
  it('expands structured multimodal history and truncates image payload urls', () => {
    const formatted = formatTutorDebugMessages([
      {
        role: 'system',
        content: 'You are a tutor.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Latest learner turn (structured JSON): {"mode":"text_response"}',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,' + 'a'.repeat(512),
              detail: 'high',
            },
          },
        ],
      },
    ]);

    expect(formatted).toEqual([
      {
        role: 'system',
        content: 'You are a tutor.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Latest learner turn (structured JSON): {"mode":"text_response"}',
          },
          {
            type: 'image_url',
            image_url: {
              url: expect.stringMatching(/^data:image\/png;base64,[a]+… \[\d+ chars\]$/),
              detail: 'high',
            },
          },
        ],
      },
    ]);
  });
});
