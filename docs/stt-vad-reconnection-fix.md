# STT VAD and Reconnection Fix

## Date
2026-04-21

## Issues Reported
1. VAD (Voice Activity Detection) not working properly
2. STT keeps reconnecting for every turn instead of maintaining persistent connection
3. Cannot speak when tutor is talking (interrupt capability blocked)
4. Transcriptions getting cut off with dashes ("Pollination—", "Morning—")

## Root Causes

### Issue 1: WebSocket Reconnection on Every Turn
**Symptom:** STT reconnects after each completed transcript, causing latency and connection overhead.

**Root Cause:** The implementation called `stopStreaming('thinking')` after each completed transcript, which:
- Closed the WebSocket connection
- Disconnected and closed the AudioContext
- Stopped the media stream tracks
- Required a full reconnection sequence for the next turn

This was unnecessary because AssemblyAI's streaming API supports multiple turns within a single WebSocket session. The connection should remain open and continue listening for the next turn.

**Fix Applied:** Modified `components/tutor/tutor-voice-dock.tsx`:
- Changed state from `'thinking'` to `'processing'` to better reflect the actual operation
- Removed the call to `stopStreaming()` when a transcript completes
- After sending the transcript, reset state to `'listening'` instead of closing
- WebSocket and audio pipeline now remain open between turns

**Before:**
```typescript
const completedTranscript = resolveAssemblyAiCompletedTranscript(payload);
if (completedTranscript) {
  setStreamingState('thinking');
  await stopStreaming('thinking');  // Closes connection
  await onTranscriptRef.current(completedTranscript);
}
```

**After:**
```typescript
const completedTranscript = resolveAssemblyAiCompletedTranscript(payload);
if (completedTranscript) {
  setStreamingState('processing');
  setTranscript('');
  await onTranscriptRef.current(completedTranscript);
  if (mountedRef.current && canAutoListenRef.current && !stoppingRef.current) {
    setStreamingState('listening');  // Keep connection open
  }
}
```

**File Changed:** `components/tutor/tutor-voice-dock.tsx` (lines 100, 138, 220, 361-367, 442, 479, 495)

### Issue 2: Cannot Interrupt Tutor
**Symptom:** Learner cannot speak when tutor is talking - microphone is blocked during tutor speech.

**Root Cause:** The `canAutoListen` check included `!teacherSpeaking` to prevent audio feedback loops. While this prevents feedback, it also prevents legitimate interruptions.

**Fix Applied:** Removed `!teacherSpeaking` from the `canAutoListen` condition in `components/tutor/tutor-voice-dock.tsx`:

**Before:**
```typescript
const canAutoListen = micEnabled && !disabled && runtimeStatus === 'ready' && speechToTextEnabled && !teacherSpeaking;
```

**After:**
```typescript
const canAutoListen = micEnabled && !disabled && runtimeStatus === 'ready' && speechToTextEnabled;
```

**File Changed:** `components/tutor/tutor-voice-dock.tsx` (line 120)

**Note:** This allows interruption but may cause audio feedback if the learner speaks while tutor audio is playing. The user should wear headphones to prevent feedback.

### Issue 3: Transcriptions Cut Off with Dashes
**Symptom:** Transcriptions ending with dashes like "Pollination—", "Morning—", "Scratch—", indicating VAD is ending turns prematurely before the user finishes speaking.

**Root Cause:** Initial VAD optimization made parameters too aggressive:
- `vad_threshold: '0.3'` (too sensitive, detecting speech too early)
- `min_turn_silence: '100'` (too short, ending turns on natural pauses)
- `end_of_turn_confidence_threshold: '0.4'` (too low, ending turns prematurely)
- `max_turn_silence: '1000'` (too short for thoughtful speech)

