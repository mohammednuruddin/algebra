# Tutor Image Markup Resolution and Stage Regressions

## Date
2026-04-22

## Read When
- tutor asks the learner to mark an image but the drawing background fails to load
- the tutor stage shows `Bench` under the image even though the tutor asked for image markup
- tutor drawing submit affordance feels unclear
- image search logs show OpenRouter 400s for SVG teaching diagrams

## Symptoms
- A tutor turn could emit `set_drawing` and still show `Image failed to load`.
- The learner could see the static image, but not the same image inside the drawing surface.
- Some turns fell back into the default distribution board, showing `Bench`, even though the tutor speech was about tracing a path on the image.
- The submit action in drawing mode looked like an unexplained camera icon.
- SVG diagrams could trigger:
  - `OpenRouter image description failed with status 400`

## Root Cause
This was four separate seams:

1. **Asset id mistaken for a URL**
   - [lib/tutor/runtime.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.ts:166)
   - The model sometimes sent a media asset id like `media_2_...` inside `backgroundImageUrl`.
   - Runtime trusted it as a literal URL, so the browser requested `/media_2_...` and got 404.

2. **Invalid `set_mode` normalized into `distribution`**
   - [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:184)
   - When the model emitted bad canvas mode payloads like `{ type: "set_mode", value: "voice_or_canvas" }`, sanitization converted that into a real `set_mode` with fallback distribution semantics.
   - That pushed the canvas into the default distribution renderer, which surfaces `Bench`.

3. **Tutor drawing submit affordance too implicit**
   - [components/lesson/drawing-canvas.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.tsx:1)
   - The action existed, but the icon-only camera button was weak UX.

4. **SVGs were still routed to multimodal image description**
   - [lib/media/lesson-image-search.ts](/Users/nuru/sanchrobytes/algebra/lib/media/lesson-image-search.ts:1)
   - Some providers reject SVG image URLs for vision description, so the describe step was attempting unsupported inputs.

## Fix

### 1. Resolve tutor drawing backgrounds properly
- [lib/tutor/runtime.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.ts:188)
- Added `resolveCanvasBackgroundUrl()` so tutor drawing backgrounds now resolve in this order:
  - real URL or same-origin path
  - media asset id mistakenly sent as `backgroundImageUrl`
  - `imageId`
  - `imageIndex`
  - current active image

### 2. Proxy tutor drawing images through the lesson media resolver
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:1)
- Tutor drawing mode now runs background URLs through [resolveLessonImageUrl](/Users/nuru/sanchrobytes/algebra/lib/media/media-url.ts:1), which uses the same-origin media proxy for remote URLs.
- That keeps drawing display and snapshot behavior aligned.

### 3. Ignore bogus `set_mode`
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:184)
- `sanitizeCommands()` now ignores invalid canvas modes instead of coercing them into `distribution`.
- Result: no more phantom `Bench` board from garbage mode payloads.

### 4. Stronger drawing submit UX
- [components/lesson/drawing-canvas.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.tsx:1)
- Replaced icon-only snapshot affordance with an explicit `Submit Markup` button label.
- Tutor wrapper copy now says exactly what to press.

### 5. Skip SVG multimodal description
- [lib/media/lesson-image-search.ts](/Users/nuru/sanchrobytes/algebra/lib/media/lesson-image-search.ts:1)
- SVG candidates now skip the vision describe step and use a deterministic text fallback description instead.
- This removes the pointless 400 for unsupported SVG vision inputs.

## Before
- model sends drawing command
- runtime may treat asset id as URL
- background image 404s
- invalid mode payload can surface `Bench`
- submit action is icon-only
- SVG description can throw 400

## After
- asset ids resolve back to image URLs
- tutor drawing background loads through the media proxy
- invalid `set_mode` is ignored
- submit action is labeled `Submit Markup`
- SVGs avoid unsupported multimodal describe calls

## Regression Tests
- [lib/tutor/runtime.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/runtime.test.ts:1)
  - resolves drawing background when the model wrongly sends an asset id in `backgroundImageUrl`
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
  - ignores invalid `set_mode` payloads instead of forcing `distribution`
- [components/lesson/drawing-canvas.test.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.test.tsx:1)
  - checks explicit `Submit Markup` affordance
- [lib/media/lesson-image-search.test.ts](/Users/nuru/sanchrobytes/algebra/lib/media/lesson-image-search.test.ts:1)
  - skips multimodal description for SVG and still returns a usable asset

## Alternatives Considered
- Let the model keep using `backgroundImageUrl` freely and hope it sends real URLs
  - Rejected. Not evidence-based.
- Normalize every bad mode to `distribution`
  - Rejected. That caused the `Bench` regression.
- Keep the camera icon only
  - Rejected. Too implicit.
- Retry SVG descriptions through the same multimodal path
  - Rejected. Unsupported input type, wrong seam.

## Why This Approach Is Best
- Fixes the real data contract, not the symptom.
- Makes tutor image markup robust against common model mistakes.
- Removes noisy/incorrect stage fallthrough.
- Improves submit clarity without inventing extra flows.

## Fallbacks
- No broad new fallback added.
- No heuristic “guess the board mode” hack added.
- Root-cause fix only.
