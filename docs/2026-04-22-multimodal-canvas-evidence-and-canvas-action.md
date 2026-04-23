# Multimodal Canvas Evidence and Canvas Persistence in Live Tutor

## Date
2026-04-22

## Read When
- learner speech feels missing from `/api/tutor/turn` logs
- tutor asks the learner to point or mark something on an image but no annotation surface appears
- learner submits a marked image and the tutor answers as if it never saw the markup
- canvas tasks get cleared too aggressively or stale tasks linger across turns
- canvas chrome feels noisier than the tutor speech

## Symptoms
- Raw learner ingress was hard to see in server logs because the main visible logs were the LLM prompt/history dumps.
- The tutor could say "point to the anther on the image" without giving the learner a drawing layer over that image.
- Even when the learner submitted a marked image, `/api/tutor/turn` only sent plain text back to the model, so a multimodal model could not inspect the actual drawing.
- Canvas continuity was implicit and shaky. Old tasks could linger when a new one should replace them, and there was no explicit model-owned keep/replace/clear contract.
- Generic canvas labels and instructions added UI noise while the tutor speech was already doing the teaching.

## Root Cause
This was one broken chain with four weak links:

1. **Learner ingress logging was indirect**
   - [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts:1)
   - The route logged the model trace later, but not a direct "this is what the learner just sent" record before model execution.

2. **Drawing submissions were flattened to plain text**
   - [components/tutor/tutor-experience.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.tsx:1)
   - [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:1)
   - The client serialized canvas submissions into transcript text only, so no image evidence reached the server.

3. **Runtime had no explicit canvas persistence contract**
   - [lib/tutor/runtime.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.ts:1)
   - `applyTutorCommands()` always mutated from the prior canvas state and did not understand `keep`, `replace`, or `clear`.

4. **The model was still being taught about generic canvas chrome**
   - [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1)
   - [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:1)
   - Prompt text and rendering still carried headline/instruction baggage even though the tutor speech already explained the task.

## Fix

### 1. Direct learner ingress log
- [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts:1)
- Added a dev log before the model call:
  - transcript
  - current canvas mode
  - whether canvas evidence is attached
  - evidence mode and summary

### 2. Multimodal marked-image submission
- [components/tutor/tutor-experience.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.tsx:1)
- [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:1)
- [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts:1)
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1047)
- Drawing submit now sends:
  - a short learner transcript
  - structured `canvasEvidence`
  - the marked PNG data URL
- `generateTutorTurn()` now forwards that evidence as multimodal content:
  - one text part
  - one `image_url` part

### 3. Explicit canvas persistence
- [lib/types/tutor.ts](/Users/nuru/sanchrobytes/algebra/lib/types/tutor.ts:1)
- [lib/tutor/runtime.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.ts:1)
- Added `canvasAction: keep | replace | clear`.
- `keep` clones and preserves the current canvas scene.
- `replace` starts from a clean canvas state before applying new task commands.
- `clear` removes the current canvas scene unless new commands intentionally rebuild one.

### 4. Image-aware drawing setup
- [lib/tutor/runtime.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.ts:166)
- `set_drawing` now resolves its background image from:
  - explicit `backgroundImageUrl`
  - `imageId`
  - `imageIndex`
  - fallback to the currently active stage image
- This lets the model say "mark this image" and actually get the right image under the learner’s brush.

### 5. Less canvas noise
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1013)
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:1)
- Removed headline/instruction burden from the model prompt.
- Removed generic headline chrome from the canvas UI.
- Distribution/equation scenes no longer lead with generic chrome; the tutor speech and task prompt carry the turn.

## Before
- learner says something; server logs mainly show LLM history later
- tutor asks learner to point at an image
- learner gets no real annotation loop, or the submitted marking is invisible to the model
- canvas continuity depends on implicit state carryover
- generic chrome adds noise

## After
- learner ingress is logged directly at the route boundary
- image-pointing turns can use `set_drawing` over the active image
- submitted marked images go back to the multimodal tutor model
- canvas lifecycle is explicit: keep, replace, or clear
- canvas chrome is quieter

## Regression Tests
- [lib/tutor/runtime.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.test.ts:1)
  - keeps current scene on `keep`
  - clears current scene on `clear`
  - resolves drawing background from `imageId`
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
  - prompt includes `canvasAction`
  - prompt no longer mentions headline/instruction commands
  - marked-image evidence is sent as multimodal content
- [app/api/tutor/turn/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.test.ts:1)
  - route logs learner ingress
  - route forwards `canvasEvidence`
- [components/tutor/tutor-experience.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.test.tsx:1)
  - drawing submissions become multimodal canvas evidence

## Prevention
- When a UI feature claims multimodal behavior, verify the raw payload crossing the route boundary, not just the speech transcript.
- Keep model-owned state transitions explicit. Hidden canvas persistence rules rot fast.
- Do not make the model manage decorative chrome unless that chrome changes behavior.

## Alternatives Considered
- **Server-side heuristic image parser without model-owned `canvasAction`**
  - Rejected. Too magical and brittle.
- **Always clear canvas on every turn**
  - Rejected. Breaks continuity and feels unlike `zo`.
- **Always keep canvas unless the model emits a clear command**
  - Rejected. New tasks would stack on stale scenes.
- **Text-only drawing confirmations**
  - Rejected. Waste of a multimodal model.

## Why This Approach Is Best
- Preserves model ownership of tutoring flow.
- Gives the runtime one clear contract for canvas lifecycle.
- Uses the multimodal model for actual multimodal evidence.
- Removes prompt and UI noise instead of piling on more commands.

## Fallbacks
- No new broad fallback added.
- No heuristic command stripping added.
- No runtime stop-gate added.
- Root-cause fix only.
