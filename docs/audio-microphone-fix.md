# Audio and Microphone Fix

## Date
2026-04-21

## Issues Reported
1. When lesson starts, can't hear TTS (text-to-speech)
2. Before lesson starts, can't talk to AI - sees "Microphone connection closed. Tap the mic to retry."

## Root Causes

### Issue 1: App Crash on Lesson Start
**Symptom:** TypeError in browser console
```
TypeError: Cannot read properties of undefined (reading 'find')
at TutorShell (line 41)
```

**Root Cause:** `snapshot.mediaAssets` was undefined when the lesson started, causing the entire tutor shell to crash. This prevented both microphone and TTS from working.

**Fix Applied:** Added fallback to empty array in `components/tutor/tutor-shell.tsx`:
```typescript
// Before
const activeImage = snapshot.mediaAssets.find((asset) => asset.id === snapshot.activeImageId) || null;

// After
const activeImage = (snapshot.mediaAssets || []).find((asset) => asset.id === snapshot.activeImageId) || null;
```

**File Changed:** `components/tutor/tutor-shell.tsx` (line 41)

### Issue 2: TTS Not Playing
**Root Cause:** An earlier runtime override forced ElevenLabs whenever both API keys were present. That ignored `TTS_PROVIDER=inworld` and made the server pick the wrong provider for this app's current setup.

**Fix Applied:** Modified `lib/tts/config.ts` so provider resolution now:
1. Honors `TTS_PROVIDER` when the requested provider is configured
2. Defaults to `inworld` when both providers are available
3. Falls back to `elevenlabs` only when Inworld is unavailable

```typescript
// Resolution order
if (requested === 'inworld' && hasInworld) return 'inworld';
if (requested === 'elevenlabs' && hasElevenLabs) return 'elevenlabs';
if (hasInworld) return 'inworld';
if (hasElevenLabs) return 'elevenlabs';
return 'elevenlabs';
```

**Before:** The runtime forced ElevenLabs whenever both keys existed:
```typescript
if (hasElevenLabs && hasInworld) {
  return 'elevenlabs';
}
```

**File Changed:** `lib/tts/config.ts`

### Issue 3: Microphone Connection Closed (Code 3007)
**Symptom:** "Microphone connection closed (3007). Tap the mic to retry." error message after microphone works for some time.

**Root Cause:** AssemblyAI token was expiring after 300 seconds (5 minutes), causing WebSocket close code 3007 (invalid/expired token). The max session duration was set to 1800 seconds (30 minutes), but the token expiration was only 300 seconds.

**Fix Applied:** Increased AssemblyAI token expiration from 300s to 600s (10 minutes) in `app/api/assemblyai/token/route.ts`. Note: 1800s caused a 422 error (exceeds AssemblyAI limits), so 600s is used as a safe middle ground:
```typescript
// Before
'https://streaming.assemblyai.com/v3/token?expires_in_seconds=300&max_session_duration_seconds=1800'

// After
'https://streaming.assemblyai.com/v3/token?expires_in_seconds=600&max_session_duration_seconds=1800'
```

**File Changed:** `app/api/assemblyai/token/route.ts` (line 16)

**Additional Fix:** Added detailed error logging in `components/tutor/tutor-voice-dock.tsx`:
```typescript
// WebSocket onclose handler now logs detailed close information
websocket.onclose = (event) => {
  console.error('WebSocket closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
  setError((current) => current || `Microphone connection closed (${event.code}). Tap the mic to retry.`);
  // ...
};

// WebSocket onerror handler now logs the error event
websocket.onerror = (event) => {
  console.error('WebSocket error:', event);
  setError('Listening connection failed');
  // ...
};
```

**File Changed:** `components/tutor/tutor-voice-dock.tsx` (lines 370-389)

## Additional Recommendations

### Browser Autoplay Policies
Browsers block audio autoplay until user interaction. Ensure:
1. User has interacted with the page before TTS plays
2. AudioContext is properly initialized (code handles this in `tutor-voice-player.tsx`)

### Microphone Permissions
Ensure:
1. Browser has microphone permissions granted
2. No other application is using the microphone
3. HTTPS is used (required for microphone access in production)

## Testing Steps
1. Restart the dev server (changes to TTS config require restart)
2. Start a new lesson
3. Verify TTS plays when lesson starts and the response header `X-TTS-Provider` resolves to `inworld` when both keys are present
4. Check browser console for WebSocket close codes if microphone still fails
5. Verify microphone connects and shows "Listening live..." status
6. Test speaking to the AI

## Files Modified
- `components/tutor/tutor-shell.tsx`: Added null check for mediaAssets (line 41)
- `lib/tts/config.ts`: Honor `TTS_PROVIDER` and default to Inworld when both keys are available
- `components/tutor/tutor-voice-dock.tsx`: Added detailed error logging for WebSocket (lines 370-389)

## Verification
- AssemblyAI token endpoint verified working: `/api/assemblyai/token` returns valid token
- Runtime config verified: Both `voiceEnabled` and `speechToTextEnabled` are true
