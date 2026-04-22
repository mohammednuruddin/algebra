# Tutor Intake Empty Content Fix

## Date
2026-04-22

## Read When
- `/api/tutor/session/create` returns 500
- browser shows `Tutor intake returned no content`
- intake works sometimes, then randomly dies before first tutor question

## Symptoms
- Session creation failed with HTTP 500.
- Browser surfaced `Tutor intake returned no content`.
- The failure happened before the first intake snapshot was created, so the tutor never came up.

## Root Cause
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:503) treated missing `choices[0].message.content` as a fatal hard error.
- The opening tutor intake path had no resilience wrapper, unlike the other tutor model entrypoints that already fall back when the upstream provider misbehaves.
- Result: one upstream shape glitch caused a full session-create crash.

## Fix
- Added a dedicated intake fallback builder in
  [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:503)
- Wrapped `generateTutorIntakeTurn()` so:
  - raw response fields are captured when available
  - upstream missing-content / invalid-JSON errors no longer bubble to a 500
  - the function returns a short usable intake turn plus fallback debug metadata instead

## Before
- provider returns no `message.content`
- intake throws
- `/api/tutor/session/create` returns 500

## After
- provider returns no `message.content`
- intake falls back to a short usable opening turn
- session create still succeeds
- debug trace marks `usedFallback: true`

## Regression Test
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:189)
  - proves missing content now returns a usable intake response instead of throwing

## Alternatives Considered
- Keep throwing and just improve the error message.
  - Rejected. Better logs would still leave the product broken.
- Retry the upstream call automatically.
  - Rejected for now. Extra retries add latency and still need a safe terminal behavior.
- Global catch in the route only.
  - Rejected. The fix belongs at the intake model seam, where the failure originates.

## Fallbacks
- Added one targeted fallback for structurally empty intake model responses.
- No new generic fallback ladder.
