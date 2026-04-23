import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorGeneratedImageEdits } from '@/lib/types/tutor';

import {
  describeTeachingImage,
  extractEditableImageInventory,
  verifyEditedImageChanges,
} from './image-analysis';

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
}));

function mockOpenRouterJson(content: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

describe('describeTeachingImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns structured teaching guidance for one image', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOpenRouterJson({
        summary: 'Plant cell diagram with major organelles labeled.',
        imageKind: 'diagram',
        showsProcess: false,
        keyObjects: ['plant cell', 'nucleus'],
        keyRegions: ['outer membrane', 'center'],
        teachingValueScore: 8,
        childFriendlinessScore: 7,
        clutterScore: 2,
        suggestedUse: 'Point to each organelle while naming it.',
        tutorGuidance: ['Ask what the nucleus does.'],
      })
    );

    const result = await describeTeachingImage({
      imageUrl: 'https://example.com/cell.png',
      topic: 'plant cells',
    });

    expect(result.summary).toContain('Plant cell');
    expect(result.keyObjects).toContain('nucleus');
    expect(buildOpenRouterRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.objectContaining({
                  url: 'https://example.com/cell.png',
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });
});

describe('extractEditableImageInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns exact visible labels for prompt planning', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOpenRouterJson({
        summary: 'Plant cell diagram.',
        visibleLabels: ['cell membrane', 'cytoplasm', 'nucleus'],
        keyItems: ['large central organelle'],
      })
    );

    const result = await extractEditableImageInventory({
      imageUrl: 'https://example.com/cell.png',
      topic: 'plant cells',
    });

    expect(result.visibleLabels).toEqual(['cell membrane', 'cytoplasm', 'nucleus']);
    expect(result.keyItems).toContain('large central organelle');
  });
});

describe('verifyEditedImageChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns verified remove and swap changes from original and edited images', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOpenRouterJson({
        removedLabelsVerified: ['nucleus'],
        swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
        summary: 'Same diagram with one missing label and one incorrect label.',
        suggestedUse: 'Ask the learner what is missing and what is wrong.',
        tutorGuidance: ['Point at the wrong label first.'],
      })
    );

    const requestedEdits: TutorGeneratedImageEdits = {
      remove: ['nucleus'],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    };

    const result = await verifyEditedImageChanges({
      originalImageUrl: 'https://example.com/original.png',
      editedImageUrl: 'https://example.com/edited.png',
      requestedEdits,
      topic: 'water cycle',
    });

    expect(result.removedLabelsVerified).toEqual(['nucleus']);
    expect(result.swappedLabelsVerified).toEqual([
      { from: 'evaporation', to: 'condensation' },
    ]);
    expect(buildOpenRouterRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.objectContaining({
                  url: 'https://example.com/original.png',
                }),
              }),
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.objectContaining({
                  url: 'https://example.com/edited.png',
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });
});
