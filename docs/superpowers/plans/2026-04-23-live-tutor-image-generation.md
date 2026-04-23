# Live Tutor Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add background image generation and image editing to the live tutor so lessons start immediately, Replicate jobs run asynchronously, completed assets are stored durably, and the tutor can later choose generated or edited quiz variants with verified change metadata.

**Architecture:** Keep live tutor startup on the current image-search path, then queue Replicate `openai/gpt-image-2` jobs in the background without waiting for completion. Persist one row per live-tutor generation job in Supabase, store completed image files in the existing `media-assets` bucket, and rehydrate completed assets into `snapshot.mediaAssets` on later tutor turns. For edited quiz variants, first extract exact visible labels/items from the source image, build a short action-only prompt from structured remove/swap actions, then verify the final edited image against the original so the tutor knows what actually changed.

**Tech Stack:** Next.js 16 route handlers, React 19, TypeScript, Vitest, Supabase Postgres + Storage, Replicate `openai/gpt-image-2`, existing OpenRouter image analysis helpers

---

## File Map

- Modify: `lib/types/tutor.ts`
- Modify: `lib/types/database.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`
- Modify: `lib/media/lesson-image-search.ts`
- Modify: `lib/media/lesson-image-search.test.ts`
- Modify: `app/api/tutor/session/create/route.ts`
- Modify: `app/api/tutor/session/create/route.test.ts`
- Modify: `app/api/tutor/turn/route.ts`
- Modify: `app/api/tutor/turn/route.test.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/media/generated-image-prompts.ts`
- Create: `lib/media/generated-image-prompts.test.ts`
- Create: `lib/media/image-analysis.ts`
- Create: `lib/media/image-analysis.test.ts`
- Create: `lib/media/generated-image-jobs.ts`
- Create: `lib/media/generated-image-jobs.test.ts`
- Create: `lib/media/generated-image-replicate.ts`
- Create: `lib/media/generated-image-replicate.test.ts`
- Create: `lib/media/generated-image-bootstrap.ts`
- Create: `lib/media/generated-image-bootstrap.test.ts`
- Create: `app/api/tutor/image-generation/webhook/route.ts`
- Create: `app/api/tutor/image-generation/webhook/route.test.ts`
- Create: `supabase/migrations/20260423110000_create_tutor_image_generation_jobs.sql`
- Create: `docs/2026-04-23-live-tutor-image-generation.md`

## Task 1: Lock the generated-image metadata and prompt builder contract

**Files:**
- Create: `lib/media/generated-image-prompts.ts`
- Create: `lib/media/generated-image-prompts.test.ts`
- Modify: `lib/types/tutor.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`

- [ ] **Step 1: Write the failing prompt-builder tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildQuizVariantPrompt,
  formatTutorImageContextLine,
} from './generated-image-prompts';

describe('buildQuizVariantPrompt', () => {
  it('includes only remove actions for remove-only variants', () => {
    const prompt = buildQuizVariantPrompt({
      remove: ['nucleus'],
      swap: [],
    });

    expect(prompt).toContain("Remove label 'nucleus'");
    expect(prompt).not.toContain('Swap label');
    expect(prompt).toContain('Do not change anything else.');
  });

  it('includes only swap actions for swap-only variants', () => {
    const prompt = buildQuizVariantPrompt({
      remove: [],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    });

    expect(prompt).toContain("Swap label 'evaporation' with 'condensation'");
    expect(prompt).not.toContain('Remove label');
  });

  it('includes remove and swap actions together when both are requested', () => {
    const prompt = buildQuizVariantPrompt({
      remove: ['nucleus'],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    });

    expect(prompt).toContain("Remove label 'nucleus'");
    expect(prompt).toContain("Swap label 'evaporation' with 'condensation'");
  });
});

