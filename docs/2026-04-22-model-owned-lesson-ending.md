# Model-Owned Lesson Ending

## Date
2026-04-22

## Read When
- learner says they want to end the lesson but the tutor keeps teaching
- `sessionComplete` stays false even after a clear stop request
- tutor should decide when to offer "one more or call it a day"

## Symptoms
- A learner could say things like "let's end this lesson" or "I said we should end the lesson" and the tutor still returned more teaching plus another task.
- Server logs showed the latest learner transcript correctly, but the model still kept `sessionComplete: false`.
- The lesson only ended if the model happened to infer wrap-up on its own.

## Root Cause
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1000)
  - The live-turn prompt told the model how to teach, but not how to end.
  - There was no explicit instruction that a direct learner stop request should immediately flip `sessionComplete` to `true`.
  - There was no explicit instruction for the softer mastery case either:
    - learner seems to understand enough
    - tutor may ask "one more example or call it a day?"
    - keep `sessionComplete=false` until the learner answers

## Fix
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1000)
  - Added explicit ending rules to the live tutor system prompt:
    - direct learner stop/end/done intent => `sessionComplete=true`
    - include `complete_session`
    - do not assign another task after an explicit stop request
    - after enough progress, the tutor may offer a brief continue-or-stop choice
    - that choice keeps `sessionComplete=false` until the learner answers
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:748)
  - Tightened intake wording to explicitly forbid class/motivation/curiosity interviews.

## Before
- learner: "end the lesson"
- tutor prompt mostly said "keep teaching"
- model often kept `sessionComplete=false`
- tutor gave another task instead of ending

## After
- learner: "end the lesson"
- prompt explicitly tells model to end now
- model should return `sessionComplete=true` and `complete_session`
- if learner seems ready but has not asked to stop, tutor may ask whether to continue or call it a day

## Regression Tests
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
  - checks live-turn prompt includes explicit stop-intent ending rules
  - checks live-turn prompt includes the softer "one more example or call it a day" rule
- [app/api/tutor/turn/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.test.ts:1)
  - checks route marks the snapshot `completed` when the model ends the session

## Alternatives Considered
- Runtime completion gate like `zo`
  - Rejected for this request. You explicitly wanted completion to stay model-owned.
- Client-side stop parser that bypasses the model
  - Rejected. Same reason.
- Leave it entirely implicit and hope the model "just knows"
  - Rejected. That was the bug.

## Why This Approach Is Best
- Keeps lesson ending model-owned, as requested.
- Gives the model explicit behavioral rules instead of vague vibes.
- Avoids adding a second runtime authority for completion.
- Small surface area, low risk, easy to test.

## Fallbacks
- No new runtime fallback added.
- No deterministic stop gate added.
- Root-cause fix only: stronger model contract.
