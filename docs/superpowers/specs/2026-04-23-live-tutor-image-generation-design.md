# Live Tutor Image Generation Design

## Goal

Add background image generation and image editing to the live tutor so the lesson can start immediately, generated assets can arrive later, and the tutor can choose when to use them with full awareness of what each image is for.

Primary outcomes:
- keep lesson start fast; image generation must not block the opening turn
- support both brand-new generated images and edited quiz variants
- let the tutor see generated assets through the same image context path as searched images
- make edited quiz variants reliable enough for evaluation by extracting exact labels/items first and verifying the final edit afterward
- force low-quality generation for speed and cost control

## Scope

In scope:
- background generation job creation for live tutor sessions
- two image generation workflows:
  - generate a new image from prompt
  - edit an existing image into a quiz variant
- structured edit actions:
  - remove
  - swap
  - both remove and swap in one request
- exact label/item extraction from source images before building edit prompts
- post-generation description and diff verification so the tutor knows what the generated image contains
- tutor prompt/context updates so the model can choose generated images when useful
- tests and docs for the new flow

Out of scope:
- auto-showing generated images without a tutor decision
- forcing the tutor to use a generated image as soon as it exists
- broad new UI surfaces for job management
- rewriting the older Supabase session-create media pipeline unless needed for reuse

## Product Decisions

### 1. Lesson start must never wait for image generation

Chosen rule:
- opening tutor flow continues to use immediate image search results
- image generation and image editing start in the background
- generated assets become available for later tutor turns once completed

Why:
- this matches the user requirement
- image generation can take tens of seconds
- the tutor should never stall waiting for optional assets

### 2. Generated assets should be injected as tutor context, not auto-shown

Chosen rule:
- completed generated assets are stored and merged into tutor media context
- the tutor model decides when to show or use them

Why:
- matches the current model-owned tutor design
- avoids brittle UI-side forcing behavior
- lets the tutor time quiz variants naturally

### 3. Edit prompts must be action-only, not image-description-heavy

Chosen rule:
- the image editing model receives short, strict instructions
- do not describe image layout or label locations to the image model
- only tell it what to change

Why:
- the user explicitly wants the image model trusted to infer placement from the reference image
- long descriptive prompts add noise

### 4. Prompt writing must be driven by extracted evidence

Chosen rule:
- do not ask the planner or prompt writer to guess visible labels/items
- first extract exact labels/items from the source image
- then choose remove/swap actions from that extracted inventory

Why:
- avoids hallucinated label names
- makes quiz variants evaluable
- gives the tutor exact before/after facts

### 5. Remove and swap are first-class edit actions

Chosen rule:
- prompt construction is action-driven:
  - remove only -> include only remove instructions
  - swap only -> include only swap instructions
  - both -> include both in one prompt

Why:
- this is the exact behavior the user asked for
- avoids awkward one-size-fits-all prompt templates

### 6. Tutor context must include verified change metadata

Chosen rule:
- after editing, compare the original and edited image
- store both requested changes and verified changes
- surface this metadata to the tutor prompt

Why:
- the tutor should know not only intent, but what actually changed
- this is necessary for memory checks and “spot the mistake” tasks

## High-Level Flow

### A. New generated image

1. Session create or intake-to-lesson start runs lesson preparation and image search as usual.
2. A generation planner produces zero or more background image jobs.
3. The route starts those jobs asynchronously and immediately returns the tutor snapshot.
4. When a job completes, the final image is stored and described.
5. Later tutor turns load completed generated assets into `snapshot.mediaAssets`.
6. The tutor model sees the generated image in `Available images` and can use it when useful.

### B. Edited quiz variant

1. Select a source image from current tutor media.
2. Run exact label/item extraction on that source image.
3. Planner chooses structured edit actions from extracted labels/items.
4. Build a short edit prompt from those actions.
5. Submit the edit job in the background using the source image as reference.
6. When the edit completes:
   - store the edited image
   - compare original and edited images
   - verify which labels/items were removed or swapped
   - create enriched tutor metadata
7. Later tutor turns include this edited asset in `snapshot.mediaAssets`, letting the tutor choose when to use it.

## Architecture

### 1. Shared image generation service