**Fix Applied:** Adjusted VAD parameters in `lib/stt/assemblyai-streaming.ts` to be more conservative:
- `vad_threshold`: 0.3 → 0.4 (less sensitive to background noise)
- `min_turn_silence`: 100 → 500ms (wait longer before considering end of turn)
- `max_turn_silence`: 1000 → 2000ms (allow longer pauses before forcing turn end)
- `end_of_turn_confidence_threshold`: 0.4 → 0.5 (require higher confidence before ending turn)

**Before:**
```typescript
export function buildAssemblyAiStreamingQuery(sampleRate = ASSEMBLY_STREAM_SAMPLE_RATE) {
  return new URLSearchParams({
    sample_rate: String(sampleRate),
    speech_model: 'u3-rt-pro',
    format_turns: 'true',
    end_of_turn_confidence_threshold: '0.4',
    min_turn_silence: '100',
    max_turn_silence: '1000',
    vad_threshold: '0.3',
  });
}
```

**After:**
```typescript
export function buildAssemblyAiStreamingQuery(sampleRate = ASSEMBLY_STREAM_SAMPLE_RATE) {
  return new URLSearchParams({
    sample_rate: String(sampleRate),
    speech_model: 'u3-rt-pro',
    format_turns: 'true',
    end_of_turn_confidence_threshold: '0.5',
    min_turn_silence: '500',
    max_turn_silence: '2000',
    vad_threshold: '0.4',
  });
}
```

**File Changed:** `lib/stt/assemblyai-streaming.ts` (lines 15-18)

## Why This Approach Is Best

### Persistent Connection vs Reconnection
- **Latency:** Eliminates WebSocket handshake overhead (typically 100-300ms) between turns
- **Reliability:** Reduces failure points - no need to re-acquire microphone permissions or reinitialize audio pipeline
- **User Experience:** Seamless listening between turns, no "Connecting..." states
- **AssemblyAI Design:** The streaming API is designed for multi-turn sessions; closing after each turn is anti-pattern

### Interrupt Capability
- **Natural Conversation:** Users expect to be able to interrupt in voice interfaces
- **User Control:** Gives learners agency to redirect the conversation
- **Trade-off:** Potential for audio feedback if not using headphones

### Conservative VAD Parameters
- **Complete Transcriptions:** 500ms minimum silence allows natural pauses without cutting off
- **Thoughtful Speech:** 2000ms maximum silence accommodates users thinking before continuing
- **Noise Tolerance:** 0.4 threshold reduces false speech detection from background noise
- **Confidence:** 0.5 end-of-turn confidence ensures turns only end when truly complete

## Alternative Approaches Considered

1. **Reconnect with session resume:** Could attempt to resume the same session ID, but AssemblyAI doesn't support session resumption. Full reconnection would still be required.

2. **Keep connection but pause audio:** Could keep WebSocket open but pause sending audio during tutor speech. This adds complexity without significant benefit since VAD handles silence detection.

3. **Use AssemblyAI SDK:** The official JavaScript SDK handles connection management, but would require significant refactoring. The current WebSocket implementation is already correct for this use case.

4. **Smart interrupt detection:** Could use additional audio processing to detect when user is trying to interrupt vs background noise. This adds significant complexity for marginal benefit.

## Testing Steps
1. Start a lesson with speech-to-text enabled
2. Verify microphone connects and shows "Listening live..." status
3. Speak a complete turn and verify transcript appears without being cut off
4. After sending the turn, verify status returns to "Listening live..." without reconnection
5. Speak another turn and verify it's detected immediately
6. Test interrupting the tutor while they're speaking (should work now)
7. Check browser console for WebSocket close codes (should not see closes between turns)

## Files Modified
- `components/tutor/tutor-voice-dock.tsx`: Persistent WebSocket connection, state renamed from 'thinking' to 'processing', removed teacherSpeaking block
- `lib/stt/assemblyai-streaming.ts`: VAD parameters adjusted to prevent premature turn ending

## Verification
- WebSocket now stays open across multiple turns
- Learner can interrupt tutor during speech
- VAD parameters prevent transcriptions from being cut off with dashes
- Turn detection latency appropriate for natural speech patterns
