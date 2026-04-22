# Tutor Audio Gesture Regression

## Symptoms

- Tutor text appeared, but no tutor speech was audible.
- Learner microphone never became usable in the live tutor flow.
- This showed up after the scripted onboarding wizard was removed and the tutor
  intake began auto-starting on page load.

## Root Cause

The old onboarding flow forced a user click before voice features started.
That click unintentionally satisfied the browser's user-gesture requirement for
audio playback and microphone startup.

After switching to model-owned intake, the app attempted to:

- auto-play tutor audio on first render
- auto-start microphone streaming on first render

without any user gesture.

The backend was healthy:

- `/api/tts` returned valid MP3 audio
- `/api/assemblyai/token` returned a valid streaming token

So the break was at the browser interaction boundary, not the voice services.

## Fix

- Added a one-tap voice unlock in the tutor shell.
- Tutor text still appears immediately, so the AI still asks first.
- TTS and STT only arm after the learner clicks `Enable voice and mic`.
- Once unlocked, the current tutor turn can speak and the voice dock can begin
  listening normally.

## Tests

- Added `components/tutor/tutor-shell.test.tsx`
- Re-ran tutor shell and tutor experience tests
- Re-ran full `npm test`
- Re-ran `npx tsc --noEmit`

## Prevention

- Any future "auto-start" conversational flow must account for browser
  autoplay and microphone permission rules.
- AI-owned dialogue is fine; browser-owned capability unlock still needs an
  explicit user gesture.