describe('formatTutorImageContextLine', () => {
  it('includes requested and verified edit metadata for quiz variants', () => {
    const line = formatTutorImageContextLine({
      id: 'generated_1',
      altText: 'Plant diagram quiz variant',
      description: 'Same diagram with one removed label and one swapped label.',
      url: 'https://example.com/generated.webp',
      metadata: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_swap',
        requestedEdits: {
          remove: ['nucleus'],
          swap: [{ from: 'evaporation', to: 'condensation' }],
        },
        verifiedEdits: {
          removedLabelsVerified: ['nucleus'],
          swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
        },
        suggestedUse: 'Ask the learner what is missing and what is wrong.',
      },
    });

    expect(line).toContain('generated');
    expect(line).toContain('quiz_swap');
    expect(line).toContain('requested remove: nucleus');
    expect(line).toContain('verified swap: evaporation -> condensation');
  });
});
```

- [ ] **Step 2: Run the new prompt-builder test file to verify RED**

Run: `npm test -- lib/media/generated-image-prompts.test.ts lib/tutor/model.test.ts`

Expected: FAIL because the helper module, generated metadata fields, and richer tutor image formatting do not exist yet.

- [ ] **Step 3: Add the generated-image metadata types and helper implementations**

```ts
export type TutorGeneratedImageEdits = {
  remove: string[];
  swap: Array<{ from: string; to: string }>;
};

export type TutorGeneratedImageMetadata = {
  assetKind: 'generated';
  generationKind: 'generate' | 'edit';
  variantKind: 'teaching_visual' | 'quiz_unlabeled' | 'quiz_swap' | null;
  baseImageId?: string;
  requestedEdits?: TutorGeneratedImageEdits;
  verifiedEdits?: {
    removedLabelsVerified: string[];
    swappedLabelsVerified: Array<{ from: string; to: string }>;
  };
  suggestedUse?: string;
  tutorGuidance?: string[];
  sourceJobId?: string;
};

export function buildQuizVariantPrompt(edits: TutorGeneratedImageEdits) {
  const actionLines = [
    ...edits.remove.map((label, index) => `${index + 1}. Remove label '${label}'`),
    ...edits.swap.map((entry, index) => `${edits.remove.length + index + 1}. Swap label '${entry.from}' with '${entry.to}'`),
  ];

  return [
    'Use this image as the exact base image for a quiz variant.',
    '',
    'Apply only these changes:',
    ...actionLines,
    '',
    'Do not change anything else.',
    'Preserve the rest of the image exactly.',
    'This image was already taught to the learner. The goal is to quiz memory and understanding.',
  ].join('\n');
}
```

- [ ] **Step 4: Update `lib/tutor/model.ts` to use the richer image context formatter**

```ts
const imageContext = input.imageAssets.length
  ? input.imageAssets.map((asset) => formatTutorImageContextLine(asset)).join('\n')
  : 'No prepared images.';
