# Live Tutor Silero VAD Swap

## Date
2026-04-22

## Read When
- live tutor barge-in feels unreliable
- someone says "we already use Silero VAD everywhere"
- tutor voice dock speech-start detection feels too sensitive or too weak

## Symptom
- learner speech during tutor playback was not reliably detected for barge-in
- tuning the dock felt fragile because it depended on raw volume thresholds instead of a speech model

## Root Cause
- the app had two different VAD paths:
  - [components/lesson/voice-input.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/voice-input.tsx) already used browser Silero VAD through `@ricky0123/vad-react`
  - [components/tutor/tutor-voice-dock.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.tsx) still used the custom energy-based [lib/vad/vad-engine.ts](/Users/nuru/sanchrobytes/algebra/lib/vad/vad-engine.ts)
- so the live tutor path was not actually using Silero at all
- after the swap, barge-in still had one unsafe edge:
  - the onboarding flow mounted [TutorVoiceDock](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.tsx) without any `teacherSpeechText` reference or playback stop signal
  - short garbage transcripts like speaker echo misfires could still be treated as learner barge-in
- the next over-correction broke barge-in in the opposite direction:
  - the dock waited for the full captured speech segment to finish transcription before interrupting TTS
  - that was safer for echo filtering, but it was no longer real barge-in because the tutor kept talking while the learner interrupted
- even after provisional pause came back, interrupted turns still felt slow:
  - the dock kept streaming STT suppressed during provisional barge-in
  - so the learner interrupt path still fell back to [app/api/assemblyai/transcribe/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/assemblyai/transcribe/route.ts), which is a slower upload-and-poll batch route instead of the live websocket transcript path

## Fix
- added [lib/vad/silero-mic-vad.ts](/Users/nuru/sanchrobytes/algebra/lib/vad/silero-mic-vad.ts)
- `TutorVoiceDock` now uses `MicVAD` with Silero `v5`
- the controller reuses the live tutor mic stream instead of opening a second permanent capture path
- tutor-speaking mode raises Silero thresholds to reduce false positives from echo bleed
- barge-in now refuses to transcribe teacher speech at all unless the dock has the current teacher text as an echo reference
- onboarding now passes the current tutor prompt into the dock and a real stop signal into [TutorVoicePlayer](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-player.tsx)
- short low-signal transcripts are ignored unless they look like an actual learner interruption
- the voice player now supports a provisional `paused` state
- real teacher-speech barge-in now uses a two-phase flow:
  - Silero `onSpeechStart` pauses TTS immediately
  - if the captured segment later looks like tutor echo, playback resumes
  - if the transcript looks like a real learner interruption, the tutor is then hard-stopped and the learner transcript is submitted
- aligned the tutor-speaking Silero options with the repo's v5 guidance:
  - short `redemptionMs`
  - tiny `preSpeechPadMs`
  - `onVADMisfire` resumes playback after provisional false positives
- interrupted turns now unsuppress live websocket STT immediately when provisional barge-in begins
- if AssemblyAI streaming finishes the learner interrupt first, that transcript is sent straight to the tutor without waiting for the slower batch fallback
- batch `/api/assemblyai/transcribe` stays only as a fallback if the live websocket transcript does not land in time

## Before
- live tutor dock used a smoothed level detector
- echo suppression was hand-tuned with fixed thresholds
- behavior depended heavily on loudness rather than speech probability
- onboarding could listen during tutor playback without enough information to safely distinguish tutor echo from learner speech
- after the first transcript-only fix, barge-in no longer interrupted in time

## After
- live tutor dock uses a Silero speech model for speech-start detection
- the barge-in path is aligned with the app's existing browser VAD stack
- tutor-speaking threshold tuning now happens through Silero frame-processor options
- every tutor-speaking path now carries the teacher speech text needed for echo filtering
- onboarding can stop its own tutor playback when the learner really barges in
- learner barge-in pauses the tutor immediately again without reverting to the old self-stop loop
- false positives can safely recover by resuming paused tutor playback
- interrupted turns now use the same fast path as ordinary post-tutor speech whenever possible, so LLM handoff latency is much closer to the normal speaking flow

## Tests
- [lib/vad/silero-mic-vad.test.ts](/Users/nuru/sanchrobytes/algebra/lib/vad/silero-mic-vad.test.ts)
- [components/tutor/tutor-voice-dock.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.test.tsx)
- [lib/vad/barge-in-transcription.test.ts](/Users/nuru/sanchrobytes/algebra/lib/vad/barge-in-transcription.test.ts)
- [components/tutor/onboarding-intake.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/onboarding-intake.test.tsx)
- [components/tutor/tutor-voice-player.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-player.test.tsx)
- [components/tutor/tutor-shell.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.test.tsx)
- [components/tutor/tutor-voice-dock.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.test.tsx) now also covers using the websocket transcript fast path for barge-in instead of the batch fallback

## Alternatives Considered
- keep tuning the custom energy gate
  - rejected: symptom management only
- open a separate Silero mic stream next to AssemblyAI streaming
  - rejected: avoidable duplication and more browser audio complexity
- interrupt only after transcription completes
  - rejected: safe, but not real barge-in
- interrupt immediately and never resume
  - rejected: that is what caused self-stop loops on false positives
- keep using `onSpeechRealStart`
  - rejected after reviewing the upstream examples and docs: too delayed for live barge-in once we already have a safe provisional-pause recovery path

## Fallbacks
- no new broad fallback added
- unsupported path not expanded
- one intentional threshold mode switch remains: default vs tutor-speaking
- one narrow recovery path added: provisional pause can resume if the captured segment is rejected as echo
