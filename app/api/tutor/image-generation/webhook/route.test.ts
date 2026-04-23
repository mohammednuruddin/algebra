import { createHmac } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const {
  mockCreateAdminClient,
  mockClaimJobForProcessing,
  mockGetJobByPredictionId,
  mockDescribeTeachingImage,
  mockVerifyEditedImageChanges,
  mockRenewProcessingLease,
  mockNormalizeRequestedEditsJson,
  mockMarkCompleted,
  mockMarkFailed,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockClaimJobForProcessing: vi.fn(),
  mockGetJobByPredictionId: vi.fn(),
  mockDescribeTeachingImage: vi.fn(),
  mockVerifyEditedImageChanges: vi.fn(),
  mockRenewProcessingLease: vi.fn(),
  mockNormalizeRequestedEditsJson: vi.fn(),
  mockMarkCompleted: vi.fn(),
  mockMarkFailed: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock('@/lib/media/generated-image-jobs', () => ({
  claimTutorImageGenerationJobForProcessing: mockClaimJobForProcessing,
  getTutorImageGenerationJobByPredictionId: mockGetJobByPredictionId,
  markTutorImageGenerationCompleted: mockMarkCompleted,
  markTutorImageGenerationFailed: mockMarkFailed,
  normalizeRequestedEditsJson: mockNormalizeRequestedEditsJson,
  renewTutorImageGenerationJobProcessingLease: mockRenewProcessingLease,
}));

vi.mock('@/lib/media/image-analysis', () => ({
  describeTeachingImage: mockDescribeTeachingImage,
  verifyEditedImageChanges: mockVerifyEditedImageChanges,
}));

function buildSignedBody(input: {
  webhookId: string;
  webhookTimestamp: string;
  rawBody: string;
  secret: string;
}) {
  const key = input.secret.replace(/^whsec_/, '');
  return createHmac('sha256', key)
    .update(`${input.webhookId}.${input.webhookTimestamp}.${input.rawBody}`)
    .digest('base64');
}

function buildRequest(input: {
  body: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
}) {
  return new NextRequest('http://localhost:3000/api/tutor/image-generation/webhook', {
    method: 'POST',
    body: input.body,
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': input.webhookId,
      'webhook-timestamp': input.webhookTimestamp,
      'webhook-signature': input.webhookSignature,
    },
  });
}

function buildAdminClientMock() {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'stored-path' }, error: null });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://supabase.example/stored-path' },
  });
  const storageFrom = vi.fn().mockReturnValue({
    upload,
    getPublicUrl,
  });

  return {
    storage: {
      from: storageFrom,
    },
    upload,
    getPublicUrl,
    storageFrom,
  };
}

function normalizeRequestedEditsJsonMock(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.remove) || !Array.isArray(record.swap)) {
    return null;
  }

  const remove = record.remove.map((item) =>
    typeof item === 'string' && item.trim().length > 0 ? item.trim() : null
  );
  if (remove.some((item): item is null => item === null)) {
    return null;
  }

  const swap = record.swap.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }

    const swapRecord = item as Record<string, unknown>;
    const from = typeof swapRecord.from === 'string' ? swapRecord.from.trim() : '';
    const to = typeof swapRecord.to === 'string' ? swapRecord.to.trim() : '';

    if (!from || !to) {
      return null;
    }

    return { from, to };
  });

  if (swap.some((item): item is null => item === null)) {
    return null;
  }

  if (remove.length === 0 && swap.length === 0) {
    return null;
  }

  return { remove: remove as string[], swap: swap as Array<{ from: string; to: string }> };
}

function buildClaimedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_1',
    session_id: 'session-1',
    prediction_id: 'pred_123',
    source_type: 'generate',
    purpose: 'teaching_visual',
    status: 'processing',
    prompt: 'Create a water cycle diagram',
    source_image_id: null,
    source_image_url: null,
    requested_edits_json: null,
    processing_claim_token: 'lease_123',
    processing_claimed_at: '2026-04-23T10:00:00.000Z',
    processing_lease_expires_at: '2026-04-23T10:05:00.000Z',
    asset_storage_path: null,
    asset_url: null,
    asset_alt_text: null,
    asset_description: null,
    asset_metadata_json: null,
    error_message: null,
    created_at: '2026-04-23T10:00:00.000Z',
    updated_at: '2026-04-23T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

describe('POST /api/tutor/image-generation/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    process.env.REPLICATE_WEBHOOK_SECRET =
      'whsec_' + Buffer.from('replicate-webhook-secret').toString('base64');
    mockCreateAdminClient.mockReturnValue(buildAdminClientMock());
    mockRenewProcessingLease.mockResolvedValue(buildClaimedJob());
    mockNormalizeRequestedEditsJson.mockImplementation(normalizeRequestedEditsJsonMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.REPLICATE_WEBHOOK_SECRET;
  });

  it('rejects invalid signatures', async () => {
    const request = buildRequest({
      body: JSON.stringify({ id: 'pred_123', status: 'succeeded' }),
      webhookId: 'msg_123',
      webhookTimestamp: '1710000000',
      webhookSignature: 'v1,not-valid',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockClaimJobForProcessing).not.toHaveBeenCalled();
    expect(mockGetJobByPredictionId).not.toHaveBeenCalled();
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it.each([
    ['failed', 'Replicate rejected the request'],
    ['canceled', null],
  ] as const)('marks terminal %s predictions failed', async (status, error) => {
    const rawBody = JSON.stringify({ id: 'pred_123', status, error });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_123';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;

    mockClaimJobForProcessing.mockResolvedValue(
      buildClaimedJob({
        status: 'queued',
        updated_at: '2026-04-23T10:00:00.000Z',
      })
    );

    const response = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(response.status).toBe(200);
    expect(mockMarkFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        predictionId: 'pred_123',
        errorMessage: error ?? 'Replicate prediction canceled',
      })
    );
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockDescribeTeachingImage).not.toHaveBeenCalled();
    expect(mockVerifyEditedImageChanges).not.toHaveBeenCalled();
  });

  it('downloads, stores, and describes a generated image before marking the job completed', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const rawBody = JSON.stringify({
      id: 'pred_123',
      status: 'succeeded',
      output: 'https://replicate.example/output.png',
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_123';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;
    const adminClient = buildAdminClientMock();
    mockCreateAdminClient.mockReturnValue(adminClient);

    mockClaimJobForProcessing.mockResolvedValue(
      buildClaimedJob({
        status: 'queued',
        updated_at: '2026-04-23T10:00:00.000Z',
      })
    );

    mockDescribeTeachingImage.mockResolvedValue({
      summary: 'Water cycle diagram with arrows showing movement.',
      imageKind: 'diagram',
      showsProcess: true,
      keyObjects: ['clouds', 'raindrops'],
      keyRegions: ['top', 'bottom'],
      teachingValueScore: 8,
      childFriendlinessScore: 7,
      clutterScore: 2,
      suggestedUse: 'Use it to review the cycle.',
      tutorGuidance: ['Point to the arrows.'],
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(Buffer.from('image-bytes'), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      })
    );

    const response = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(response.status).toBe(200);
    expect(mockClaimJobForProcessing).toHaveBeenCalledWith(expect.anything(), 'pred_123');
    expect(adminClient.storageFrom).toHaveBeenCalledWith('media-assets');
    expect(adminClient.upload).toHaveBeenCalledWith(
      'tutor-image-generation/session-1/job_1.png',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/png',
        upsert: true,
      })
    );
    expect(mockDescribeTeachingImage).toHaveBeenCalledWith({
      imageUrl: 'https://supabase.example/stored-path',
      topic: 'Create a water cycle diagram',
    });
    expect(mockVerifyEditedImageChanges).not.toHaveBeenCalled();
    expect(mockMarkCompleted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        predictionId: 'pred_123',
        assetStoragePath: 'tutor-image-generation/session-1/job_1.png',
        assetUrl: 'https://supabase.example/stored-path',
        assetAltText: 'Water cycle diagram with arrows showing movement.',
        assetDescription: 'Water cycle diagram with arrows showing movement.',
        assetMetadataJson: expect.objectContaining({
          assetKind: 'generated',
          generationKind: 'generate',
          variantKind: 'teaching_visual',
          sourceJobId: 'job_1',
          summary: 'Water cycle diagram with arrows showing movement.',
          suggestedUse: 'Use it to review the cycle.',
          replicate: expect.objectContaining({
            id: 'pred_123',
            status: 'succeeded',
            output: 'https://replicate.example/output.png',
          }),
        }),
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[tutor:image-gen:success]',
      expect.objectContaining({
        predictionId: 'pred_123',
        jobId: 'job_1',
        sourceType: 'generate',
        assetUrl: 'https://supabase.example/stored-path',
      })
    );
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it('ignores a duplicate succeeded delivery after the first one has claimed processing', async () => {
    const rawBody = JSON.stringify({
      id: 'pred_789',
      status: 'succeeded',
      output: 'https://replicate.example/output.png',
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_789';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;
    const adminClient = buildAdminClientMock();
    mockCreateAdminClient.mockReturnValue(adminClient);

    mockClaimJobForProcessing
      .mockResolvedValueOnce(
        buildClaimedJob({
          id: 'job_3',
          session_id: 'session-3',
          prediction_id: 'pred_789',
          status: 'processing',
          updated_at: '2026-04-23T10:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(null);

    mockDescribeTeachingImage.mockResolvedValue({
      summary: 'Water cycle diagram with arrows showing movement.',
      imageKind: 'diagram',
      showsProcess: true,
      keyObjects: ['clouds', 'raindrops'],
      keyRegions: ['top', 'bottom'],
      teachingValueScore: 8,
      childFriendlinessScore: 7,
      clutterScore: 2,
      suggestedUse: 'Use it to review the cycle.',
      tutorGuidance: ['Point to the arrows.'],
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(Buffer.from('image-bytes'), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      })
    );

    const firstResponse = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const secondResponse = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(adminClient.upload).toHaveBeenCalledTimes(1);
    expect(mockDescribeTeachingImage).toHaveBeenCalledTimes(1);
    expect(mockMarkCompleted).toHaveBeenCalledTimes(1);
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockClaimJobForProcessing).toHaveBeenCalledTimes(2);
  });

  it('downloads, stores, describes, and verifies an edit image before completing the job', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const rawBody = JSON.stringify({
      id: 'pred_456',
      status: 'succeeded',
      output: ['https://replicate.example/edit.webp'],
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_456';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;
    const adminClient = buildAdminClientMock();
    mockCreateAdminClient.mockReturnValue(adminClient);

    mockClaimJobForProcessing.mockResolvedValue(
      buildClaimedJob({
        id: 'job_2',
        session_id: 'session-2',
        prediction_id: 'pred_456',
        source_type: 'edit',
        purpose: 'quiz_swap',
        status: 'queued',
        prompt: "Swap label 'evaporation' with 'condensation'",
        source_image_id: 'generated_1',
        source_image_url: 'https://example.com/original.png',
        requested_edits_json: {
          remove: ['nucleus'],
          swap: [{ from: 'evaporation', to: 'condensation' }],
        },
        updated_at: '2026-04-23T10:00:00.000Z',
      })
    );

    mockDescribeTeachingImage.mockResolvedValue({
      summary: 'Edited plant diagram used as a quiz variant.',
      imageKind: 'diagram',
      showsProcess: false,
      keyObjects: ['cell wall'],
      keyRegions: ['center'],
      teachingValueScore: 8,
      childFriendlinessScore: 8,
      clutterScore: 3,
      suggestedUse: 'Ask what changed.',
      tutorGuidance: ['Ask the learner to name the missing label.'],
    });

    mockVerifyEditedImageChanges.mockResolvedValue({
      removedLabelsVerified: ['nucleus'],
      swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
      summary: 'The quiz image removed the nucleus label and swapped the process label.',
      suggestedUse: 'Use as a memory check.',
      tutorGuidance: ['Ask what label was removed.'],
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(Buffer.from('edit-image-bytes'), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
        },
      })
    );

    const response = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(response.status).toBe(200);
    expect(mockClaimJobForProcessing).toHaveBeenCalledWith(expect.anything(), 'pred_456');
    expect(adminClient.upload).toHaveBeenCalledWith(
      'tutor-image-generation/session-2/job_2.webp',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/webp',
        upsert: true,
      })
    );
    expect(mockDescribeTeachingImage).toHaveBeenCalledWith({
      imageUrl: 'https://supabase.example/stored-path',
      topic: "Swap label 'evaporation' with 'condensation'",
    });
    expect(mockVerifyEditedImageChanges).toHaveBeenCalledWith({
      originalImageUrl: 'https://example.com/original.png',
      editedImageUrl: 'https://supabase.example/stored-path',
      requestedEdits: {
        remove: ['nucleus'],
        swap: [{ from: 'evaporation', to: 'condensation' }],
      },
      topic: "Swap label 'evaporation' with 'condensation'",
    });
    expect(mockMarkCompleted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        predictionId: 'pred_456',
        assetStoragePath: 'tutor-image-generation/session-2/job_2.webp',
        assetUrl: 'https://supabase.example/stored-path',
        assetMetadataJson: expect.objectContaining({
          assetKind: 'generated',
          generationKind: 'edit',
          variantKind: 'quiz_swap',
          baseImageId: 'generated_1',
          sourceImageUrl: 'https://example.com/original.png',
          requestedEdits: {
            remove: ['nucleus'],
            swap: [{ from: 'evaporation', to: 'condensation' }],
          },
          verifiedEdits: {
            removedLabelsVerified: ['nucleus'],
            swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
          },
          summary: 'Edited plant diagram used as a quiz variant.',
          suggestedUse: 'Use as a memory check.',
          sourceJobId: 'job_2',
        }),
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[tutor:image-edit:success]',
      expect.objectContaining({
        predictionId: 'pred_456',
        jobId: 'job_2',
        sourceImageId: 'generated_1',
        sourceImageUrl: 'https://example.com/original.png',
        assetUrl: 'https://supabase.example/stored-path',
        verifiedEdits: {
          removedLabelsVerified: ['nucleus'],
          swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
        },
      })
    );
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it('logs terminal edit prediction failures with the source image and prompt context', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rawBody = JSON.stringify({
      id: 'pred_edit_failed',
      status: 'failed',
      error: 'Replicate rejected the request',
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_edit_failed';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;

    mockGetJobByPredictionId.mockResolvedValue(
      buildClaimedJob({
        id: 'job_failed',
        prediction_id: 'pred_edit_failed',
        source_type: 'edit',
        purpose: 'quiz_unlabeled',
        prompt: "Remove label 'nucleus'",
        source_image_id: 'generated_1',
        source_image_url: 'https://example.com/original.png',
      })
    );

    const response = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(response.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith(
      '[tutor:image-gen:failed]',
      expect.objectContaining({
        predictionId: 'pred_edit_failed',
        jobId: 'job_failed',
        sourceType: 'edit',
        error: 'Replicate rejected the request',
      })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[tutor:image-edit:failed]',
      expect.objectContaining({
        predictionId: 'pred_edit_failed',
        jobId: 'job_failed',
        sourceImageId: 'generated_1',
        sourceImageUrl: 'https://example.com/original.png',
        prompt: "Remove label 'nucleus'",
        error: 'Replicate rejected the request',
      })
    );
  });

  it('fails an edit webhook before storage when requested edits are malformed', async () => {
    const rawBody = JSON.stringify({
      id: 'pred_654',
      status: 'succeeded',
      output: 'https://replicate.example/edit.webp',
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_654';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;
    const adminClient = buildAdminClientMock();
    mockCreateAdminClient.mockReturnValue(adminClient);

    mockClaimJobForProcessing.mockResolvedValue(
      buildClaimedJob({
        id: 'job_4',
        session_id: 'session-4',
        prediction_id: 'pred_654',
        source_type: 'edit',
        purpose: 'quiz_swap',
        status: 'queued',
        prompt: "Swap label 'evaporation' with 'condensation'",
        source_image_id: 'generated_1',
        source_image_url: 'https://example.com/original.png',
        requested_edits_json: {
          remove: ['nucleus', 42],
          swap: [{ from: 'evaporation', to: 'condensation' }],
        } as unknown as Record<string, unknown>,
        updated_at: '2026-04-23T10:00:00.000Z',
      })
    );

    const response = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(response.status).toBe(200);
    expect(adminClient.upload).not.toHaveBeenCalled();
    expect(mockDescribeTeachingImage).not.toHaveBeenCalled();
    expect(mockVerifyEditedImageChanges).not.toHaveBeenCalled();
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockMarkFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        predictionId: 'pred_654',
        errorMessage: 'Edit tutor image job is missing requested edits',
      })
    );
  });

  it('can recover a processing job on a later succeeded delivery after a failed claim path', async () => {
    const rawBody = JSON.stringify({
      id: 'pred_987',
      status: 'succeeded',
      output: 'https://replicate.example/output.png',
    });
    const webhookTimestamp = '1710000000';
    const webhookId = 'msg_987';
    const webhookSignature = `v1,${buildSignedBody({
      webhookId,
      webhookTimestamp,
      rawBody,
      secret: String(process.env.REPLICATE_WEBHOOK_SECRET),
    })}`;
    const adminClient = buildAdminClientMock();
    mockCreateAdminClient.mockReturnValue(adminClient);

    mockClaimJobForProcessing.mockResolvedValue(
      buildClaimedJob({
        id: 'job_5',
        session_id: 'session-5',
        prediction_id: 'pred_987',
        status: 'processing',
        updated_at: '2026-04-23T10:00:00.000Z',
      })
    );

    mockDescribeTeachingImage
      .mockRejectedValueOnce(new Error('OpenRouter image description failed with status 503'))
      .mockResolvedValueOnce({
        summary: 'Water cycle diagram with arrows showing movement.',
        imageKind: 'diagram',
        showsProcess: true,
        keyObjects: ['clouds', 'raindrops'],
        keyRegions: ['top', 'bottom'],
        teachingValueScore: 8,
        childFriendlinessScore: 7,
        clutterScore: 2,
        suggestedUse: 'Use it to review the cycle.',
        tutorGuidance: ['Point to the arrows.'],
      });

    mockMarkFailed.mockRejectedValueOnce(new Error('database unavailable'));
    vi.mocked(fetch).mockImplementation(
      () =>
        Promise.resolve(
          new Response(Buffer.from('image-bytes'), {
            status: 200,
            headers: {
              'Content-Type': 'image/png',
            },
          })
        )
    );

    const firstResponse = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );
    const secondResponse = await POST(
      buildRequest({
        body: rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
    );

    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);
    expect(adminClient.upload).toHaveBeenCalledTimes(2);
    expect(mockDescribeTeachingImage).toHaveBeenCalledTimes(2);
    expect(mockMarkFailed).toHaveBeenCalledTimes(1);
    expect(mockMarkCompleted).toHaveBeenCalledTimes(1);
    expect(mockClaimJobForProcessing).toHaveBeenCalledTimes(2);
  });
});