```

- [ ] **Step 5: Re-run the focused prompt and model tests to verify GREEN**

Run: `npm test -- lib/media/generated-image-prompts.test.ts lib/tutor/model.test.ts`

Expected: PASS with the new prompt builder and richer image context formatting.

- [ ] **Step 6: Commit the prompt and metadata contract**

```bash
git add lib/types/tutor.ts lib/tutor/model.ts lib/tutor/model.test.ts lib/media/generated-image-prompts.ts lib/media/generated-image-prompts.test.ts
git commit -m "feat: add generated image prompt and context metadata"
```

## Task 2: Extract exact labels/items and verify edited-image changes with shared image analysis helpers

**Files:**
- Create: `lib/media/image-analysis.ts`
- Create: `lib/media/image-analysis.test.ts`
- Modify: `lib/media/lesson-image-search.ts`
- Modify: `lib/media/lesson-image-search.test.ts`

- [ ] **Step 1: Write the failing image-analysis tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeTeachingImage,
  extractEditableImageInventory,
  verifyEditedImageChanges,
} from './image-analysis';

describe('extractEditableImageInventory', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        summary: 'Plant cell diagram.',
        visibleLabels: ['cell membrane', 'cytoplasm', 'nucleus'],
        keyItems: ['large central organelle'],
      }) } }],
    }), { status: 200 })));
  });

  it('returns exact visible labels for prompt planning', async () => {
    const result = await extractEditableImageInventory({
      imageUrl: 'https://example.com/cell.png',
      topic: 'plant cells',
    });

    expect(result.visibleLabels).toEqual(['cell membrane', 'cytoplasm', 'nucleus']);
    expect(result.keyItems).toContain('large central organelle');
  });
});

describe('verifyEditedImageChanges', () => {
  it('returns verified remove and swap changes from original and edited images', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        removedLabelsVerified: ['nucleus'],
        swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
        summary: 'Same diagram with one missing label and one incorrect label.',
        suggestedUse: 'Ask the learner what is missing and what is wrong.',
      }) } }],
    }), { status: 200 }));

    const result = await verifyEditedImageChanges({
      originalImageUrl: 'https://example.com/original.png',
      editedImageUrl: 'https://example.com/edited.png',
      requestedEdits: {
        remove: ['nucleus'],
        swap: [{ from: 'evaporation', to: 'condensation' }],
      },
      topic: 'water cycle',
    });

    expect(result.removedLabelsVerified).toEqual(['nucleus']);
    expect(result.swappedLabelsVerified).toEqual([{ from: 'evaporation', to: 'condensation' }]);
  });
});
```

- [ ] **Step 2: Run the new image-analysis tests to verify RED**

Run: `npm test -- lib/media/image-analysis.test.ts lib/media/lesson-image-search.test.ts`

Expected: FAIL because the shared analysis module does not exist and `lesson-image-search.ts` still owns its old inline description code.

- [ ] **Step 3: Implement the shared description, inventory, and verification helpers**

```ts
export async function describeTeachingImage(args: { imageUrl: string; topic: string }) {
  return callImageAnalysisModel({
    system: 'Describe this image for tutoring. Return strict JSON only.',
    prompt:
      `Describe this image for a tutor teaching ${args.topic}. ` +
      'Return strict JSON only with keys summary,imageKind,showsProcess,keyObjects,keyRegions,teachingValueScore,childFriendlinessScore,clutterScore,suggestedUse,tutorGuidance.',
    imageUrls: [args.imageUrl],
  });
}

export async function extractEditableImageInventory(args: { imageUrl: string; topic: string }) {
  return callImageAnalysisModel({
    system: 'Extract exact visible labels and key items from this educational image. Return strict JSON only.',
    prompt:
      `List the exact visible labels and key items in this ${args.topic} image. ` +
      'Return strict JSON only with keys summary,visibleLabels,keyItems.',
    imageUrls: [args.imageUrl],
  });
}

export async function verifyEditedImageChanges(args: {
  originalImageUrl: string;
  editedImageUrl: string;
  requestedEdits: TutorGeneratedImageEdits;
  topic: string;
}) {
  return callImageAnalysisModel({
    system: 'Compare the original and edited educational images. Return strict JSON only.',
    prompt:
      `Compare the original and edited ${args.topic} images. ` +
      `Requested remove labels: ${args.requestedEdits.remove.join(', ') || 'none'}. ` +
      `Requested swaps: ${args.requestedEdits.swap.map((entry) => `${entry.from} -> ${entry.to}`).join(', ') || 'none'}. ` +
      'Return strict JSON only with keys removedLabelsVerified,swappedLabelsVerified,summary,suggestedUse,tutorGuidance.',
    imageUrls: [args.originalImageUrl, args.editedImageUrl],
  });
}
```

- [ ] **Step 4: Update `lesson-image-search.ts` to import `describeTeachingImage()` instead of owning its own multimodal fetch path**

```ts
const description = await describeTeachingImage({
  imageUrl: candidate.imageUrl!,
  topic,
});
```

