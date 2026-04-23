import { describe, expect, it, vi } from 'vitest';

import type { TutorMediaAsset } from '@/lib/types/tutor';

import {
  createTutorImageGenerationJob,
  listCompletedTutorImageAssets,
  markTutorImageGenerationCompleted,
  markTutorImageGenerationFailed,
} from './generated-image-jobs';

function createSupabaseMock<TRecord extends Record<string, unknown> = Record<string, unknown>>(
  options: {
    insertRow?: TRecord;
    updateRow?: TRecord | null;
    selectRows?: TRecord[];
  } = {}
) {
  const insertResponse = { data: options.insertRow ?? null, error: null };
  const updateResponse = { data: options.updateRow ?? null, error: null };
  const selectResponse = { data: options.selectRows ?? [], error: null };

  const insertMaybeSingle = vi.fn().mockResolvedValue(insertResponse);
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResponse);
  const selectMaybeSingle = vi.fn().mockResolvedValue({
    data: (options.selectRows ?? [])[0] ?? null,
    error: null,
  });

  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(insertResponse),
      maybeSingle: insertMaybeSingle,
    }),
  });

  const updateSelect = vi.fn().mockReturnValue({
    maybeSingle: updateMaybeSingle,
    single: vi.fn().mockResolvedValue(updateResponse),
  });
  const updateIn = vi.fn().mockReturnValue({
    select: updateSelect,
  });
  const updateEq = vi.fn().mockReturnValue({
    in: updateIn,
  });
  const update = vi.fn().mockReturnValue({
    eq: updateEq,
  });

  const listQuery = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: selectMaybeSingle,
    single: vi.fn().mockResolvedValue({
      data: (options.selectRows ?? [])[0] ?? null,
      error: null,
    }),
    then: vi.fn(
      (onfulfilled: (value: { data: TRecord[]; error: null }) => unknown, onrejected?: (reason: unknown) => unknown) =>
        Promise.resolve(selectResponse).then(onfulfilled, onrejected)
    ),
  };
  const select = vi.fn().mockReturnValue(listQuery);
  const eq = listQuery.eq;
  const order = listQuery.order;

  const from = vi.fn().mockImplementation((table: string) => {
    if (table !== 'tutor_image_generation_jobs') {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      insert,
      update,
      select,
    };
  });

  return {
    from,
    insert,
    update,
    select,
    updateEq,
    updateIn,
    eq,
    order,
    maybeSingle: selectMaybeSingle,
    single: insertMaybeSingle,
  };
}

