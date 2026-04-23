# Live Tutor Image Generation

## Read when
- working on background tutor media generation
- debugging Replicate webhook completion
- changing generated image metadata passed into the tutor prompt

## Overview

Live tutor image generation now runs in the background:

1. Tutor startup gathers searched images immediately.
2. Startup also plans optional generated or edited quiz-variant images.
3. Replicate `openai/gpt-image-2` predictions run asynchronously with webhook completion.
4. Completed outputs are downloaded, stored in Supabase Storage, described, and, for edit jobs, verified against the original image.
5. Later tutor turns hydrate completed generated assets into `snapshot.mediaAssets`, so the tutor model can choose when to use them.

The opening lesson turn never waits for image generation to finish.

## Environment

Required for the background image generation path:

- `REPLICATE_API_TOKEN`
- `REPLICATE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

Optional:

- `OPENROUTER_IMAGE_MODEL`

## Main Files

- [lib/media/generated-image-bootstrap.ts](/Users/nuru/sanchrobytes/algebra/lib/media/generated-image-bootstrap.ts)
- [lib/media/generated-image-replicate.ts](/Users/nuru/sanchrobytes/algebra/lib/media/generated-image-replicate.ts)
- [lib/media/generated-image-jobs.ts](/Users/nuru/sanchrobytes/algebra/lib/media/generated-image-jobs.ts)
- [app/api/tutor/image-generation/webhook/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/image-generation/webhook/route.ts)
- [app/api/tutor/session/create/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/session/create/route.ts)
- [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts)

## Job Lifecycle

### Startup queueing

- `queueTutorGeneratedImages()` plans background jobs from lesson topic, outline, searched images, and extracted visible labels.
- Generate jobs create brand-new teaching visuals.
- Edit jobs build quiz variants from an existing image using structured `remove` / `swap` actions.

### Persistence

- `tutor_image_generation_jobs` stores durable job state, prediction ids, source image references, requested edits, completion metadata, and processing leases.
- Edit jobs persist `source_image_url` so later verification can compare the original and edited image honestly.

### Webhook completion

- Replicate calls `/api/tutor/image-generation/webhook` for terminal events.
- The route verifies the webhook signature and claims the job with a processing lease.
- Successful outputs are:
  - downloaded from Replicate
  - uploaded to `media-assets`
  - described with the shared image-analysis helper
  - verified against the original image when the job is an edit variant
- Failed or canceled predictions are recorded as failed jobs.

## Notes

- `quality` is always set to `low`.
- `input_images` are only allowed for edit predictions.
- Completed generated assets are model-owned context, not auto-shown UI events.