- [ ] **Step 5: Re-run the focused analysis and search tests to verify GREEN**

Run: `npm test -- lib/media/image-analysis.test.ts lib/media/lesson-image-search.test.ts`

Expected: PASS with shared analysis helpers powering both search-image description and generated-image planning.

- [ ] **Step 6: Commit the shared image-analysis layer**

```bash
git add lib/media/image-analysis.ts lib/media/image-analysis.test.ts lib/media/lesson-image-search.ts lib/media/lesson-image-search.test.ts
git commit -m "feat: share image analysis for search and generated media"
```

## Task 3: Add a durable live-tutor image job store in Supabase

**Files:**
- Create: `supabase/migrations/20260423110000_create_tutor_image_generation_jobs.sql`
- Modify: `lib/types/database.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/media/generated-image-jobs.ts`
- Create: `lib/media/generated-image-jobs.test.ts`

- [ ] **Step 1: Write the failing job-store tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createTutorImageGenerationJob,
  listCompletedTutorImageAssets,
  markTutorImageGenerationCompleted,
} from './generated-image-jobs';

it('maps completed jobs back into tutor media assets', async () => {
  const supabase = createSupabaseMock({
    selectRows: [{
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
    }],
  });

  const assets = await listCompletedTutorImageAssets(supabase, 'tutor_123');
  expect(assets[0]?.id).toBe('generated_job_1');
  expect(assets[0]?.metadata).toMatchObject({ variantKind: 'quiz_unlabeled' });
});
```

- [ ] **Step 2: Run the job-store tests to verify RED**

Run: `npm test -- lib/media/generated-image-jobs.test.ts`

Expected: FAIL because the job store, admin client helper, and new table types do not exist yet.

- [ ] **Step 3: Add the migration and database types for one-row-per-job persistence**

```sql
create table if not exists tutor_image_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  prediction_id text not null unique,
  source_type text not null check (source_type in ('generate', 'edit')),
  purpose text not null,
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  prompt text not null,
  source_image_id text,
  requested_edits_json jsonb,
  asset_storage_path text,
  asset_url text,
  asset_alt_text text,
  asset_description text,
  asset_metadata_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_tutor_image_generation_jobs_prediction_id
  on tutor_image_generation_jobs(prediction_id);
```

- [ ] **Step 4: Implement the admin Supabase helper and job-store functions**

```ts
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function listCompletedTutorImageAssets(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<TutorMediaAsset[]> {
  const { data, error } = await supabase
    .from('tutor_image_generation_jobs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: `generated_${row.id}`,
    url: row.asset_url!,
    altText: row.asset_alt_text || 'Generated lesson image',
    description: row.asset_description || 'Generated lesson image.',
    metadata: row.asset_metadata_json ?? undefined,
  }));
}
```

- [ ] **Step 5: Re-run the job-store tests to verify GREEN**

Run: `npm test -- lib/media/generated-image-jobs.test.ts`

Expected: PASS with durable job persistence and tutor-asset hydration mapping.

- [ ] **Step 6: Commit the job-store layer**

```bash
git add supabase/migrations/20260423110000_create_tutor_image_generation_jobs.sql lib/types/database.ts lib/supabase/admin.ts lib/media/generated-image-jobs.ts lib/media/generated-image-jobs.test.ts
git commit -m "feat: persist live tutor image generation jobs"
```

## Task 4: Add Replicate prediction creation and verified webhook completion

**Files:**
- Create: `lib/media/generated-image-replicate.ts`
- Create: `lib/media/generated-image-replicate.test.ts`
- Create: `app/api/tutor/image-generation/webhook/route.ts`
- Create: `app/api/tutor/image-generation/webhook/route.test.ts`
- Modify: `lib/media/generated-image-jobs.ts`

- [ ] **Step 1: Write the failing Replicate and webhook tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createReplicatePrediction } from './generated-image-replicate';

it('sends quality low and input_images only for edit jobs', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'pred_123' }), { status: 201 })));

  await createReplicatePrediction({
    prompt: "Swap label 'evaporation' with 'condensation'",
    inputImages: ['https://example.com/original.png'],
    webhookUrl: 'https://example.com/api/tutor/image-generation/webhook',
  });

  const [, init] = vi.mocked(fetch).mock.calls[0]!;
  const body = JSON.parse(String(init?.body));

  expect(body.input.quality).toBe('low');
  expect(body.input.input_images).toEqual(['https://example.com/original.png']);
  expect(body.webhook_events_filter).toEqual(['completed']);
});
```

