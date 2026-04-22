read_when: tutor speech appears in the UI but does not reach the model, especially for short answers like yes, no, hi, okay, or filler-like speech.

# Tutor transcript heuristics removal

## Symptoms

- Learner said a short response.
- The transcript sometimes appeared in the UI.
- But no tutor turn was sent to the model.
- Intake and live voice behavior could silently swallow speech.

## Root cause

The tutor flow had app-side transcript heuristics that tried to decide whether learner speech was "meaningful enough."

That logic was used in the wrong places:

- intake route filtering
- live voice dispatch filtering
- model-side intake readiness promotion

So learner speech was being judged by regex rules instead of being passed through to the tutor model.

## What changed

- Removed tutor transcript heuristics from the flow entirely.
- Deleted the old heuristics module and tests.
- Intake route now forwards any non-empty transcript instead of swallowing filler-like speech.
- Live voice dock now dispatches any completed non-empty AssemblyAI turn.
- Model intake sanitizer no longer secretly promotes `readyToStartLesson` with hidden app heuristics.

## Before

- `Um,`
- `hi`
- `mhm`
- `okay`
- one-word replies

could be shown locally but dropped before reaching the tutor model.

## After

Any non-empty completed learner transcript is forwarded.

Only truly empty input stays blocked.

## Why this approach is best

Rejected:

- keeping separate "smart" transcript gates
- trying to guess whether a learner utterance is worth sending

Reason:

- the tutor model should interpret learner intent
- regex gates were hiding real user input

Chosen approach:

- no transcript heuristics in the tutor flow
- trust completed STT turns and non-empty user input

## Tests

- `app/api/tutor/turn/route.test.ts`
  - short/filler-like intake speech is forwarded
- `lib/tutor/model.test.ts`
  - intake sanitizer no longer auto-promotes readiness behind the model's back
- `lib/stt/assemblyai-streaming.test.ts`
  - turn completion logic still behaves correctly

## Fallbacks

- No new fallback added.