Add a dedicated server-side module for live tutor image generation with these responsibilities:
- create Replicate predictions against `openai/gpt-image-2`
- always send `quality: low`
- support:
  - new image generation
  - image editing with one or more reference images
- normalize prediction payloads and completion states
- download and persist completed outputs

This should replace the current older `image-generator` assumptions for the live tutor path rather than bolting more fallback logic onto that file.

### 2. Job record layer

Add a focused persistence layer for live tutor image jobs. Each record should include:
- job id
- session id
- source type: `generate` or `edit`
- status: `queued` | `processing` | `completed` | `failed`
- source image id when applicable
- prompt
- requested edit actions
- prediction id
- created/completed timestamps
- final generated asset metadata when completed

This layer should support:
- creating jobs without blocking the request
- idempotent completion handling
- querying completed assets for a session

### 3. Completion path

Use Replicate async predictions with webhook completion as the primary path.

Why:
- background-friendly
- no request blocking
- cleaner than ad hoc polling loops

Completion handler responsibilities:
- validate and process webhook payload
- ignore duplicate terminal callbacks safely
- fetch final output file
- store output asset
- run description or diff verification
- mark job completed

### 4. Tutor snapshot enrichment

Before building a live tutor snapshot for:
- session start completion
- intake-to-lesson handoff
- regular tutor turn

load all completed generated assets for the session and merge them into `snapshot.mediaAssets`.

Rules:
- preserve existing searched images
- do not duplicate already-known generated assets
- keep a stable asset id for each completed generated item
- generated assets are available to the model even if they are not currently active

## Planning and Metadata

### 1. Generation plan structure

The tutor-side planner should be able to request:

```json
{
  "jobs": [
    {
      "kind": "generate_new",
      "purpose": "teaching_visual",
      "prompt": "clear educational diagram of the water cycle",
      "aspectRatio": "1:1"
    },
    {
      "kind": "edit_variant",
      "purpose": "quiz_unlabeled",
      "sourceImageId": "media_1",
      "actions": {
        "remove": ["nucleus"],
        "swap": [
          { "from": "evaporation", "to": "condensation" }
        ]
      }
    }
  ]
}
```

### 2. Exact label extraction

Before any edit prompt is written, run a dedicated extraction step over the source image and produce structured data like:

```json
{
  "visibleLabels": [
    "cell membrane",
    "cytoplasm",
    "nucleus",
    "mitochondrion"
  ],
  "keyItems": [
    "large central organelle",
    "outer membrane",
    "bean-shaped mitochondrion"
  ]
}
```

Rules:
- preserve exact label text as seen in the image
- this extraction is for planner/prompt-writer context
- this extraction is not dumped into the image-edit prompt as a long description

### 3. Edit prompt construction

Edit prompts must be short and action-only.

Base framing:

```text
Use this image as the exact base image for a quiz variant.

Apply only these changes:
1. [one action per line, including only the requested remove/swap actions]

Do not change anything else.
Preserve the rest of the image exactly.
This image was already taught to the learner. The goal is to quiz memory and understanding.
```

Action lines:
- remove only:
  - `1. Remove label 'nucleus'`
- swap only:
  - `1. Swap label 'evaporation' with 'condensation'`
- both:
  - include both remove and swap lines in order

Non-rules:
- do not include location hints
- do not narrate the image structure for the image model

### 4. Post-edit verification

After an edited image is created, run a verification step that sees both:
- the original image
- the edited image

The verifier returns structured facts such as:

```json
{
  "removedLabelsVerified": ["nucleus"],
  "swappedLabelsVerified": [
    {
      "from": "evaporation",
      "to": "condensation"
    }
  ],
  "unchangedImportantLabels": [
    "cell membrane",
    "cytoplasm"
  ],
  "summary": "Same diagram with one label removed and one label intentionally swapped for a recall quiz.",
  "suggestedUse": "Ask the learner to identify what is missing and what is wrong."
}
```

This data is what lets the tutor evaluate well.

## Tutor Media Context

### 1. Richer asset metadata

Extend tutor media assets so generated and edited images can carry structured metadata such as:

```json
{
  "assetKind": "generated",
  "variantKind": "quiz_unlabeled",
  "generationKind": "edit",
  "baseImageId": "media_1",
  "requestedEdits": {
    "remove": ["nucleus"],
    "swap": [
      { "from": "evaporation", "to": "condensation" }
    ]
  },
  "verifiedEdits": {
    "removedLabelsVerified": ["nucleus"],
    "swappedLabelsVerified": [
      { "from": "evaporation", "to": "condensation" }
    ]
  },
  "suggestedUse": "Use for recall or error-spotting.",
  "tutorGuidance": [
    "Ask the learner what is missing.",
    "Ask the learner which label is wrong."
  ]
}
```

### 2. Tutor prompt format

Upgrade image context from a thin line like:

`id | alt | description`

to a richer line like:

`id | generated | quiz_swap | Plant cell diagram with one removed label and one wrong label | requested remove: nucleus | requested swap: evaporation -> condensation | verified remove: nucleus | verified swap: evaporation -> condensation | suggested use: ask learner to spot the missing and wrong labels`

Rules:
- the tutor must know whether an image is:
  - searched
  - generated
  - edited quiz variant
- the tutor must know what changed in edited variants
- the tutor can then decide when to use it

## Replicate Contract

Use Replicate `openai/gpt-image-2` with:
- `prompt`
- `quality: low`
- `input_images` when editing
- `aspect_ratio` where relevant
- `number_of_images: 1`
- `output_format` set to a durable format suitable for storage

According to Replicate’s current docs for `openai/gpt-image-2`:
- the model supports both generation and editing
- `input_images` can be supplied for editing
- lower `quality` is faster and cheaper

For execution mode:
- create async predictions
- use webhooks for terminal completion
- keep handlers idempotent because Replicate may retry completed webhooks

## Error Handling

### Required behavior

- if background image generation fails, the lesson continues
- failed jobs do not break tutor turns
- duplicate webhook deliveries do not duplicate assets
- stale or partially completed jobs are ignored until terminal
- if edit verification fails, the asset should not pretend to be a trusted quiz variant

### Fallback policy

Avoid broad fallback chains.

Chosen rule:
- no cascade of unrelated model fallbacks
- one image generation provider for this feature path: Replicate `openai/gpt-image-2`
- if the job fails, record failure and continue the lesson without it

This deliberately avoids “fallback to everything” behavior.

## Testing

Add tests for:

### 1. Prompt building
- remove-only prompt includes only remove lines
- swap-only prompt includes only swap lines
- mixed prompt includes both remove and swap lines
- edit prompts do not include location narration

### 2. Extraction and verification flow
- exact label extraction feeds planner context
- verified changes are stored separately from requested changes
- tutor metadata includes both requested and verified edits

### 3. Session and turn routes
- session start does not wait for image generation
- intake-to-lesson start does not wait for image generation
- later tutor turns merge completed generated assets into snapshot media

### 4. Webhook completion
- completed webhook stores asset and marks job completed
- duplicate completed webhook is idempotent
- failed prediction records failure without breaking the session

### 5. Tutor prompt context
- generated assets appear in available image context
- edited quiz variants include change metadata so the tutor can reason about them

## Docs

Update docs for:
- live tutor media pipeline
- image generation and editing flow
- quiz variant metadata contract
- Replicate env requirements including `REPLICATE_API_TOKEN`

Cross-cutting docs should include short `read_when` hints where useful.

## Chosen Implementation Direction

Build this into the live tutor path, not the older lesson-session media pipeline.

Why:
- that is where the user’s requested behavior matters now
- live tutor already owns image context through `snapshot.mediaAssets`
- this keeps the implementation focused and reviewable

## Alternatives Considered

### 1. Poll only from tutor turns

Rejected as the main completion mechanism.

Why:
- simple, but weaker background behavior
- no durable completion handling
- wastes requests on repeated polling

### 2. Auto-show generated images immediately on completion

Rejected.

Why:
- user explicitly wants the tutor to decide when to use them
- would fight the current model-owned flow

### 3. Let the planner guess labels from coarse image descriptions

Rejected.

Why:
- not reliable enough for exact remove/swap prompts
- bad fit for evaluation-sensitive quiz variants

## Open Questions Resolved

Resolved:
- remove and swap are both supported now
- prompt composition is action-driven
- exact label extraction informs prompt writing
- the image model prompt stays concise and does not narrate image layout
- tutor context must know requested and verified changes

No remaining product blockers for implementation planning.
