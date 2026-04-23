import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import type {
  Database,
  TutorImageGenerationJobInsert,
  TutorImageGenerationJobRecord,
} from '@/lib/types/database';
import type { TutorMediaAsset } from '@/lib/types/tutor';
import type { TutorGeneratedImageEdits, TutorGeneratedImageSwap } from '@/lib/types/tutor';

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
  lt(
    column: 'processing_lease_expires_at',
    value: string
  ): TutorImageGenerationJobsUpdateSelectBuilder;
};

type TutorImageGenerationJobsUpdateBuilder = {
  eq(
    column: 'prediction_id' | 'id' | 'processing_claim_token',
    value: string
  ): TutorImageGenerationJobsUpdateBuilder;
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

export type CreateTutorImageGenerationJobGenerateInput = {
  sessionId: string;
  predictionId: string;
  sourceType: 'generate';
  purpose: string;
  prompt: string;
  sourceImageId?: never;
  sourceImageUrl?: never;
  requestedEditsJson?: never;
};

export type CreateTutorImageGenerationJobEditInput = {
  sessionId: string;
  predictionId: string;
  sourceType: 'edit';
  purpose: string;
  prompt: string;
  sourceImageId: string;
  sourceImageUrl: string;
  requestedEditsJson: Record<string, unknown>;
};

export type CreateTutorImageGenerationJobInput =
  | CreateTutorImageGenerationJobGenerateInput
  | CreateTutorImageGenerationJobEditInput;

export type MarkTutorImageGenerationCompletedInput = {
  predictionId: string;
  claimToken: string;
  assetStoragePath: string;
  assetUrl: string;
  assetAltText?: string | null;
  assetDescription?: string | null;
  assetMetadataJson?: Record<string, unknown> | null;
};

export type MarkTutorImageGenerationFailedInput = {
  predictionId: string;
  claimToken?: string | null;
  errorMessage: string;
};

export type RenewTutorImageGenerationProcessingLeaseInput = {
  predictionId: string;
  claimToken: string;
};

function jobsTable(supabase: TutorImageGenerationJobsClient) {
  return supabase.from('tutor_image_generation_jobs') as unknown as TutorImageGenerationJobsTable;
}

function nowIso() {
  return new Date().toISOString();
}

function processingLeaseExpiryIso() {
  return new Date(Date.now() + 5 * 60_000).toISOString();
}

function createProcessingLease() {
  return {
    claimToken: randomUUID(),
    claimedAt: nowIso(),
    leaseExpiresAt: processingLeaseExpiryIso(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSwap(value: unknown): TutorGeneratedImageSwap | null {
  if (!isRecord(value)) {
    return null;
  }

  const from = typeof value.from === 'string' ? value.from.trim() : '';
  const to = typeof value.to === 'string' ? value.to.trim() : '';

  if (!from || !to) {
    return null;
  }

  return { from, to };
}

export function normalizeRequestedEditsJson(value: unknown): TutorGeneratedImageEdits | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!Array.isArray(value.remove) || !Array.isArray(value.swap)) {
    return null;
  }

  const remove = value.remove.map((item) => {
    if (typeof item !== 'string') {
      return null;
    }

    const trimmed = item.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

  if (remove.some((item): item is null => item === null)) {
    return null;
  }

  const swap = value.swap.map(normalizeSwap);

  if (swap.some((item): item is null => item === null)) {
    return null;
  }

  if (remove.length === 0 && swap.length === 0) {
    return null;
  }

  return {
    remove: remove as string[],
    swap: swap as TutorGeneratedImageSwap[],
  };
}

export async function getTutorImageGenerationJobByPredictionId(
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

async function updateTutorImageGenerationJobProcessingByToken(
  supabase: TutorImageGenerationJobsClient,
  predictionId: string,
  claimToken: string,
  patch: Partial<TutorImageGenerationJobRecord>
) {
  const { data, error } = await jobsTable(supabase)
    .update(patch)
    .eq('prediction_id', predictionId)
    .eq('processing_claim_token', claimToken)
    .in('status', ['processing'])
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function claimTutorImageGenerationJobForProcessing(
  supabase: TutorImageGenerationJobsClient,
  predictionId: string
) {
  const lease = createProcessingLease();
  const queuedClaim = await jobsTable(supabase)
    .update({
      status: 'processing',
      processing_claim_token: lease.claimToken,
      processing_claimed_at: lease.claimedAt,
      processing_lease_expires_at: lease.leaseExpiresAt,
    })
    .eq('prediction_id', predictionId)
    .in('status', ['queued'])
    .select()
    .maybeSingle();

  if (queuedClaim.error) {
    throw queuedClaim.error;
  }

  if (queuedClaim.data) {
    return queuedClaim.data;
  }

  const staleClaim = await jobsTable(supabase)
    .update({
      status: 'processing',
      processing_claim_token: lease.claimToken,
      processing_claimed_at: lease.claimedAt,
      processing_lease_expires_at: lease.leaseExpiresAt,
    })
    .eq('prediction_id', predictionId)
    .in('status', ['processing'])
    .lt('processing_lease_expires_at', nowIso())
    .select()
    .maybeSingle();

  if (staleClaim.error) {
    throw staleClaim.error;
  }

  if (staleClaim.data) {
    return staleClaim.data;
  }

  return null;
}

export async function renewTutorImageGenerationJobProcessingLease(
  supabase: TutorImageGenerationJobsClient,
  input: RenewTutorImageGenerationProcessingLeaseInput
) {
  const renewedLease = await jobsTable(supabase)
    .update({ processing_lease_expires_at: processingLeaseExpiryIso() })
    .eq('prediction_id', input.predictionId)
    .eq('processing_claim_token', input.claimToken)
    .in('status', ['processing'])
    .select()
    .maybeSingle();

  if (renewedLease.error) {
    throw renewedLease.error;
  }

  return renewedLease.data;
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
          source_image_id: input.sourceImageId,
          source_image_url: input.sourceImageUrl,
          requested_edits_json: normalizeRequestedEditsJson(input.requestedEditsJson),
        }
      : {}),
  };

  if (input.sourceType === 'edit') {
    if (!payload.source_image_id || !payload.source_image_url) {
      throw new Error('sourceImageId and sourceImageUrl are required for edit tutor image jobs');
    }

    if (!payload.requested_edits_json) {
      throw new Error(
        'requestedEditsJson must include non-empty remove and swap entries for edit tutor image jobs'
      );
    }
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
  const updated = await updateTutorImageGenerationJobProcessingByToken(
    supabase,
    input.predictionId,
    input.claimToken,
    {
    status: 'completed',
    asset_storage_path: input.assetStoragePath,
    asset_url: input.assetUrl,
    asset_alt_text: input.assetAltText ?? null,
    asset_description: input.assetDescription ?? null,
    asset_metadata_json: input.assetMetadataJson ?? null,
    error_message: null,
    completed_at: nowIso(),
    processing_claim_token: null,
    processing_claimed_at: null,
    processing_lease_expires_at: null,
  }
  );

  if (updated) {
    return updated;
  }

  return getTutorImageGenerationJobByPredictionId(supabase, input.predictionId);
}

export async function markTutorImageGenerationFailed(
  supabase: TutorImageGenerationJobsClient,
  input: MarkTutorImageGenerationFailedInput
) {
  const updated = input.claimToken
    ? await updateTutorImageGenerationJobProcessingByToken(
        supabase,
        input.predictionId,
        input.claimToken,
        {
          status: 'failed',
          asset_storage_path: null,
          asset_url: null,
          asset_alt_text: null,
          asset_description: null,
          asset_metadata_json: null,
          error_message: input.errorMessage,
          completed_at: nowIso(),
          processing_claim_token: null,
          processing_claimed_at: null,
          processing_lease_expires_at: null,
        }
      )
    : await jobsTable(supabase)
        .update({
          status: 'failed',
          asset_storage_path: null,
          asset_url: null,
          asset_alt_text: null,
          asset_description: null,
          asset_metadata_json: null,
          error_message: input.errorMessage,
          completed_at: nowIso(),
          processing_claim_token: null,
          processing_claimed_at: null,
          processing_lease_expires_at: null,
        })
        .eq('prediction_id', input.predictionId)
        .in('status', ['queued', 'processing'])
        .select()
        .maybeSingle();

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
