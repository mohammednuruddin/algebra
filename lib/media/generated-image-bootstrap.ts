import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { buildQuizVariantPrompt } from '@/lib/media/generated-image-prompts';
import { createTutorImageGenerationJob } from '@/lib/media/generated-image-jobs';
import { createReplicatePrediction } from '@/lib/media/generated-image-replicate';
import { extractEditableImageInventory } from '@/lib/media/image-analysis';
import type { TutorGeneratedImageEdits, TutorMediaAsset } from '@/lib/types/tutor';

type EditableInventoryContext = {
  imageId: string;
  visibleLabels: string[];
  keyItems: string[];
};

type TutorImagePlanJob =
  | {
      kind: 'generate_new';
      purpose: 'teaching_visual';
      prompt: string;
      aspectRatio?: '1:1' | '3:2' | '2:3';
    }
  | {
      kind: 'edit_variant';
      purpose: 'quiz_unlabeled' | 'quiz_swap';
      sourceImageId: string;
      actions: TutorGeneratedImageEdits;
    };

function buildFallbackGeneratePrompt(args: {
  topic: string;
  learnerLevel: string;
  outline: string[];
}) {
  const focus = args.outline.find((step) => step.trim().length > 0) ?? args.topic;
  return `Clear educational diagram of ${args.topic} for a ${args.learnerLevel} learner. Focus on ${focus}.`;
}

function ensureTutorImagePlanHasAtLeastOneJob(args: {
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  editableInventories: EditableInventoryContext[];
  jobs: TutorImagePlanJob[];
}) {
  if (args.jobs.length > 0 || args.imageAssets.length === 0) {
    return {
      jobs: args.jobs,
      fallbackApplied: false,
    };
  }

  const editableInventory = args.editableInventories.find(
    (inventory) =>
      inventory.visibleLabels.length > 0 &&
      args.imageAssets.some((asset) => asset.id === inventory.imageId)
  );

  if (editableInventory) {
    return {
      jobs: [
        {
          kind: 'edit_variant' as const,
          purpose: 'quiz_unlabeled' as const,
          sourceImageId: editableInventory.imageId,
          actions: {
            remove: [editableInventory.visibleLabels[0]],
            swap: [],
          },
        },
      ],
      fallbackApplied: true,
    };
  }

  return {
    jobs: [
      {
        kind: 'generate_new' as const,
        purpose: 'teaching_visual' as const,
        prompt: buildFallbackGeneratePrompt({
          topic: args.topic,
          learnerLevel: args.learnerLevel,
          outline: args.outline,
        }),
        aspectRatio: '1:1' as const,
      },
    ],
    fallbackApplied: true,
  };
}

function safeJsonParse<T>(value: string) {
  return JSON.parse(value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEdits(value: unknown): TutorGeneratedImageEdits | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!Array.isArray(value.remove) || !Array.isArray(value.swap)) {
    return null;
  }

  const remove = value.remove
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const swap = value.swap
    .filter((item): item is { from: string; to: string } => isRecord(item))
    .map((item) => ({
      from: typeof item.from === 'string' ? item.from.trim() : '',
      to: typeof item.to === 'string' ? item.to.trim() : '',
    }))
    .filter((item) => item.from.length > 0 && item.to.length > 0);

  if (remove.length === 0 && swap.length === 0) {
    return null;
  }

  return { remove, swap };
}

function normalizePlanJobs(value: unknown): TutorImagePlanJob[] {
  if (!isRecord(value) || !Array.isArray(value.jobs)) {
    return [];
  }

  return value.jobs.flatMap((job): TutorImagePlanJob[] => {
    if (!isRecord(job) || typeof job.kind !== 'string') {
      return [];
    }

    if (job.kind === 'generate_new') {
      const prompt = typeof job.prompt === 'string' ? job.prompt.trim() : '';
      if (!prompt) {
        return [];
      }

      return [
        {
          kind: 'generate_new',
          purpose: 'teaching_visual',
          prompt,
          aspectRatio:
            job.aspectRatio === '1:1' || job.aspectRatio === '3:2' || job.aspectRatio === '2:3'
              ? job.aspectRatio
              : undefined,
        },
      ];
    }

    if (job.kind === 'edit_variant') {
      const sourceImageId =
        typeof job.sourceImageId === 'string' ? job.sourceImageId.trim() : '';
      const purpose = job.purpose === 'quiz_swap' ? 'quiz_swap' : 'quiz_unlabeled';
      const actions = normalizeEdits(job.actions);

      if (!sourceImageId || !actions) {
        return [];
      }

      return [
        {
          kind: 'edit_variant',
          purpose,
          sourceImageId,
          actions,
        },
      ];
    }

    return [];
  });
}

