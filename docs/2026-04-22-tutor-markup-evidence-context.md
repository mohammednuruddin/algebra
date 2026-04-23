# Tutor Markup Evidence Context

## Date
2026-04-22

## Read When
- tutor sees a learner-marked image but responds as if the markings were part of the original diagram
- tutor fails to acknowledge what the learner circled, traced, or pointed to
- tutor keeps re-asking instead of evaluating the learner’s markup

## Symptoms
- The model could inspect the marked image but still talk about the highlighted area as if it were already in the source diagram.
- It did not have enough context to know that the learner was the one who added the circle/mark.
- Generic evidence text like "Learner submitted a marked image for review" was too weak to explain the semantics of the attachment.

## Root Cause
- We were sending the marked-up learner image, but not enough structured meaning about it.
- The model needed three things together:
  1. the current drawing task prompt
  2. the original unmarked reference image
  3. the learner-marked answer image
- Without that pairing, the model could see marks but not reliably distinguish learner-added markup from original diagram content.

## Fix
- [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts:220)
  - derive and forward:
    - current drawing task prompt
    - reference image URL
    - current brush color
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1047)
  - when drawing evidence is attached:
    - send a text instruction explaining that the learner-marked image is the answer attempt
    - attach the original reference image first
    - attach the learner-marked answer image second
    - attach a final markup-only overlay image when available
    - tell the model to acknowledge the learner’s markup before moving on
  - also tell the tutor to explicitly instruct the learner which color to use for image-markup turns
- [components/lesson/drawing-canvas.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.tsx:1)
  - snapshot submission now emits:
    - composite image
    - markup-only overlay image
    - stroke color list
    - stroke count
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:760)
  - drawing canvas now remounts when the drawing task changes, so old markup does not drift into the next prompt
  - removed the redundant large prompt block above the drawing canvas, since tutor speech already gives the instruction

## Why Color Alone Was Not Enough
- A reserved color is helpful, so we now support that cue.
- But color alone is not trustworthy enough:
  - original diagrams may already contain that color
  - learners may use a different color
  - the model still needs the original reference image and task prompt to compare against
- So the chosen fix is:
  - color cue
  - plus task prompt
  - plus original image
  - plus marked-up learner image

## Regression Tests
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
  - verifies drawing-evidence prompt now includes task semantics, expected color, original image, learner-marked image, and overlay image
- [app/api/tutor/turn/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.test.ts:1)
  - verifies route forwards drawing task prompt, reference image URL, and brush color alongside canvas evidence
- [components/tutor/tutor-canvas-host.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.test.tsx:1)
  - verifies tutor drawing mode forwards enriched drawing submission payload

## Fallbacks
- No broad fallback added.
- No heuristic guesswork-only fix.
- Root-cause contract fix only.
