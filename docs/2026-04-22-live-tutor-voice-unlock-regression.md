# Live Tutor Voice Unlock Regression

## Date
2026-04-22

## Read When
- first tutor turn shows text but does not speak
- mic sits on `Connecting...` or starts too early on page load
- voice starts working only after the learner clicks the mic or another control
- someone proposes "no unlock click" for a cold page load

## Symptoms
- The opening tutor line rendered as text, but first-turn audio was unreliable on a fresh load.
- The microphone could begin connecting before tutor audio had actually started.
- After the learner clicked a control, later turns behaved better because the page now had sticky user activation.

## Root Cause
Two regressions overlapped:

1. The shell no longer respected the browser's user-activation boundary for autoplay and microphone startup on a cold page load.
2. The dock treated `teacherAudioPending` as if it were already safe to auto-connect STT.

That meant we were trying to do both of these too early:
- start tutor audio before the page had sticky user activation
- start STT while tutor audio was only pending, not actually speaking

## Evidence
- User report matched the earlier gesture-regression pattern exactly: silent first turn, then success after a manual click.
- Current code path rendered the voice dock immediately and enabled `TutorVoicePlayer` on first live snapshot.
- `TutorVoiceDock` auto-connect only checked runtime readiness and input mode; it did not block on `teacherAudioPending`.
- MDN documents autoplay/Web Audio as gated by user activation, and `navigator.userActivation.hasBeenActive` as the sticky activation signal:
  - [UserActivation](https://developer.mozilla.org/en-US/docs/Web/API/UserActivation)
  - [User activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation)

## Fix
- [components/tutor/tutor-shell.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.tsx:1)
  - Restored an honest one-tap browser unlock step.
  - The footer now shows a single unlock action before enabling TTS/STT.
- [components/tutor/tutor-voice-dock.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.tsx:1)
  - Added explicit `teacherAudioPending` handling.
  - STT no longer auto-connects while tutor audio is only pending.
  - Barge-in still works once tutor speech has actually started.

## Before
- first live snapshot arrives
- tutor voice player requests audio immediately
- dock also auto-connects immediately
- browser may reject first-turn autoplay on a cold page
- learner sees confusing startup state until a later click unlocks the page

## After
- first live snapshot arrives
- learner gets one clear unlock action
- after unlock, the current tutor turn can speak
- STT waits until pending tutor audio resolves, then reconnects for actual barge-in

## Regression Tests
- [components/tutor/tutor-shell.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.test.tsx:1)
  - verifies the unlock action appears before cold-start voice is armed
  - verifies the current tutor turn arms after unlock
  - verifies shell keeps `teacherAudioPending` separate from `teacherSpeaking`
- [components/tutor/tutor-voice-dock.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.test.tsx:1)
  - verifies STT does not auto-connect while tutor audio is only pending

## Prevention
- Do not equate "AI should speak first" with "browser capabilities can start without user activation."
- Keep `teacherAudioPending` and `teacherSpeaking` as different states with different consequences.
- Any future attempt to remove the unlock step must show real cold-load browser evidence, not just warm-tab behavior.

## Alternatives Considered
- Keep auto-starting everything and hope autoplay succeeds.
  - Rejected. That is the bug.
- Block STT for all tutor speech.
  - Rejected. Breaks barge-in.
- Add retry/fallback loops around silent startup.
  - Rejected. Masks the browser boundary instead of respecting it.

## Fallbacks
- No new broad fallback added.
- No extra retry loop added.
- One explicit unlock step restored for true cold-load browser constraints.