async function generateTutorImagePlan(args: {
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  editableInventories: EditableInventoryContext[];
}) {
  const outbound = buildOpenRouterRequest({
    messages: [
      {
        role: 'system',
        content:
          'Plan optional background image generation for a live tutor. Return strict JSON only with key jobs. ' +
          'Use kind generate_new for a fresh image and edit_variant for a quiz image derived from an existing source image. ' +
          'For edit_variant, only use sourceImageId values from the provided inventories and choose remove/swap actions only from the provided visibleLabels.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          topic: args.topic,
          learnerLevel: args.learnerLevel,
          outline: args.outline,
          imageAssets: args.imageAssets.map((asset) => ({
            id: asset.id,
            altText: asset.altText,
            description: asset.description,
          })),
          editableInventories: args.editableInventories,
        }),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 8200,
  });

  const response = await fetch(outbound.url, {
    method: 'POST',
    headers: outbound.headers,
    body: JSON.stringify(outbound.body),
  });

  if (!response.ok) {
    throw new Error(`Tutor image planning failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return [];
  }

  return normalizePlanJobs(safeJsonParse<{ jobs?: unknown[] }>(content));
}

export async function queueTutorGeneratedImages(args: {
  sessionId: string;
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  origin: string;
}) {
  if (!process.env.REPLICATE_API_TOKEN || !isAdminClientConfigured()) {
    return [];
  }

  const editableInventories = await Promise.all(
    args.imageAssets.slice(0, 2).map(async (asset) => ({
      imageId: asset.id,
      ...(await extractEditableImageInventory({
        imageUrl: asset.url,
        topic: args.topic,
      })),
    }))
  );

  const plannedJobs = await generateTutorImagePlan({
    topic: args.topic,
    learnerLevel: args.learnerLevel,
    outline: args.outline,
    imageAssets: args.imageAssets,
    editableInventories: editableInventories.map((inventory) => ({
      imageId: inventory.imageId,
      visibleLabels: inventory.visibleLabels,
      keyItems: inventory.keyItems,
    })),
  });
  const { jobs, fallbackApplied } = ensureTutorImagePlanHasAtLeastOneJob({
    topic: args.topic,
    learnerLevel: args.learnerLevel,
    outline: args.outline,
    imageAssets: args.imageAssets,
    editableInventories: editableInventories.map((inventory) => ({
      imageId: inventory.imageId,
      visibleLabels: inventory.visibleLabels,
      keyItems: inventory.keyItems,
    })),
    jobs: plannedJobs,
  });
  console.log('[tutor:image-gen:plan]', {
    sessionId: args.sessionId,
    topic: args.topic,
    plannerJobCount: plannedJobs.length,
    plannedJobCount: jobs.length,
    fallbackApplied,
    jobs: jobs.map((job) =>
      job.kind === 'generate_new'
        ? {
            kind: job.kind,
            purpose: job.purpose,
            prompt: job.prompt,
          }
        : {
            kind: job.kind,
            purpose: job.purpose,
            sourceImageId: job.sourceImageId,
          }
    ),
  });
  const supabase = createAdminClient();
  const webhookUrl = `${args.origin}/api/tutor/image-generation/webhook`;

  const queued = await Promise.allSettled(
    jobs.map(async (job) => {
      if (job.kind === 'generate_new') {
        const prediction = await createReplicatePrediction({
          mode: 'generate',
          prompt: job.prompt,
          aspectRatio: job.aspectRatio,
          webhookUrl,
        });
        console.log('[tutor:image-gen:start]', {
          sessionId: args.sessionId,
          predictionId: prediction.id,
          sourceType: 'generate',
          purpose: job.purpose,
          prompt: job.prompt,
        });

        return await createTutorImageGenerationJob(supabase, {
          sessionId: args.sessionId,
          predictionId: prediction.id,
          sourceType: 'generate',
          purpose: job.purpose,
          prompt: job.prompt,
        });
      }

      const sourceImage = args.imageAssets.find((asset) => asset.id === job.sourceImageId);
      if (!sourceImage) {
        return null;
      }

      const prompt = buildQuizVariantPrompt(job.actions);
      const prediction = await createReplicatePrediction({
        mode: 'edit',
        prompt,
        inputImages: [sourceImage.url],
        webhookUrl,
      });
      console.log('[tutor:image-gen:start]', {
        sessionId: args.sessionId,
        predictionId: prediction.id,
        sourceType: 'edit',
        purpose: job.purpose,
        sourceImageId: sourceImage.id,
        sourceImageUrl: sourceImage.url,
        prompt,
      });
      console.log('[tutor:image-edit:start]', {
        sessionId: args.sessionId,
        predictionId: prediction.id,
        sourceImageId: sourceImage.id,
        sourceImageUrl: sourceImage.url,
        purpose: job.purpose,
        prompt,
      });

      return await createTutorImageGenerationJob(supabase, {
        sessionId: args.sessionId,
        predictionId: prediction.id,
        sourceType: 'edit',
        purpose: job.purpose,
        prompt,
        sourceImageId: sourceImage.id,
        sourceImageUrl: sourceImage.url,
        requestedEditsJson: job.actions,
      });
    })
  );

  queued.forEach((result, index) => {
    if (result.status === 'rejected') {
      const job = jobs[index];
      console.error('[tutor:image-gen:queue-failed]', {
        sessionId: args.sessionId,
        job:
          job?.kind === 'generate_new'
            ? {
                kind: job.kind,
                purpose: job.purpose,
                prompt: job.prompt,
              }
            : job
              ? {
                  kind: job.kind,
                  purpose: job.purpose,
                  sourceImageId: job.sourceImageId,
                }
              : null,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : typeof result.reason === 'string'
              ? result.reason
              : JSON.stringify(result.reason),
      });
    }
  });

  return queued.flatMap((result) =>
    result.status === 'fulfilled' && result.value != null ? [result.value] : []
  );
}
