import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  getReplicatePredictionOutputUrl,
  isTerminalReplicatePredictionStatus,
  verifyReplicateWebhookSignature,
  type ReplicateWebhookPayload,
} from '@/lib/media/generated-image-replicate';
import {
  claimTutorImageGenerationJobForProcessing,
  getTutorImageGenerationJobByPredictionId,
  markTutorImageGenerationCompleted,
  markTutorImageGenerationFailed,
  normalizeRequestedEditsJson,
  renewTutorImageGenerationJobProcessingLease,
} from '@/lib/media/generated-image-jobs';
import {
  describeTeachingImage,
  verifyEditedImageChanges,
} from '@/lib/media/image-analysis';
import type { TutorGeneratedImageEdits } from '@/lib/types/tutor';

type LoadedTutorImageGenerationJob = Exclude<
  Awaited<ReturnType<typeof getTutorImageGenerationJobByPredictionId>>,
  null
>;

function parsePayload(rawBody: string) {
  return JSON.parse(rawBody) as ReplicateWebhookPayload;
}

function normalizeVariantKind(value: string) {
  return value === 'teaching_visual' || value === 'quiz_unlabeled' || value === 'quiz_swap'
    ? value
    : null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function getFileExtension(contentType: string | null, outputUrl: string) {
  const normalizedContentType = (contentType ?? '').split(';', 1)[0].trim().toLowerCase();

  if (normalizedContentType === 'image/png') return 'png';
  if (normalizedContentType === 'image/jpeg') return 'jpg';
  if (normalizedContentType === 'image/jpg') return 'jpg';
  if (normalizedContentType === 'image/webp') return 'webp';

  try {
    const pathname = new URL(outputUrl).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  } catch {
    // Fall through to the default extension.
  }

  return 'webp';
}

function buildStoragePath(args: { sessionId: string; jobId: string; extension: string }) {
  return `tutor-image-generation/${args.sessionId}/${args.jobId}.${args.extension}`;
}

function buildGeneratedImageMetadata(args: {
  payload: ReplicateWebhookPayload;
  job: LoadedTutorImageGenerationJob;
  description: Awaited<ReturnType<typeof describeTeachingImage>>;
  verification?: Awaited<ReturnType<typeof verifyEditedImageChanges>> | null;
  requestedEdits?: TutorGeneratedImageEdits | null;
}) {
  return {
    assetKind: 'generated',
    generationKind: args.job.source_type,
    variantKind: normalizeVariantKind(args.job.purpose),
    baseImageId: args.job.source_image_id ?? undefined,
    sourceImageUrl: args.job.source_image_url ?? undefined,
    requestedEdits: args.requestedEdits ?? undefined,
    verifiedEdits: args.verification
      ? {
          removedLabelsVerified: args.verification.removedLabelsVerified,
          swappedLabelsVerified: args.verification.swappedLabelsVerified,
        }
      : undefined,
    summary: args.description.summary,
    imageKind: args.description.imageKind,
    showsProcess: args.description.showsProcess,
    keyObjects: args.description.keyObjects,
    keyRegions: args.description.keyRegions,
    teachingValueScore: args.description.teachingValueScore,
    childFriendlinessScore: args.description.childFriendlinessScore,
    clutterScore: args.description.clutterScore,
    suggestedUse: args.verification?.suggestedUse ?? args.description.suggestedUse,
    tutorGuidance: uniqueStrings([
      ...args.description.tutorGuidance,
      ...(args.verification?.tutorGuidance ?? []),
    ]),
    verificationSummary: args.verification?.summary ?? undefined,
    replicate: {
      id: args.payload.id,
      status: args.payload.status,
      output: args.payload.output ?? null,
    },
    sourceJobId: args.job.id,
  };
}

async function uploadReplicateOutput(args: {
  supabase: ReturnType<typeof createAdminClient>;
  sessionId: string;
  jobId: string;
  outputUrl: string;
}) {
  const downloadResponse = await fetch(args.outputUrl);

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download Replicate output with status ${downloadResponse.status}`);
  }

  const contentType = downloadResponse.headers.get('content-type') ?? 'application/octet-stream';
  const extension = getFileExtension(contentType, args.outputUrl);
  const storagePath = buildStoragePath({
    sessionId: args.sessionId,
    jobId: args.jobId,
    extension,
  });
  const bytes = Buffer.from(await downloadResponse.arrayBuffer());

  const { error: uploadError } = await args.supabase.storage
    .from('media-assets')
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = args.supabase.storage.from('media-assets').getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhookId = request.headers.get('webhook-id');
    const webhookTimestamp = request.headers.get('webhook-timestamp');
    const webhookSignature = request.headers.get('webhook-signature');
    const secret = process.env.REPLICATE_WEBHOOK_SECRET;

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return NextResponse.json(
        { error: 'Missing Replicate webhook headers' },
        { status: 400 }
      );
    }

    if (!secret) {
      return NextResponse.json(
        { error: 'REPLICATE_WEBHOOK_SECRET is not configured' },
        { status: 500 }
      );
    }

    if (
      !verifyReplicateWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp,
        webhookSignature,
        secret,
      })
    ) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    let payload: ReplicateWebhookPayload;

    try {
      payload = parsePayload(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    if (!isTerminalReplicatePredictionStatus(payload.status)) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const supabase = createAdminClient();

    if (payload.status === 'succeeded') {
      const claimedJob = await claimTutorImageGenerationJobForProcessing(supabase, payload.id);

      if (!claimedJob) {
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      const claimToken = claimedJob.processing_claim_token;

      const renewLease = async () => {
        const renewed = await renewTutorImageGenerationJobProcessingLease(supabase, {
          predictionId: payload.id,
          claimToken: claimToken ?? '',
        });

        return renewed;
      };

      const outputUrl = getReplicatePredictionOutputUrl(payload);

      if (!outputUrl) {
        await markTutorImageGenerationFailed(supabase, {
          predictionId: payload.id,
          claimToken: claimToken ?? null,
          errorMessage: 'Completed webhook is missing an output image URL',
        });

        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      let requestedEdits: TutorGeneratedImageEdits | null = null;
      let originalImageUrl: string | null = null;

      if (claimedJob.source_type === 'edit') {
        originalImageUrl = claimedJob.source_image_url;
        if (!originalImageUrl) {
          await markTutorImageGenerationFailed(supabase, {
            predictionId: payload.id,
            claimToken: claimToken ?? null,
            errorMessage: 'Edit tutor image job is missing source_image_url',
          });
          return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }

        requestedEdits = normalizeRequestedEditsJson(claimedJob.requested_edits_json);
        if (!requestedEdits) {
          await markTutorImageGenerationFailed(supabase, {
            predictionId: payload.id,
            claimToken: claimToken ?? null,
            errorMessage: 'Edit tutor image job is missing requested edits',
          });
          return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }
      }

      try {
        if (!claimToken) {
          throw new Error('Processing claim token is missing');
        }

        if (!(await renewLease())) {
          return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }

        const stored = await uploadReplicateOutput({
          supabase,
          sessionId: claimedJob.session_id,
          jobId: claimedJob.id,
          outputUrl,
        });

        if (!(await renewLease())) {
          return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }

        const description = await describeTeachingImage({
          imageUrl: stored.publicUrl,
          topic: claimedJob.prompt,
        });
        let verification: Awaited<ReturnType<typeof verifyEditedImageChanges>> | null = null;

        if (claimedJob.source_type === 'edit') {
          if (!(await renewLease())) {
            return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
          }

          verification = await verifyEditedImageChanges({
            originalImageUrl: originalImageUrl as string,
            editedImageUrl: stored.publicUrl,
            requestedEdits: requestedEdits as TutorGeneratedImageEdits,
            topic: claimedJob.prompt,
          });
        }

        await markTutorImageGenerationCompleted(supabase, {
          predictionId: payload.id,
          claimToken,
          assetStoragePath: stored.storagePath,
          assetUrl: stored.publicUrl,
          assetAltText: description.summary,
          assetDescription: description.summary,
          assetMetadataJson: buildGeneratedImageMetadata({
            payload,
            job: claimedJob,
            description,
            verification,
            requestedEdits,
          }),
        });
        if (claimedJob.source_type === 'edit') {
          console.log('[tutor:image-edit:success]', {
            predictionId: payload.id,
            jobId: claimedJob.id,
            sourceType: claimedJob.source_type,
            sourceImageId: claimedJob.source_image_id,
            sourceImageUrl: claimedJob.source_image_url,
            prompt: claimedJob.prompt,
            assetUrl: stored.publicUrl,
            verifiedEdits: verification
              ? {
                  removedLabelsVerified: verification.removedLabelsVerified,
                  swappedLabelsVerified: verification.swappedLabelsVerified,
                }
              : null,
          });
        }
      } catch (error) {
        if (claimedJob.source_type === 'edit') {
          console.error('[tutor:image-edit:failed]', {
            predictionId: payload.id,
            jobId: claimedJob.id,
            sourceImageId: claimedJob.source_image_id,
            sourceImageUrl: claimedJob.source_image_url,
            prompt: claimedJob.prompt,
            error: error instanceof Error ? error.message : 'Failed to process Replicate webhook',
          });
        }
        await markTutorImageGenerationFailed(supabase, {
          predictionId: payload.id,
          claimToken: claimToken ?? null,
          errorMessage:
            error instanceof Error ? error.message : 'Failed to process Replicate webhook',
        });
      }
    } else {
      const errorMessage =
        typeof payload.error === 'string' && payload.error.trim().length > 0
          ? payload.error.trim()
          : `Replicate prediction ${payload.status}`;

      const existingJob = await getTutorImageGenerationJobByPredictionId(supabase, payload.id);

      if (existingJob?.source_type === 'edit') {
        console.error('[tutor:image-edit:failed]', {
          predictionId: payload.id,
          jobId: existingJob.id,
          sourceImageId: existingJob.source_image_id,
          sourceImageUrl: existingJob.source_image_url,
          prompt: existingJob.prompt,
          error: errorMessage,
        });
      }

      await markTutorImageGenerationFailed(supabase, {
        predictionId: payload.id,
        claimToken: existingJob?.processing_claim_token ?? null,
        errorMessage,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process Replicate webhook',
      },
      { status: 500 }
    );
  }
}