```ts
it('rejects webhook requests with an invalid Replicate signature', async () => {
  const request = new NextRequest('http://localhost:3000/api/tutor/image-generation/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: 'pred_123', status: 'succeeded' }),
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': 'msg_123',
      'webhook-timestamp': '1710000000',
      'webhook-signature': 'v1,not-valid',
    },
  });

  const response = await POST(request);
  expect(response.status).toBe(401);
});
```

- [ ] **Step 2: Run the Replicate and webhook tests to verify RED**

Run: `npm test -- lib/media/generated-image-replicate.test.ts app/api/tutor/image-generation/webhook/route.test.ts`

Expected: FAIL because the Replicate client, signature verification, and completion route do not exist yet.

- [ ] **Step 3: Implement Replicate prediction creation with the official async webhook contract**

```ts
export async function createReplicatePrediction(args: {
  prompt: string;
  inputImages?: string[];
  webhookUrl: string;
  aspectRatio?: '1:1' | '3:2' | '2:3';
}) {
  const response = await fetch('https://api.replicate.com/v1/models/openai/gpt-image-2/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: args.prompt,
        quality: 'low',
        number_of_images: 1,
        output_format: 'webp',
        ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
        ...(args.inputImages?.length ? { input_images: args.inputImages } : {}),
      },
      webhook: args.webhookUrl,
      webhook_events_filter: ['completed'],
    }),
  });

  if (!response.ok) throw new Error(`Replicate prediction failed with status ${response.status}`);
  return await response.json();
}
```

- [ ] **Step 4: Implement webhook signature verification and completion handling**

```ts
const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
const expected = createHmac('sha256', decodeWebhookSecret(process.env.REPLICATE_WEBHOOK_SECRET!))
  .update(signedContent)
  .digest('base64');

if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
}
```

- [ ] **Step 5: On succeeded webhooks, download, store, describe, verify, and mark the job complete**

```ts
const stored = await storeGeneratedImage({
  supabase,
  sessionId: job.session_id,
  predictionId: payload.id,
  outputUrl: outputImageUrl,
});

const verification =
  job.source_type === 'edit'
    ? await verifyEditedImageChanges({
        originalImageUrl: job.source_image_url!,
        editedImageUrl: stored.publicUrl,
        requestedEdits: job.requested_edits_json as TutorGeneratedImageEdits,
        topic: job.purpose,
      })
    : null;

await markTutorImageGenerationCompleted(supabase, job.id, {
  assetStoragePath: stored.storagePath,
  assetUrl: stored.publicUrl,
  assetAltText: description.summary,
  assetDescription: description.summary,
  assetMetadata: {
    assetKind: 'generated',
    generationKind: job.source_type,
    variantKind: job.source_type === 'edit' ? String((job.purpose ?? 'quiz_unlabeled')) as TutorGeneratedImageMetadata['variantKind'] : 'teaching_visual',
    baseImageId: job.source_image_id ?? undefined,
    requestedEdits: (job.requested_edits_json as TutorGeneratedImageEdits | null) ?? undefined,
    verifiedEdits: verification ? {
      removedLabelsVerified: verification.removedLabelsVerified,
      swappedLabelsVerified: verification.swappedLabelsVerified,
    } : undefined,
    suggestedUse: verification?.suggestedUse ?? description.suggestedUse,
    tutorGuidance: verification?.tutorGuidance ?? description.tutorGuidance,
    sourceJobId: job.id,
  },
});
```