describe('generated-image-jobs', () => {
  it('creates a queued tutor image generation job', async () => {
    const supabase = createSupabaseMock({
      insertRow: {
        id: 'job_1',
        session_id: 'tutor_123',
        prediction_id: 'pred_123',
        source_type: 'generate',
        purpose: 'teaching_visual',
        status: 'queued',
        prompt: 'Clear water cycle diagram',
      },
    });

    const job = await createTutorImageGenerationJob(supabase, {
      sessionId: 'tutor_123',
      predictionId: 'pred_123',
      sourceType: 'generate',
      purpose: 'teaching_visual',
      prompt: 'Clear water cycle diagram',
    });

    expect(supabase.from).toHaveBeenCalledWith('tutor_image_generation_jobs');
    expect(supabase.insert).toHaveBeenCalledWith({
      session_id: 'tutor_123',
      prediction_id: 'pred_123',
      source_type: 'generate',
      purpose: 'teaching_visual',
      status: 'queued',
      prompt: 'Clear water cycle diagram',
    });
    expect(job?.id).toBe('job_1');
  });

  it('persists sourceImageId and requestedEditsJson for edit tutor image jobs', async () => {
    const supabase = createSupabaseMock({
      insertRow: {
        id: 'job_2',
        session_id: 'tutor_123',
        prediction_id: 'pred_456',
        source_type: 'edit',
        purpose: 'quiz_unlabeled',
        status: 'queued',
        prompt: 'Remove the labels from this diagram',
        source_image_id: 'generated_1',
        requested_edits_json: {
          remove: ['nucleus'],
          swap: [{ from: 'evaporation', to: 'condensation' }],
        },
      },
    });

    const job = await createTutorImageGenerationJob(supabase, {
      sessionId: 'tutor_123',
      predictionId: 'pred_456',
      sourceType: 'edit',
      purpose: 'quiz_unlabeled',
      prompt: 'Remove the labels from this diagram',
      sourceImageId: 'generated_1',
      requestedEditsJson: {
        remove: ['nucleus'],
        swap: [{ from: 'evaporation', to: 'condensation' }],
      },
    });

    expect(supabase.insert).toHaveBeenCalledWith({
      session_id: 'tutor_123',
      prediction_id: 'pred_456',
      source_type: 'edit',
      purpose: 'quiz_unlabeled',
      status: 'queued',
      prompt: 'Remove the labels from this diagram',
      source_image_id: 'generated_1',
      requested_edits_json: {
        remove: ['nucleus'],
        swap: [{ from: 'evaporation', to: 'condensation' }],
      },
    });
    expect(job?.source_image_id).toBe('generated_1');
    expect(job?.requested_edits_json).toMatchObject({
      remove: ['nucleus'],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    });
  });

  it('rejects edit tutor image jobs without a sourceImageId', async () => {
    const supabase = createSupabaseMock();

    await expect(
      createTutorImageGenerationJob(supabase, {
        sessionId: 'tutor_123',
        predictionId: 'pred_456',
        sourceType: 'edit',
        purpose: 'quiz_unlabeled',
        prompt: 'Remove the labels from this diagram',
      })
    ).rejects.toThrow('sourceImageId is required for edit tutor image jobs');

    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('marks a tutor image generation job completed with final asset fields', async () => {
    const supabase = createSupabaseMock({
      updateRow: {
        id: 'job_1',
        session_id: 'tutor_123',
        prediction_id: 'pred_123',
        status: 'completed',
        asset_storage_path: 'tutor_123/job_1.png',
        asset_url: 'https://example.com/generated.webp',
      },
    });

    const completed = await markTutorImageGenerationCompleted(supabase, {
      predictionId: 'pred_123',
      assetStoragePath: 'tutor_123/job_1.png',
      assetUrl: 'https://example.com/generated.webp',
      assetAltText: 'Plant cell quiz variant',
      assetDescription: 'Same diagram with one label removed.',
      assetMetadataJson: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_unlabeled',
      },
    });

    expect(supabase.from).toHaveBeenCalledWith('tutor_image_generation_jobs');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        asset_storage_path: 'tutor_123/job_1.png',
        asset_url: 'https://example.com/generated.webp',
        asset_alt_text: 'Plant cell quiz variant',
        asset_description: 'Same diagram with one label removed.',
        asset_metadata_json: {
          assetKind: 'generated',
          generationKind: 'edit',
          variantKind: 'quiz_unlabeled',
        },
        completed_at: expect.any(String),
      })
    );
    expect(supabase.updateEq).toHaveBeenCalledWith('prediction_id', 'pred_123');
    expect(supabase.updateIn).toHaveBeenCalledWith('status', ['queued', 'processing']);
    expect(completed?.status).toBe('completed');
  });

  it('marks a tutor image generation job failed with the error message', async () => {
    const supabase = createSupabaseMock({
      updateRow: {
        id: 'job_1',
        session_id: 'tutor_123',
        prediction_id: 'pred_123',
        status: 'failed',
        error_message: 'Replicate rejected the request',
      },
    });

    const failed = await markTutorImageGenerationFailed(supabase, {
      predictionId: 'pred_123',
      errorMessage: 'Replicate rejected the request',
    });

    expect(supabase.from).toHaveBeenCalledWith('tutor_image_generation_jobs');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: 'Replicate rejected the request',
        completed_at: expect.any(String),
      })
    );
    expect(supabase.updateEq).toHaveBeenCalledWith('prediction_id', 'pred_123');
    expect(supabase.updateIn).toHaveBeenCalledWith('status', ['queued', 'processing']);
    expect(failed?.status).toBe('failed');
  });

  it('does not rewrite a job that is already completed', async () => {
    const supabase = createSupabaseMock({
      updateRow: null,
      selectRows: [
        {
          id: 'job_1',
          session_id: 'tutor_123',
          prediction_id: 'pred_123',
          status: 'completed',
          asset_url: 'https://example.com/generated.webp',
          asset_alt_text: 'Plant cell quiz variant',
          asset_description: 'Same diagram with one label removed.',
          asset_metadata_json: {
            assetKind: 'generated',
            generationKind: 'edit',
            variantKind: 'quiz_unlabeled',
          },
        },
      ],
    });

    const completed = await markTutorImageGenerationCompleted(supabase, {
      predictionId: 'pred_123',
      assetStoragePath: 'tutor_123/job_1.png',
      assetUrl: 'https://example.com/generated.webp',
    });

    expect(supabase.updateEq).toHaveBeenCalledWith('prediction_id', 'pred_123');
    expect(supabase.updateIn).toHaveBeenCalledWith('status', ['queued', 'processing']);
    expect(supabase.select).toHaveBeenCalled();
    expect(completed?.id).toBe('job_1');
    expect(completed?.status).toBe('completed');
  });

  it('maps completed jobs back into tutor media assets', async () => {
    const supabase = createSupabaseMock({
      selectRows: [
        {
          id: 'job_1',
          session_id: 'tutor_123',
          status: 'completed',
          asset_url: 'https://example.com/generated.webp',
          asset_alt_text: 'Plant cell quiz variant',
          asset_description: 'Same diagram with one label removed.',
          asset_metadata_json: {
            assetKind: 'generated',
            generationKind: 'edit',
            variantKind: 'quiz_unlabeled',
          },
        },
      ],
    });

    const assets = await listCompletedTutorImageAssets(supabase, 'tutor_123');

    expect(supabase.eq).toHaveBeenCalledWith('session_id', 'tutor_123');
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject<TutorMediaAsset>({
      id: 'generated_job_1',
      url: 'https://example.com/generated.webp',
      altText: 'Plant cell quiz variant',
      description: 'Same diagram with one label removed.',
      metadata: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_unlabeled',
      },
    });
  });
});
