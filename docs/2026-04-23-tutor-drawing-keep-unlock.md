# Tutor Drawing Keep Unlock Regression

## Date
2026-04-23

## Read When
- tutor keeps the same drawing task for the next round
- drawing toolbar looks greyed out after learner submits markup
- learner cannot keep marking the same image after tutor feedback

## Symptoms
- Learner submits drawing markup once.
- Tutor replies with feedback and keeps the same drawing task on screen.
- The same drawing canvas stays visible, but the toolbar and submit action remain disabled.

## Root Cause
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:864)
- Drawing mode stored a local `submitted` lock inside `DrawingScene`.
- That lock was only cleared when the drawing scene itself changed via `sceneRevision`, prompt, or background image.
- When the tutor returned `canvasAction: keep`, the drawing scene key stayed the same, so React preserved the old local `submitted=true` state into the next tutor turn.

## Fix
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:864)
  - Added `speechRevision` to tutor canvas host drawing flow.
  - Reset only the local drawing submit lock when a fresh tutor speech turn arrives.
  - Kept the scene key tied to actual drawing-scene changes, so a kept task unlocks without pretending it is a brand new scene.
- [components/tutor/tutor-shell.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.tsx:323)
  - Passed `snapshot.speechRevision` into `TutorCanvasHost`.

## Before
- learner submits markup
- local drawing scene flips to submitted
- tutor says `keep`
- same drawing scene re-renders with same key
- local submit lock survives
- tools stay greyed out

## After
- learner submits markup
- local drawing scene flips to submitted while waiting for tutor reply
- next tutor speech turn increments `speechRevision`
- local submit lock resets
- same kept drawing task becomes usable again

## Regression Tests
- [components/tutor/tutor-canvas-host.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.test.tsx:178)
  - confirms a kept drawing task unlocks when the next tutor speech turn arrives

## Alternatives Considered
- Force a new drawing `sceneRevision` on every tutor keep turn
  - Rejected. Wrong seam. `keep` should not masquerade as replace.
- Remount the whole drawing scene on every tutor speech turn
  - Rejected. That would also wipe in-memory drawing state.

## Why This Approach Is Best
- Fixes the actual stale-local-state seam.
- Preserves kept-scene identity.
- Avoids fake runtime fallbacks and avoids over-resetting the canvas.

## Fallbacks
- No fallback added.
- No heuristic unlock hack added.
- Root-cause fix only.
