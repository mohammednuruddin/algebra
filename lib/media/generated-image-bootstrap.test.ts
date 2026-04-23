import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBuildOpenRouterRequest,
  mockExtractEditableImageInventory,
  mockCreateAdminClient,
  mockCreateTutorImageGenerationJob,
  mockCreateReplicatePrediction,
} = vi.hoisted(() => ({
  mockBuildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
  mockExtractEditableImageInventory: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockCreateTutorImageGenerationJob: vi.fn(),
  mockCreateReplicatePrediction: vi.fn(),
}));

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: mockBuildOpenRouterRequest,
}));

vi.mock('@/lib/media/image-analysis', () => ({
  extractEditableImageInventory: mockExtractEditableImageInventory,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock('@/lib/media/generated-image-jobs', () => ({
  createTutorImageGenerationJob: mockCreateTutorImageGenerationJob,
}));

vi.mock('@/lib/media/generated-image-replicate', () => ({
  createReplicatePrediction: mockCreateReplicatePrediction,
}));

import { queueTutorGeneratedImages } from './generated-image-bootstrap';

describe('queueTutorGeneratedImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env.REPLICATE_API_TOKEN = 'replicate-token';
    mockCreateAdminClient.mockReturnValue({ from: vi.fn() });
    mockExtractEditableImageInventory.mockResolvedValue({
      summary: 'Plant cell diagram.',
      visibleLabels: ['cell membrane', 'nucleus'],
      keyItems: ['large central organelle'],
    });
    mockCreateReplicatePrediction
      .mockResolvedValueOnce({ id: 'pred_generate' })
      .mockResolvedValueOnce({ id: 'pred_edit' });
    mockCreateTutorImageGenerationJob.mockResolvedValue({ id: 'job_1' });
  });

  it('plans and queues generate and edit jobs using image inventories', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  jobs: [
                    {
                      kind: 'generate_new',
                      purpose: 'teaching_visual',
                      prompt: 'clear educational diagram of the water cycle',
                      aspectRatio: '1:1',
                    },
                    {
                      kind: 'edit_variant',
                      purpose: 'quiz_unlabeled',
                      sourceImageId: 'img-1',
                      actions: {
                        remove: ['nucleus'],
                        swap: [],
                      },
                    },
                  ],
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

    await queueTutorGeneratedImages({
      sessionId: 'tutor_123',
      topic: 'water cycle',
      learnerLevel: 'beginner',
      outline: ['Start with the main cycle.'],
      imageAssets: [
        {
          id: 'img-1',
          url: 'https://example.com/original.png',
          altText: 'Water cycle diagram',
          description: 'Water cycle diagram',
        },
      ],
      origin: 'http://localhost:3000',
    });

    expect(mockExtractEditableImageInventory).toHaveBeenCalledWith({
      imageUrl: 'https://example.com/original.png',
      topic: 'water cycle',
    });
    expect(mockCreateReplicatePrediction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: 'generate',
        prompt: 'clear educational diagram of the water cycle',
      })
    );
    expect(mockCreateReplicatePrediction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: 'edit',
        inputImages: ['https://example.com/original.png'],
        webhookUrl: 'http://localhost:3000/api/tutor/image-generation/webhook',
      })
    );
    expect(mockCreateTutorImageGenerationJob).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        sessionId: 'tutor_123',
        predictionId: 'pred_edit',
        sourceType: 'edit',
        sourceImageId: 'img-1',
        sourceImageUrl: 'https://example.com/original.png',
        requestedEditsJson: {
          remove: ['nucleus'],
          swap: [],
        },
      })
    );
  });
});
