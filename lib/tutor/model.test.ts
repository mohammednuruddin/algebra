import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import { generateTutorIntakeTurn } from './model';

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
}));

describe('generateTutorIntakeTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('parses fenced JSON model content with leading whitespace', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `
\`\`\`json
{
  "title": "Live tutor",
  "speech": "What would you like to learn today?",
  "helperText": "Answer naturally.",
  "awaitMode": "voice",
  "readyToStartLesson": false,
  "topic": null,
  "learnerLevel": null
}
\`\`\`
`,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.speech).toBe('What would you like to learn today?');
    expect(result.response.readyToStartLesson).toBe(false);
    expect(result.response).not.toHaveProperty('helperText');
    expect(result.response).not.toHaveProperty('title');
  });

  it('flags invalid awaitMode values instead of treating them as clean output', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'What would you like to learn today?',
                  awaitMode: 'open',
                  readyToStartLesson: false,
                  topic: null,
                  learnerLevel: null,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'turn',
      history: [],
      latestUserMessage: 'Hi.',
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.awaitMode).toBe('voice');
    expect(result.debug.usedFallback).toBe(true);
    expect(result.debug.fallbackReason).toMatch(/awaitmode/i);
  });

  it('starts the lesson once topic and learner level are both known', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: "Are you learning this for a class or just curiosity?",
                  awaitMode: 'voice',
                  readyToStartLesson: false,
                  topic: 'pollination',
                  learnerLevel: 'beginner',
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'turn',
      history: [],
      latestUserMessage: "I'm new.",
      topic: 'pollination',
      learnerLevel: 'beginner',
    });

    expect(result.response.readyToStartLesson).toBe(true);
  });

  it('tells the intake model to stay brief and avoid motivation interviews', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'What would you like to learn today?',
                  awaitMode: 'voice',
                  readyToStartLesson: false,
                  topic: null,
                  learnerLevel: null,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls[0]?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/brief|short/i);
    expect(systemPrompt).toMatch(/motivation|class|curiosity/i);
  });

  it('falls back to a usable intake turn when the provider returns no content', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {},
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.speech).toBe('What would you like to learn today?');
    expect(result.response.awaitMode).toBe('voice');
    expect(result.response.readyToStartLesson).toBe(false);
    expect(result.debug.usedFallback).toBe(true);
    expect(result.debug.fallbackReason).toMatch(/no content/i);
  });
});