- [ ] **Step 6: Re-run the Replicate and webhook tests to verify GREEN**

Run: `npm test -- lib/media/generated-image-replicate.test.ts app/api/tutor/image-generation/webhook/route.test.ts`

Expected: PASS with `quality: low`, verified webhook requests, and idempotent completion handling.

- [ ] **Step 7: Commit the Replicate integration**

```bash
git add lib/media/generated-image-replicate.ts lib/media/generated-image-replicate.test.ts app/api/tutor/image-generation/webhook/route.ts app/api/tutor/image-generation/webhook/route.test.ts lib/media/generated-image-jobs.ts
git commit -m "feat: add replicate-backed tutor image generation webhook flow"
```

## Task 5: Queue background image jobs during live tutor start without blocking the opening turn

**Files:**
- Create: `lib/media/generated-image-bootstrap.ts`
- Create: `lib/media/generated-image-bootstrap.test.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`
- Modify: `app/api/tutor/session/create/route.ts`
- Modify: `app/api/tutor/session/create/route.test.ts`

- [ ] **Step 1: Write the failing bootstrap and session-start tests**

```ts
it('creates background jobs after image search without waiting for completion', async () => {
  mockGenerateLessonPreparation.mockResolvedValue({
    openingSpeech: 'I am preparing photosynthesis now.',
    outline: ['Explain chloroplasts.'],
    imageSearchQuery: 'photosynthesis teaching diagram',
    desiredImageCount: 1,
  });
  mockSearchLessonImages.mockResolvedValue({
    assets: [{
      id: 'media_1',
      url: 'https://example.com/leaf.png',
      altText: 'Leaf diagram',
      description: 'Leaf cross-section.',
    }],
  });
  mockQueueTutorGeneratedImages.mockResolvedValue([
    { id: 'job_1', predictionId: 'pred_123', status: 'queued' },
  ]);

  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(mockQueueTutorGeneratedImages).toHaveBeenCalledTimes(1);
  expect(mockGenerateInitialTutorResponse).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the bootstrap and session-start tests to verify RED**

Run: `npm test -- lib/media/generated-image-bootstrap.test.ts app/api/tutor/session/create/route.test.ts`

Expected: FAIL because there is no queue helper or image-generation planning step yet.

- [ ] **Step 3: Add a focused tutor-image planning function that consumes extracted labels/items**

```ts
export async function generateTutorImagePlan(args: {
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  editableInventories: Array<{ imageId: string; visibleLabels: string[]; keyItems: string[] }>;
}) {
  const messages: TutorMessage[] = [
    {
      role: 'system',
      content:
        'Plan optional background image generation for a live tutor. Return strict JSON with jobs[]. Use kind generate_new for new images and edit_variant for quiz variants. For edit_variant, only choose remove/swap labels that exist in the provided visibleLabels inventory.',
    },
    {
      role: 'user',
      content: JSON.stringify(args),
    },
  ];

  const result = await callModel('session_create', messages);
  return sanitizeTutorImagePlan(result?.response ?? { jobs: [] });
}
```

- [ ] **Step 4: Implement the bootstrap helper that extracts inventories, builds prompts, creates jobs, and starts Replicate predictions**

```ts
export async function queueTutorGeneratedImages(args: {
  sessionId: string;
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  origin: string;
}) {
  const editableInventories = await Promise.all(
    args.imageAssets.slice(0, 2).map(async (asset) => ({
      imageId: asset.id,
      ...(await extractEditableImageInventory({ imageUrl: asset.url, topic: args.topic })),
    }))
  );

  const plan = await generateTutorImagePlan({
    topic: args.topic,
    learnerLevel: args.learnerLevel,
    outline: args.outline,
    imageAssets: args.imageAssets,
    editableInventories,
  });

  return await Promise.all(plan.jobs.map(async (job) => {
    const prompt =
      job.kind === 'edit_variant'
        ? buildQuizVariantPrompt(job.actions)
        : job.prompt;

    return await createAndQueueTutorImageJob({
      sessionId: args.sessionId,
      job,
      prompt,
      webhookUrl: `${args.origin}/api/tutor/image-generation/webhook`,
      sourceImage: args.imageAssets.find((asset) => asset.id === job.sourceImageId) ?? null,
    });
  }));
}
```

- [ ] **Step 5: Wire session create and intake-to-lesson start to await queue creation, not generation completion**

```ts
await queueTutorGeneratedImages({
  sessionId,
  topic,
  learnerLevel,
  outline: preparation.outline,
  imageAssets: imageSearchResult.assets,
  origin: new URL(request.url).origin,
});
```

- [ ] **Step 6: Re-run the bootstrap and session-start tests to verify GREEN**

Run: `npm test -- lib/media/generated-image-bootstrap.test.ts app/api/tutor/session/create/route.test.ts`

Expected: PASS with background jobs queued while the route still returns the opening tutor snapshot immediately.

- [ ] **Step 7: Commit the start-of-lesson queueing flow**

```bash
git add lib/media/generated-image-bootstrap.ts lib/media/generated-image-bootstrap.test.ts lib/tutor/model.ts lib/tutor/model.test.ts app/api/tutor/session/create/route.ts app/api/tutor/session/create/route.test.ts
git commit -m "feat: queue tutor image generation during session start"
```

## Task 6: Rehydrate completed generated assets on later turns and expose them to the tutor model

**Files:**
- Modify: `app/api/tutor/turn/route.ts`
- Modify: `app/api/tutor/turn/route.test.ts`
- Modify: `lib/media/generated-image-jobs.ts`
- Modify: `lib/tutor/model.ts`

- [ ] **Step 1: Write the failing turn-route hydration tests**

```ts
it('merges completed generated assets into snapshot media before calling the tutor model', async () => {
  mockListCompletedTutorImageAssets.mockResolvedValue([
    {
      id: 'generated_job_1',
      url: 'https://example.com/generated.webp',
      altText: 'Plant cell quiz variant',
      description: 'Same diagram with one label removed.',
      metadata: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_unlabeled',
        verifiedEdits: { removedLabelsVerified: ['nucleus'], swappedLabelsVerified: [] },
      },
    },
  ]);

  await POST(request);

  expect(mockGenerateTutorTurn).toHaveBeenCalledWith(expect.objectContaining({
    imageAssets: expect.arrayContaining([
      expect.objectContaining({ id: 'generated_job_1' }),
    ]),
  }));
});
```

- [ ] **Step 2: Run the turn-route test file to verify RED**

Run: `npm test -- app/api/tutor/turn/route.test.ts`

Expected: FAIL because completed generated assets are never merged back into the live tutor snapshot.

- [ ] **Step 3: Add a helper that merges completed generated assets into a snapshot without duplicating by asset id**

```ts
export async function mergeCompletedTutorImageAssets(
  supabase: SupabaseClient<Database>,
  snapshot: TutorRuntimeSnapshot
) {
  const generatedAssets = await listCompletedTutorImageAssets(supabase, snapshot.sessionId);
  const existingIds = new Set(snapshot.mediaAssets.map((asset) => asset.id));

  return {
    ...snapshot,
    mediaAssets: [
      ...snapshot.mediaAssets,
      ...generatedAssets.filter((asset) => !existingIds.has(asset.id)),
    ],
  };
}
```

- [ ] **Step 4: Call the merge helper before both model invocation and snapshot creation in `app/api/tutor/turn/route.ts`**

```ts
const hydratedSnapshot = await mergeCompletedTutorImageAssets(createAdminClient(), snapshot);

