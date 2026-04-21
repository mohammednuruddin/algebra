# Turn Respond Integration Guide

## Overview

This document describes how the Turn Respond endpoint integrates with other components of the AI Teaching Platform.

## Architecture Position

```
Frontend (React/Next.js)
    ↓
Turn Respond Endpoint ← YOU ARE HERE
    ↓
Teacher Conductor Agent
    ↓
Progress Tracker Agent
```

## Integration Points

### 1. Frontend Integration

**When to Call:**
- After learner submits voice input (transcribed)
- After learner submits text input
- After learner completes canvas drawing (snapshot analyzed)
- After learner annotates an image (snapshot analyzed)
- After learner makes a selection

**Prerequisites:**
- User must be authenticated (valid Bearer token)
- Session must exist and be in 'ready' or 'active' status
- For canvas/image inputs: snapshot must be uploaded to storage and analyzed by vision-interpreter

**Example Flow:**

```typescript
// 1. Capture learner input
const audioBlob = await captureVoiceInput()
const transcription = await transcribeWithElevenLabs(audioBlob)

// 2. Upload audio to storage (optional)
const audioUrl = await uploadToStorage(audioBlob, 'audio')

// 3. Call turn-respond
const response = await fetch('/functions/v1/turn-respond', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId,
    learnerInput: {
      mode: 'voice',
      raw: { text: transcription, audioUrl },
      interpreted: { text: transcription, confidence: 0.95 }
    }
  })
})

// 4. Handle response
const { teacherResponse, progressResult } = await response.json()
await renderTeachingResponse(teacherResponse)
updateProgressUI(progressResult)
```

### 2. Teacher Conductor Integration

**What Turn Respond Sends:**
```typescript
{
  sessionId: string
  turnId: string
  learnerInput: {
    mode: string
    raw: object
    interpreted?: object
  }
}
```

**What Teacher Conductor Returns:**
```typescript
{
  success: boolean
  teacherResponse: {
    speech: string
    actions: TeachingAction[]
    awaitedInputMode: string
    currentMilestoneId: string
    isCorrectAnswer?: boolean
    feedback?: object
    shouldCompleteLesson?: boolean
    nextMilestoneId?: string
  }
  progressResult: {
    sessionId: string
    allMilestonesProgress: MilestoneProgress[]
    overallProgress: object
    shouldCompleteLesson: boolean
  }
}
```

**Teacher Conductor Responsibilities:**
- Fetch lesson plan and prior turns
- Invoke Progress Tracker
- Generate AI teaching response
- Update lesson_turns record
- Update lesson_milestone_progress records
- Update lesson_sessions current_milestone_id

### 3. Vision Interpreter Integration

**For Canvas/Image Inputs:**

Before calling turn-respond, the frontend must:

1. Capture canvas snapshot or annotated image
2. Upload to storage
3. Call vision-interpreter endpoint
4. Receive interpreted markings
5. Include interpreted markings in learnerInput.interpreted

```typescript
// Step 1-2: Capture and upload
const snapshotBlob = canvasRef.current.toBlob()
const snapshotUrl = await uploadToStorage(snapshotBlob, 'canvas-snapshots')

// Step 3-4: Analyze
const analysisResponse = await fetch('/functions/v1/canvas-analyze', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    sessionId,
    snapshotUrl,
    snapshotType: 'canvas_draw'
  })
})
const { interpretedMarkings } = await analysisResponse.json()

// Step 5: Include in turn-respond call
await fetch('/functions/v1/turn-respond', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    learnerInput: {
      mode: 'canvas_draw',
      raw: { canvasSnapshotUrl: snapshotUrl },
      interpreted: { markings: interpretedMarkings }
    }
  })
})
```

### 4. Database Integration

**Tables Updated (via Teacher Conductor):**

1. **lesson_turns**
   - Initial insert by turn-respond
   - Update by teacher-conductor with interpreted_input_json and teacher_response_json

2. **lesson_milestone_progress**
   - Updated by teacher-conductor based on progress-tracker results

3. **lesson_sessions**
   - Updated by teacher-conductor:
     - current_milestone_id (if advancing)
     - status (if completing or activating)
     - completed_at (if completing)

**Row Level Security:**
- All queries respect RLS policies
- User can only access their own sessions
- Service role key used for backend operations

## Error Handling

### Frontend Error Handling

```typescript
try {
  const response = await fetch('/functions/v1/turn-respond', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId, learnerInput })
  })

  if (!response.ok) {
    const error = await response.json()
    
    switch (response.status) {
      case 401:
        // Redirect to login
        router.push('/login')
        break
      case 403:
        // Show "Access denied" message
        showError('You do not have access to this session')
        break
      case 404:
        // Show "Session not found" message
        showError('Session not found')
        break
      case 400:
        // Show validation error
        showError(error.error)
        break
      case 500:
        // Show retry option
        showError('Something went wrong. Please try again.')
        setRetryAvailable(true)
        break
    }
    return
  }

  const { teacherResponse, progressResult } = await response.json()
  // Handle success...
  
} catch (error) {
  // Network error
  showError('Network error. Please check your connection.')
  setRetryAvailable(true)
}
```

