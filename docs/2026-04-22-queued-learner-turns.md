# Queued Learner Turns During In-Flight Tutor Requests

## Date
2026-04-22

## Read When
- a learner says something but it never shows up in `[tutor:turn]` logs
- the model prompt shows an older learner message instead of the most recent one
- canvas submit and voice transcript happen close together

## Symptoms
- The learner's latest utterance never appeared in `/api/tutor/turn` logs.
- The next model prompt used an older learner input such as `[Fill-in-the-blank answers: ...]`.
- No fallback triggered, because nothing failed server-side; the later learner turn never reached the server.

## Root Cause
- [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:1)
  - `submitTranscript()` returned `false` whenever `isSubmittingTurn` was already true.
  - That meant any learner transcript arriving while another turn was in flight was silently discarded on the client.
  - Common reproduction:
    1. learner submits a canvas answer
    2. `/api/tutor/turn` starts
    3. learner immediately speaks again
    4. second transcript hits `isSubmittingTurn === true`
    5. transcript is dropped, so no server log ever exists for it

## Fix
- [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:1)
  - Added an in-memory queue for learner transcripts that arrive while a turn is already submitting.
  - Queued transcripts flush automatically after the active turn finishes.
  - Flush uses the newest snapshot returned by the previous turn, not stale client state.
  - Added a dev-only `[tutor:turn_queue]` log when a learner transcript gets queued.

## Before
- second learner turn arrives during in-flight request
- client returns `false`
- transcript disappears
- no `/api/tutor/turn` log exists for that learner message

## After
- second learner turn arrives during in-flight request
- client queues it
- first request completes and updates snapshot
- queued turn submits with the updated snapshot
- learner message now appears in normal server logs

## Regression Test
- [lib/hooks/use-tutor-session.test.tsx](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.test.tsx:1)
  - proves a second learner transcript is queued instead of dropped
  - proves the queued request uses the updated snapshot from the first response

## Prevention
- Never silently discard learner turns because a request is already in flight.
- If sequencing matters, queue and drain explicitly.
- Keep submission state in refs when async race timing matters; state alone is too soft here.

## Alternatives Considered
- Keep dropping late learner turns and only add a console warning.
  - Rejected. Better diagnosis, still broken product behavior.
- Merge late learner text into the active in-flight request.
  - Rejected. Too invasive and risks corrupting request intent.
- Add retry/fallback logic on the server.
  - Rejected. The server never saw the missing turn.

## Fallbacks
- No new fallback path added.
- No transcript coercion added.
- Root-cause fix only: queue instead of drop.
