import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Database,
  TutorImageGenerationJobInsert,
  TutorImageGenerationJobRecord,
  TutorImageGenerationJobSourceType,
} from '@/lib/types/database';
import type { TutorMediaAsset } from '@/lib/types/tutor';

type QueryResponse<T> = Promise<{ data: T | null; error: Error | null }>;

type TutorImageGenerationJobsListBuilder = PromiseLike<{
  data: TutorImageGenerationJobRecord[] | null;
  error: Error | null;
}> & {
  eq(column: 'session_id' | 'status' | 'prediction_id', value: string): TutorImageGenerationJobsListBuilder;
  order(column: 'created_at', options: { ascending: boolean }): TutorImageGenerationJobsListBuilder;
  maybeSingle(): QueryResponse<TutorImageGenerationJobRecord>;
  single(): QueryResponse<TutorImageGenerationJobRecord>;
};

type TutorImageGenerationJobsUpdateSelectBuilder = {
  select(columns?: string): TutorImageGenerationJobsTerminalBuilder;
};

type TutorImageGenerationJobsUpdateBuilder = {
  eq(column: 'prediction_id' | 'id', value: string): TutorImageGenerationJobsUpdateBuilder;
  in(
    column: 'status',
    values: Array<'queued' | 'processing'>
  ): TutorImageGenerationJobsUpdateSelectBuilder;
};

type TutorImageGenerationJobsTerminalBuilder = PromiseLike<{
  data: TutorImageGenerationJobRecord | null;
  error: Error | null;
}> & {
  single(): QueryResponse<TutorImageGenerationJobRecord>;
  maybeSingle(): QueryResponse<TutorImageGenerationJobRecord>;
};

type TutorImageGenerationJobsInsertBuilder = {
  select(columns?: string): TutorImageGenerationJobsTerminalBuilder;
};

type TutorImageGenerationJobsTable = {
  insert(values: TutorImageGenerationJobInsert): TutorImageGenerationJobsInsertBuilder;
  update(values: Partial<TutorImageGenerationJobRecord>): TutorImageGenerationJobsUpdateBuilder;
  select(columns?: string): TutorImageGenerationJobsListBuilder;
};

export type TutorImageGenerationJobsClient = Pick<SupabaseClient<Database>, 'from'>;

export type CreateTutorImageGenerationJobInput = {
  sessionId: string;
  predictionId: string;
  sourceType: TutorImageGenerationJobSourceType;
  purpose: string;
  prompt: string;
  sourceImageId?: string | null;
  requestedEditsJson?: Record<string, unknown> | null;
};

export type MarkTutorImageGenerationCompletedInput = {
  predictionId: string;
  assetStoragePath: string;
  assetUrl: string;
  assetAltText?: string | null;
  assetDescription?: string | null;
  assetMetadataJson?: Record<string, unknown> | null;
};

export type MarkTutorImageGenerationFailedInput = {
  predictionId: string;
  errorMessage: string;
};

function jobsTable(supabase: TutorImageGenerationJobsClient) {
  return supabase.from('tutor_image_generation_jobs') as unknown as TutorImageGenerationJobsTable;
}

function nowIso() {
  return new Date().toISOString();
}

async function getTutorImageGenerationJobByPredictionId(
  supabase: TutorImageGenerationJobsClient,
  predictionId: string
) {
  const { data, error } = await jobsTable(supabase)
    .select('*')
    .eq('prediction_id', predictionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function updateTutorImageGenerationJobByPredictionId(
  supabase: TutorImageGenerationJobsClient,
  predictionId: string,
  patch: Partial<TutorImageGenerationJobRecord>
) {
  const { data, error } = await jobsTable(supabase)
    .update(patch)
    .eq('prediction_id', predictionId)
    .in('status', ['queued', 'processing'])
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createTutorImageGenerationJob(
  supabase: TutorImageGenerationJobsClient,
  input: CreateTutorImageGenerationJobInput
) {
  const payload: TutorImageGenerationJobInsert = {
    session_id: input.sessionId,
    prediction_id: input.predictionId,
    source_type: input.sourceType,
    purpose: input.purpose,
    status: 'queued',
    prompt: input.prompt,
    ...(input.sourceType === 'edit'
      ? {
          source_image_id: input.sourceImageId ?? null,
          requested_edits_json: input.requestedEditsJson ?? null,
        }
      : {}),
  };

  if (input.sourceType === 'edit' && !payload.source_image_id) {
    throw new Error('sourceImageId is required for edit tutor image jobs');
  }

  const { data, error } = await jobsTable(supabase).insert(payload).select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function markTutorImageGenerationCompleted(
  supabase: TutorImageGenerationJobsClient,
  input: MarkTutorImageGenerationCompletedInput
) {
  const updated = await updateTutorImageGenerationJobByPredictionId(supabase, input.predictionId, {
    status: 'completed',
    asset_storage_path: input.assetStoragePath,
    asset_url: input.assetUrl,
    asset_alt_text: input.assetAltText ?? null,
    asset_description: input.assetDescription ?? null,
    asset_metadata_json: input.assetMetadataJson ?? null,
    error_message: null,
    completed_at: nowIso(),
  });

  if (updated) {
    return updated;
  }

  return getTutorImageGenerationJobByPredictionId(supabase, input.predictionId);
}

export async function markTutorImageGenerationFailed(
  supabase: TutorImageGenerationJobsClient,
  input: MarkTutorImageGenerationFailedInput
) {
  const updated = await updateTutorImageGenerationJobByPredictionId(supabase, input.predictionId, {
    status: 'failed',
    asset_storage_path: null,
    asset_url: null,
    asset_alt_text: null,
    asset_description: null,
    asset_metadata_json: null,
    error_message: input.errorMessage,
    completed_at: nowIso(),
  });

  if (updated) {
    return updated;
  }

  return getTutorImageGenerationJobByPredictionId(supabase, input.predictionId);
}

function toTutorMediaAsset(row: TutorImageGenerationJobRecord): TutorMediaAsset {
  if (!row.asset_url) {
    throw new Error(`Tutor image job ${row.id} is missing asset_url`);
  }

  return {
    id: `generated_${row.id}`,
    url: row.asset_url,
    altText: row.asset_alt_text ?? 'Generated lesson image',
    description: row.asset_description ?? 'Generated lesson image.',
    metadata: row.asset_metadata_json ?? undefined,
  };
}

export async function listCompletedTutorImageAssets(
  supabase: TutorImageGenerationJobsClient,
  sessionId: string
) {
  const { data, error } = await jobsTable(supabase)
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(toTutorMediaAsset);
}
