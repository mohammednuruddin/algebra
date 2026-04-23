import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from './route';
import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
}));

function buildSnapshot(overrides: Partial<TutorRuntimeSnapshot> = {}): TutorRuntimeSnapshot {
  return {
    sessionId: 'session-1',
    prompt: 'pollination',
    lessonTopic: 'pollination',
    learnerLevel: 'beginner',
    lessonOutline: ['Start from what the learner already knows.'],
    status: 'completed',
    speech: 'Nice work.',
    awaitMode: 'voice',
    speechRevision: 3,
    mediaAssets: [
      {
        id: 'img-1',
        url: 'https://example.com/flower.png',
        altText: 'Flower diagram',
        description: 'Pollination diagram',
      },
    ],
    activeImageId: 'img-1',
    canvas: {
      mode: 'distribution',
      headline: 'Tutor workspace',
      instruction: 'Listen and respond.',
      tokens: [],
      zones: [],
      equation: null,
      fillBlank: null,
      codeBlock: null,
      multipleChoice: null,
      numberLine: null,
      tableGrid: null,
      graphPlot: null,
      matchingPairs: null,
      ordering: null,
      textResponse: null,
      drawing: null,
    },
    turns: [
      {
        actor: 'user',
        text: 'What is pollination?',
        createdAt: '2026-04-22T10:00:00.000Z',
      },
      {
        actor: 'tutor',
        text: 'Pollination moves pollen from the anther to the stigma.',
        createdAt: '2026-04-22T10:00:05.000Z',
      },
    ],
    intake: null,
    ...overrides,
  };
}

describe('POST /api/tutor/article', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('asks the model for a markdown study guide with explicit sections', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Pollination',
                  article_markdown: '# Pollination\n\n## Overview\n\nStudy notes.',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/article', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls[0]?.[0];
    const systemPrompt = String(outbound?.messages?.[0]?.content ?? '');

    expect(response.status).toBe(200);
    expect(systemPrompt).toMatch(/markdown/i);
    expect(systemPrompt).toMatch(/study reference|study guide/i);
    expect(systemPrompt).toMatch(/overview/i);
    expect(systemPrompt).toMatch(/key ideas|worked example|recap|practice/i);
    expect(outbound?.max_tokens).toBe(8000);
  });

  it('stores the first lesson image in article metadata', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Pollination',
                  article_markdown: '# Pollination\n\n## Overview\n\nStudy notes.',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/article', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      article?: {
        metadata_json?: {
          first_image_url?: string;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.article?.metadata_json?.first_image_url).toBe(
      'https://example.com/flower.png'
    );
  });

  it('retries malformed article generations up to a successful third attempt', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Pollination',
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    article_markdown: '',
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Pollination',
                    article_markdown: '# Pollination\n\n## Overview\n\nStudy notes.',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/article', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      article?: { article_markdown?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.article?.article_markdown).toContain('# Pollination');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after three malformed article generations', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Pollination',
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
      )
    );

    const request = new NextRequest('http://localhost:3000/api/tutor/article', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      error?: string;
      debug?: {
        attempts?: Array<{
          attempt: number;
          rawModelContent: string | null;
          parsedResponse: unknown;
          error: string | null;
        }>;
      };
    };

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/invalid format/i);
    expect(payload.error).toMatch(/3 attempts/i);
    expect(payload.debug?.attempts).toHaveLength(3);
    expect(payload.debug?.attempts?.[0]?.attempt).toBe(1);
    expect(payload.debug?.attempts?.[0]?.rawModelContent).toContain('"title":"Pollination"');
    expect(payload.debug?.attempts?.[0]?.error).toMatch(/invalid format/i);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
