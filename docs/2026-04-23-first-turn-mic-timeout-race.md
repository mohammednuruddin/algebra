# First-Turn Mic Timeout Race

## Date
2026-04-23

## Read When
- first tutor turn speaks, then mic shows `Connecting...`
- first mic attempt times out, but tapping retry works
- cold-start STT works on retry but not on the first turn

## Symptoms
- On the first live tutor turn, the tutor voice could finish speaking before the microphone settled into `Listening...`.
- The dock could then time out with `Microphone connection timed out. Tap the mic to retry.`
- Tapping the mic to retry usually worked immediately afterward.

## Root Cause
- `TutorVoiceDock` created the ElevenLabs realtime websocket before attaching `onopen`, `onerror`, and `onclose` handlers.
- The code then awaited `SileroMicVadController.start()`, which is slower on a cold page because it has to boot the VAD runtime and assets.
- On a warm retry, Silero startup is much faster, so the race disappears.
- On the first turn, the websocket could open while Silero was still booting.
- Because the open event fired before `onopen` was attached, the dock missed the success signal, never cleared the connection timeout, and eventually showed the timeout error.

## Before
- create websocket
- start timeout
- await cold Silero boot
- attach websocket lifecycle handlers
- if socket already opened during Silero boot, the open event was lost
- timeout fired even though the transport had already connected

## After
- create websocket
- start timeout
- attach websocket lifecycle handlers immediately
- await Silero boot afterward
- early socket open/close/error events are now observed correctly
- successful first-turn connects reach `Listening...` instead of falling into the false timeout path

## Fix
- [components/tutor/tutor-voice-dock.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.tsx:365)
  - moved websocket lifecycle handler registration to happen immediately after socket creation and timeout setup, before awaiting Silero startup

## Regression Test
- [components/tutor/tutor-voice-dock.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-voice-dock.test.tsx:330)
  - simulates a cold-start websocket that opens before deferred Silero boot completes
  - verifies the dock stays healthy and does not show the timeout error

## Prevention
- Attach lifecycle handlers before any awaited initialization that could let external events fire first.
- Treat warm-retry success as a race-condition smell, not evidence that the first path is healthy.
- When a websocket is created early for latency reasons, make its lifecycle observable immediately.

## Alternatives Considered
- Increase the 8-second timeout.
  - Rejected. That would only hide the race.
- Add another automatic retry.
  - Rejected. Same symptom treatment; wrong layer.
- Delay websocket creation until all mic/VAD boot work finishes.
  - Rejected for now. It would avoid the race, but it also gives up the warm-connection behavior we intentionally want.

## Fallbacks
- No new fallback added.
- No extra retry loop added.
- Root-cause fix only.