const modelResult = await generateTutorTurn({
  topic: hydratedSnapshot.lessonTopic,
  learnerLevel: hydratedSnapshot.learnerLevel,
  outline: hydratedSnapshot.lessonOutline,
  imageAssets: hydratedSnapshot.mediaAssets,
  activeImageId: hydratedSnapshot.activeImageId,
  transcript,
  canvasSummary,
  canvasStateContext,
  latestLearnerTurnContext,
  recentTurnFrames,
  recentTurns,
  canvasTaskPrompt:
    hydratedSnapshot.canvas.mode === 'drawing'
      ? hydratedSnapshot.canvas.drawing?.prompt ?? null
      : null,
});
```

- [ ] **Step 5: Re-run the turn-route tests to verify GREEN**

Run: `npm test -- app/api/tutor/turn/route.test.ts`

Expected: PASS with completed generated images visible to the tutor on later turns.

- [ ] **Step 6: Commit generated-asset hydration**

```bash
git add app/api/tutor/turn/route.ts app/api/tutor/turn/route.test.ts lib/media/generated-image-jobs.ts lib/tutor/model.ts
git commit -m "feat: hydrate completed tutor image jobs into live turns"
```

## Task 7: Update docs and run the full verification gate

**Files:**
- Create: `docs/2026-04-23-live-tutor-image-generation.md`
- Modify: `README.md`

- [ ] **Step 1: Add a short implementation doc covering env vars, webhook setup, and the live-tutor-only flow**

```md
# Live Tutor Image Generation

