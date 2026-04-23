import { beforeEach, describe, expect, it, vi } from 'vitest';

import { describeTeachingImage } from './image-analysis';
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

vi.mock('./image-analysis', () => ({
  describeTeachingImage: vi.fn(),
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

  it('uses the shared teaching-image helper for non-svg lesson images', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          images: [
            {
              title: 'Water cycle diagram',
              imageUrl: 'https://example.com/water-cycle.png',
              imageWidth: 1200,
              imageHeight: 900,
              thumbnailUrl: 'https://example.com/thumb.png',
              domain: 'example.com',
              source: 'Example Source',
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
    vi.mocked(describeTeachingImage).mockResolvedValueOnce({
      summary: 'Water cycle diagram showing evaporation and condensation.',
      imageKind: 'diagram',
      showsProcess: true,
      keyObjects: ['water cycle'],
      keyRegions: ['top clouds'],
      teachingValueScore: 8,
      childFriendlinessScore: 7,
      clutterScore: 2,
      suggestedUse: 'Trace the cycle with the learner.',
      tutorGuidance: ['Ask what happens after evaporation.'],
    });

    const result = await searchLessonImages({
      topic: 'water cycle',
      desiredCount: 1,
    });

    expect(describeTeachingImage).toHaveBeenCalledWith({
      imageUrl: 'https://example.com/water-cycle.png',
      topic: 'water cycle',
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(result.assets[0]?.metadata).toMatchObject({
      imageKind: 'diagram',
      showsProcess: true,
    });
  });
});