### Retry Strategy

```typescript
async function callTurnRespondWithRetry(
  sessionId: string,
  learnerInput: LearnerInput,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/functions/v1/turn-respond', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId, learnerInput })
      })

      if (response.ok) {
        return await response.json()
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(await response.text())
      }

      // Retry on server errors (5xx)
      if (attempt < maxRetries) {
        await sleep(1000 * attempt) // Exponential backoff
        continue
      }

      throw new Error('Max retries reached')
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      await sleep(1000 * attempt)
    }
  }
}
```

## State Management

### Frontend State Updates

After successful turn-respond call:

```typescript
// 1. Update turn history
setTurns(prev => [...prev, {
  id: turnId,
  actor: 'learner',
  input: learnerInput,
  timestamp: new Date()
}])

// 2. Update current milestone
if (teacherResponse.nextMilestoneId) {
  setCurrentMilestoneId(teacherResponse.nextMilestoneId)
}

// 3. Update progress
setMilestoneProgress(progressResult.allMilestonesProgress)
setOverallProgress(progressResult.overallProgress)

// 4. Check for lesson completion
if (teacherResponse.shouldCompleteLesson || progressResult.shouldCompleteLesson) {
  setSessionStatus('completed')
  showLessonSummary()
}

// 5. Update expected input mode
setExpectedInputMode(teacherResponse.awaitedInputMode)
```

## Testing Integration

### Unit Tests

Test the endpoint in isolation with mocked dependencies:

```bash
deno test supabase/functions/turn-respond/index.test.ts --allow-env --allow-net
```

### Integration Tests

Test with real Supabase instance:

```bash
# Start local Supabase
supabase start

# Run integration tests
deno test supabase/functions/turn-respond/index.test.ts \
  --allow-env \
  --allow-net \
  --env-file=.env.local
```

### End-to-End Tests

Test complete flow from frontend:

```typescript
// Cypress or Playwright test
it('should process learner voice input', async () => {
  // 1. Start session
  await startLesson('Photosynthesis')
  
  // 2. Submit voice input
  await submitVoiceInput('Plants make food using sunlight')
  
  // 3. Verify teacher response
  await expect(page.locator('.teacher-speech')).toContainText('Great answer')
  
  // 4. Verify progress update
  await expect(page.locator('.milestone-progress')).toContainText('50%')
})
```

## Performance Considerations

### Latency Optimization

1. **Parallel Processing:**
   - Upload audio/canvas snapshots in parallel with transcription
   - Pre-analyze canvas snapshots before user submits

2. **Caching:**
   - Cache lesson plan in frontend state
   - Cache media assets for faster rendering

3. **Streaming:**
   - Consider streaming teacher speech as it's generated
   - Use ElevenLabs streaming TTS for lower latency

### Load Management

1. **Rate Limiting:**
   - Implement rate limiting on frontend (max 1 turn per 2 seconds)
   - Debounce rapid submissions

2. **Timeout Handling:**
   - Set reasonable timeout (30 seconds)
   - Show loading indicator during processing
   - Allow user to cancel long-running requests

## Security Considerations

1. **Authentication:**
   - Always include valid Bearer token
   - Refresh token if expired
   - Redirect to login on 401

2. **Authorization:**
   - Backend verifies session ownership
   - RLS policies enforce data access

3. **Input Validation:**
   - Validate input mode matches raw data
   - Sanitize text inputs
   - Validate file URLs are from trusted storage

4. **Data Privacy:**
   - Audio files stored securely in Supabase Storage
   - Canvas snapshots accessible only to session owner
   - No PII in logs or error messages

## Monitoring and Debugging

### Logging

```typescript
// Frontend logging
console.log('[TurnRespond] Submitting turn', {
  sessionId,
  mode: learnerInput.mode,
  timestamp: new Date().toISOString()
})

// Backend logging (in turn-respond function)
console.log(`Processing turn response for session ${sessionId}`)
console.log(`Turn record created: ${turnRecord.id}`)
console.log('Invoking Teacher Conductor...')
console.log('Teacher Conductor completed successfully')
```

### Error Tracking

```typescript
// Sentry or similar
Sentry.captureException(error, {
  tags: {
    component: 'turn-respond',
    sessionId,
    inputMode: learnerInput.mode
  },
  extra: {
    learnerInput,
    response: errorResponse
  }
})
```

### Metrics

Track:
- Turn processing time (p50, p95, p99)
- Success rate
- Error rate by type (401, 403, 404, 500)
- Teacher Conductor invocation time
- Progress Tracker invocation time

## Related Documentation

- [Teacher Conductor Integration](../teacher-conductor/INTEGRATION.md)
- [Progress Tracker Integration](../progress-tracker/INTEGRATION.md)
- [Vision Interpreter Integration](../vision-interpreter/README.md)
- [Session Create Integration](../session-create/README.md)
