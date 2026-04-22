# Tutor Intro Voice Startup Race

## Date
2026-04-21

## Read When
- Intro tutor line is silent on first load
- STT sits on "Connecting live transcript..."
- Voice starts working only after toggling the mic or speaking once

## Symptoms
- The first tutor utterance did not reliably play on session start.
- The microphone dock often entered `connecting` before the intro line had a chance to play.
- After the user manually toggled the mic, later turns behaved better because the startup ordering had changed and the page already had user interaction.

## Root Cause
Two things overlapped:

1. Browser autoplay policy can block the very first audible playback on a fresh page load.
2. Our app had a sequencing bug on top of that browser constraint:
   - `TutorVoiceDock` auto-started STT as soon as the shell rendered.
   - `teacherAudioPending` was only set later by `TutorVoicePlayer.onRequestStart()`.
   - That meant the first render after `startSession()` or `submitTranscript()` still told the dock that the teacher was not busy.
   - Result: STT could jump into `connecting` before the intro turn had properly claimed the lane.

This was not an API outage. It was an ownership/order bug in the client startup flow.

## Fix
The fix landed in two places:

- [components/tutor/tutor-experience.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.tsx:20)
  - A fresh tutor turn now marks `teacherAudioPending` **before** we ask the session hook to fetch the next snapshot.
  - This happens for both the initial auto-start and later learner transcript submissions.
- [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:74)
  - `submitTranscript()` now returns whether it actually submitted a turn, so the experience layer can clear pending state if nothing was sent.

## Before
- New snapshot requested
- Shell rendered with `teacherAudioPending = false`
- Dock auto-connected STT
- Voice player marked pending only afterward

## After
- New snapshot requested
- Experience layer immediately marks `teacherAudioPending = true`
- First render of the shell already suppresses STT auto-connect
- Voice player then owns the turn and clears pending on start, complete, or error

## Regression Test
- [components/tutor/tutor-experience.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-experience.test.tsx:90)
  - Verifies a fresh tutor snapshot is rendered with `teacherAudioPending: true`.
- [components/tutor/tutor-shell.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.test.tsx:56)
  - Verifies the dock suppresses auto-listen while teacher audio is pending.

## Prevention
- Keep turn ownership in the experience/session layer, not split across sibling effect timing.
- Treat "new tutor utterance incoming" as state that exists **before render**, not something discovered later from a child callback.
- When debugging first-turn audio, separate browser autoplay limits from app sequencing bugs so we do not misdiagnose one as the other.

## Alternatives Considered
- Add more mic reconnect retries.
  - Rejected. Would hide the race without fixing turn ownership.
- Reintroduce a required click gate.
  - Rejected. User explicitly does not want that flow.
- Put more startup state inside `TutorShell`.
  - Rejected. The shell should stay presentation-first; the experience layer already knows when a new tutor turn is being requested.

## Fallbacks
- No new fallback path added.
- No extra click gate added.
