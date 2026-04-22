import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchLessonImages } from './lesson-image-search';

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
}));

describe('searchLessonImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SERPER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('skips multimodal description for svg images and still returns a usable asset', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [
              {
                title: 'Human digestive system - Wikipedia',
                imageUrl:
                  'https://upload.wikimedia.org/wikipedia/commons/c/c5/Digestive_system_diagram_en.svg',
                imageWidth: 900,
                imageHeight: 1200,
                domain: 'wikipedia.org',
                source: 'Wikipedia',
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

    const result = await searchLessonImages({
      topic: 'digestion',
      desiredCount: 1,
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.description).toMatch(/digestive system/i);
  });
});
