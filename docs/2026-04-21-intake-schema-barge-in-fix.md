# Tutor Intake Schema and Barge-In Fix

## Date
2026-04-21

## Read When
- intake keeps asking extra questions after it already knows enough
- tutor accepts weird `awaitMode` values like `open`, `listening`, or booleans
- filler fragments like `Um,` or `How is—` become real learner turns
- learner cannot cleanly interrupt tutor speech
- tutor speaks in long chunks instead of short interactive turns

## Symptoms
- The intake loop continued interviewing the learner after the topic and level were already known.
- Invalid model output such as `awaitMode: "open"` or `awaitMode: true` was accepted as if it were healthy output.
- Filler and cut-off STT fragments polluted tutor history and caused fabricated follow-up questions.
- Tutor speech could not be cleanly interrupted by the learner.
- Tutor replies drifted toward mini-lectures instead of short interactive turns.

## Root Causes
1. **Schema too soft**
   - Tutor intake told the model to return `awaitMode`, but did not enumerate the only legal values strongly enough.
   - The sanitizer silently coerced invalid values instead of flagging them.

2. **Meaningless STT turns were treated as meaningful**
   - Filler-only utterances and trailing continuation fragments were accepted as completed learner turns.
   - Intake then overfit on junk inputs such as `Hi.`, `Um,`, and `How is—`.

3. **Intake stop-condition too weak**
   - The system relied too heavily on the model deciding when enough context had been collected.
   - Once topic and rough learner level were known, there was no deterministic app-side promotion into the lesson.

4. **Tutor speech interruption path missing**
   - Tutor TTS playback had no explicit stop signal tied to learner speech detection.
   - The learner could not cleanly barge in.

5. **Prompt too permissive on verbosity**
   - Intake and lesson prompts encouraged “conversational” responses but did not constrain reply length tightly enough.

## Fix
- [lib/tutor/intake-heuristics.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/intake-heuristics.ts:1)
  - Added shared heuristics for:
    - meaningful learner transcript detection
    - deterministic lesson auto-start
    - tutor barge-in threshold
- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:1)
  - Invalid `awaitMode` values are normalized and flagged in debug traces.
  - Intake now auto-starts the lesson once topic + rough level are known, or when the learner asks a direct content question on a known topic.
  - Prompts now require short, interactive turns and explicitly forbid motivation interviews unless the learner asks for that.
- [app/api/tutor/turn/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.ts:1)
  - Filler-only intake fragments are ignored instead of being sent to the model.
- [components/tutor/tutor-voice-dock.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.tsx:1)
  - Meaningless completed transcripts are dropped client-side.
  - Learner speech energy can now trigger tutor barge-in while TTS is active.
- [components/tutor/tutor-voice-player.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-player.tsx:1)
  - Added `stopSignal` support so learner speech can interrupt tutor playback.
- [components/tutor/tutor-experience.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.tsx:1)
  - Added tutor stop-signal state to coordinate barge-in from the voice dock.
- [lib/stt/assemblyai-streaming.ts](/Users/nuru/sanchrobytes/algebra/lib/stt/assemblyai-streaming.ts:1)
  - Restored the tested turn-detection tuning and reject completion when the last word is explicitly unstable.

## Before
- junk transcript comes in
- route sends it to intake model
- intake invents intent/motivation/background
- invalid `awaitMode` survives as “clean”
- tutor keeps talking and learner cannot cleanly cut in

## After
- junk transcript is ignored
- invalid `awaitMode` is normalized and flagged
- once topic + rough level are known, the lesson starts
- direct learner questions can start the lesson sooner
- learner speech can interrupt tutor playback
- prompts push the tutor toward short, interactive turns

## Regression Tests
- [lib/tutor/model.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.test.ts:1)
- [lib/tutor/intake-heuristics.test.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/intake-heuristics.test.ts:1)
- [app/api/tutor/turn/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/turn/route.test.ts:1)
- [components/tutor/tutor-voice-player.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-player.test.tsx:1)
- [components/tutor/tutor-voice-dock.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.test.tsx:1)
- [lib/stt/assemblyai-streaming.test.ts](/Users/nuru/sanchrobytes/algebra/lib/stt/assemblyai-streaming.test.ts:1)

## Prevention
- Treat model schema drift as a real fallback condition, not “good enough.”
- Keep STT transcript guards close to the product flow that consumes them.
- Do not let the intake model decide forever; app-side stop conditions should exist once enough context is known.
- Separate “keep mic available for barge-in” from “accept any transcript as meaningful.”

## Alternatives Considered
- Accept invalid `awaitMode` and silently coerce it.
  - Rejected. Hides schema drift.
- Let the model keep interviewing until it personally decides to stop.
  - Rejected. Too easy to overfit on junk turns.
- Keep mic fully blocked while tutor speaks.
  - Rejected. Prevents user barge-in.
- Clamp long tutor replies in the UI after generation.
  - Rejected. Prompt and intake policy are the right seam.

## Fallbacks
- No new broad fallback path added.
- No fake onboarding/interview state added.
- Only targeted normalization/guarding for invalid model fields and meaningless learner fragments.
