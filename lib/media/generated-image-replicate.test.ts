import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createReplicatePrediction } from './generated-image-replicate';

describe('createReplicatePrediction', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'pred_123', status: 'starting' }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    );
    process.env.REPLICATE_API_TOKEN = 'replicate_test_token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.REPLICATE_API_TOKEN;
  });

  it('creates an async low-quality prediction with webhook completion only', async () => {
    const prediction = await createReplicatePrediction({
      mode: 'generate',
      prompt: 'Create a water cycle diagram',
      webhookUrl: 'https://example.com/api/tutor/image-generation/webhook',
    });

    expect(prediction).toEqual({ id: 'pred_123', status: 'starting' });
    expect(fetch).toHaveBeenCalledTimes(1);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer replicate_test_token',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(String(init?.body)) as {
      input: Record<string, unknown>;
      webhook: string;
      webhook_events_filter: string[];
    };

    expect(body.webhook).toBe('https://example.com/api/tutor/image-generation/webhook');
    expect(body.webhook_events_filter).toEqual(['completed']);
    expect(body.input).toMatchObject({
      prompt: 'Create a water cycle diagram',
      quality: 'low',
      number_of_images: 1,
      output_format: 'webp',
    });
    expect(body.input).not.toHaveProperty('input_images');
  });

  it('includes input images only for edit predictions', async () => {
    await createReplicatePrediction({
      mode: 'edit',
      prompt: "Swap label 'evaporation' with 'condensation'",
      inputImages: ['https://example.com/original.png'],
      aspectRatio: '1:1',
      outputFormat: 'jpeg',
      webhookUrl: 'https://example.com/api/tutor/image-generation/webhook',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as {
      input: Record<string, unknown>;
    };

    expect(body.input).toMatchObject({
      prompt: "Swap label 'evaporation' with 'condensation'",
      quality: 'low',
      number_of_images: 1,
      output_format: 'jpeg',
      aspect_ratio: '1:1',
      input_images: ['https://example.com/original.png'],
    });
  });

  it('rejects input images for generate mode', async () => {
    await expect(
      createReplicatePrediction({
        mode: 'generate',
        prompt: 'Create a diagram',
        webhookUrl: 'https://example.com/api/tutor/image-generation/webhook',
        inputImages: ['https://example.com/original.png'] as never,
      })
    ).rejects.toThrow('inputImages can only be used with edit mode');
  });

  it('throws when Replicate rejects the prediction request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    await expect(
      createReplicatePrediction({
        mode: 'generate',
        prompt: 'Create a diagram',
        webhookUrl: 'https://example.com/api/tutor/image-generation/webhook',
      })
    ).rejects.toThrow('Replicate prediction failed with status 400');
  });
});