## Read when
- working on background tutor media generation
- debugging Replicate webhook completion
- changing generated image metadata passed into the tutor prompt

## Env
- `REPLICATE_API_TOKEN`
- `REPLICATE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

## Flow
1. Session start runs image search and queues background jobs.
2. Replicate calls `/api/tutor/image-generation/webhook` on completion.
3. Completed jobs are stored in Supabase and rehydrated into live tutor turns.
```

- [ ] **Step 2: Run the focused test commands, then the full gate**

Run:

```bash
npm test -- lib/media/generated-image-prompts.test.ts lib/media/image-analysis.test.ts lib/media/generated-image-jobs.test.ts lib/media/generated-image-replicate.test.ts lib/media/generated-image-bootstrap.test.ts app/api/tutor/image-generation/webhook/route.test.ts app/api/tutor/session/create/route.test.ts app/api/tutor/turn/route.test.ts lib/tutor/model.test.ts lib/media/lesson-image-search.test.ts
npm test
npm run lint
```

Expected:
- focused tests: PASS
- full `npm test`: PASS
- `npm run lint`: PASS

- [ ] **Step 3: Commit docs and final verified state**

```bash
git add docs/2026-04-23-live-tutor-image-generation.md README.md
git commit -m "docs: document live tutor image generation flow"
```

## Self-Review

### Spec coverage

- background generation without blocking lesson start: Task 5
- generate new images and edit quiz variants: Tasks 1, 4, 5
- structured remove/swap action prompts: Task 1
- exact label extraction before prompt writing: Task 2
- post-edit verification: Task 2 and Task 4
- Replicate async webhook completion: Task 4
- durable stored jobs/assets: Task 3 and Task 4
- tutor prompt/context knows what generated images are: Task 1 and Task 6
- later turns rehydrate completed generated assets: Task 6
- docs and verification: Task 7

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task includes concrete files, code samples, commands, and expected outcomes.

### Type consistency

- `TutorGeneratedImageEdits` is used consistently across prompt building, planning, job persistence, and verification.
- Generated asset metadata keys stay consistent: `assetKind`, `generationKind`, `variantKind`, `requestedEdits`, `verifiedEdits`, `suggestedUse`, `tutorGuidance`, `sourceJobId`.
- Persistence and hydration consistently use the `tutor_image_generation_jobs` table.
