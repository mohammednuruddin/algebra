# Image and Canvas Alignment in Live Tutor

## Date
2026-04-22

## Read When
- tutor speech says "look at the diagram" but the image is not visibly on stage
- tutor spawns a quiz that does not match what it is saying
- right pane shows a blank or irrelevant canvas when speech alone would be better

## Symptoms
- The tutor could say "look at this plant diagram" while the learner mainly saw a separate multiple-choice task.
- Active images were rendered only in the left scroll column, so long tutor speech could push the image below the fold.
- Even when the tutor returned no meaningful canvas scene, the app still rendered the default blank distribution stage on the right.

## Root Cause
Two separate problems were stacking:

1. **Prompt contract too weak**
   - [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:950)
   - The model was not told strongly enough that:
     - speech-only turns are valid
     - image-only turns are valid
     - image-inspection speech must not spawn an unrelated task

2. **UI stage policy too eager**
   - [components/tutor/tutor-shell.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.tsx:1)
   - The right pane always rendered the canvas host for non-intake turns, even when the canvas had no real content.
   - Active images lived only in the left pane, which made "look at the image" unreliable on desktop.

## Fix
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:950)
  - Strengthened both opening-turn and live-turn prompts:
    - commands can be empty when speech alone is enough
    - image-only turns are allowed
    - if the tutor asks the learner to inspect an image or diagram, it must not spawn an unrelated quiz in that same turn
- [components/tutor/tutor-shell.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.tsx:1)
  - Added a real "has visible canvas scene" check so blank default canvases do not render.
  - Added a desktop stage image panel so active images appear in the main stage area, not only in the left scroll column.
  - Left-pane image remains available on mobile, where there is no right stage.

## Before
- tutor says "look at the diagram"
- image may be buried below the speech in the left pane
- right pane may show a different task
- blank default stage can appear even when no canvas was requested

## After
- image can appear in the main stage area on desktop
- blank default canvas no longer appears when the tutor is only talking
- prompt pushes the model toward image-only, speech-only, or directly matching image+task turns

## Regression Tests
- [components/tutor/tutor-shell.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.test.tsx:1)
  - hides the blank stage when there is no real canvas content
  - shows the active image in the stage area
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
  - checks the prompt explicitly allows speech-only/image-only turns
  - checks the prompt forbids unrelated tasks when the tutor asks the learner to inspect an image

## Alternatives Considered
- Keep the image only in the left pane and hope users scroll
  - Rejected. That is the bug.
- Add runtime heuristics that delete model commands whenever speech and canvas "feel mismatched"
  - Rejected. Too brittle and too magical.
- Always force a canvas because "dead air"
  - Rejected. User experience gets worse, not better.

## Why This Approach Is Best
- Fixes both the model contract and the rendering contract.
- Keeps the tutor model flexible.
- Avoids heavy-handed runtime censorship.
- Makes image-referenced teaching actually visible.

## Fallbacks
- No broad fallback added.
- No heuristic command stripping added.
- Root-cause fix only: stronger prompt plus truthful stage rendering.
