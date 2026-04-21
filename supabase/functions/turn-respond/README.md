# Turn Respond Edge Function

## Overview

The Turn Respond endpoint (`/api/lesson/turn/respond`) is the main API endpoint that the frontend calls when a learner submits a response during an interactive teaching session. It orchestrates the entire turn processing flow by coordinating with the Teacher Conductor agent and updating all relevant database records.

## Endpoint

**URL:** `/functions/v1/turn-respond`  
**Method:** `POST`  
**Authentication:** Required (Bearer token)

## Request Body

```typescript
{
  sessionId: string          // UUID of the lesson session
  learnerInput: {
    mode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
    raw: {
      text?: string                    // Text input or transcribed voice
      audioUrl?: string                // URL to audio file in storage
      canvasSnapshotUrl?: string       // URL to canvas snapshot in storage
      imageAnnotationUrl?: string      // URL to annotated image in storage
      selection?: string | number      // Selected option
    }
    interpreted?: {
      text?: string                    // Interpreted text from voice/canvas
      intent?: string                  // Detected intent
      confidence?: number              // Confidence score (0-1)
      markings?: Array<{               // Interpreted canvas markings
        type: string
        target?: string
        coordinates?: { x: number; y: number; width?: number; height?: number }
        confidence: number
        meaning?: string
      }>
    }
  }
}
```

## Response

```typescript
{
  success: boolean
  turnId: string                      // UUID of created turn record
  teacherResponse: {
    speech: string                    // Teacher's spoken response
    displayText?: string              // Optional text to display
    actions: Array<{                  // Teaching actions to execute
      type: string
      params: Record<string, unknown>
      sequenceOrder: number
    }>
    awaitedInputMode: string          // Expected next input mode
    currentMilestoneId: string        // Current milestone ID
    isCorrectAnswer?: boolean         // Whether answer was correct
    feedback?: {
      type: 'positive' | 'corrective' | 'neutral'
      message: string
    }
    shouldCompleteLesson?: boolean    // Whether lesson should complete
    nextMilestoneId?: string          // Next milestone if advancing
  }
  progressResult: {
    sessionId: string
    currentMilestoneId: string | null
    nextMilestoneId: string | null
    allMilestonesProgress: Array<{
      milestoneId: string
      status: 'not_started' | 'introduced' | 'practiced' | 'covered' | 'confirmed'
      attempts: number
      correctAttempts: number
      accuracy: number
      evidence: string[]
      shouldAdvance: boolean
      reasoning: string
    }>
    overallProgress: {
      totalMilestones: number
      completedMilestones: number
      currentMilestoneIndex: number
      percentComplete: number
    }
    shouldCompleteLesson: boolean
    timestamp: string
  }
  message: string
}
```

## Flow

1. **Authentication & Authorization**
   - Validates Bearer token
   - Verifies session belongs to authenticated user
   - Checks session is not already completed

2. **Turn Record Creation**
   - Calculates next turn index
   - Inserts `lesson_turns` record with raw input JSON
   - Returns turn ID for tracking

3. **Teacher Conductor Invocation**
   - Calls Teacher Conductor agent with:
     - Session ID
     - Turn ID
     - Learner input (raw + interpreted)
   - Teacher Conductor handles:
     - Fetching lesson plan and prior turns
     - Invoking Progress Tracker
     - Generating AI teaching response
     - Updating turn record with interpreted input and teacher response
     - Updating milestone progress records
     - Updating session current_milestone_id if advancing

4. **Response Return**
   - Returns teacher response and progress result to frontend
   - Frontend renders teaching actions and plays voice

## Error Handling

- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Session does not belong to user
- **404 Not Found**: Session not found
- **400 Bad Request**: 
  - Missing required fields (sessionId, learnerInput)
  - Session already completed
- **500 Internal Server Error**: 
  - Database errors
  - Teacher Conductor failures
  - Unexpected errors

## Input Modes

### Voice Input
```typescript
{
  mode: 'voice',
  raw: {
    text: 'Transcribed speech text',
    audioUrl: 'https://storage.supabase.co/...'
  },
  interpreted: {
    text: 'Transcribed speech text',
    intent: 'answer_question',
    confidence: 0.95
  }
}
```

### Text Input
```typescript
{
  mode: 'text',
  raw: {
    text: 'User typed text'
  }
}
```

### Canvas Drawing
```typescript
{
  mode: 'canvas_draw',
  raw: {
    canvasSnapshotUrl: 'https://storage.supabase.co/...'
  },
  interpreted: {
    markings: [
      {
        type: 'drawing',
        confidence: 0.85,
        meaning: 'Drew a plant with leaves'
      }
    ]
  }
}
```

### Image Annotation
```typescript
{
  mode: 'image_annotation',
  raw: {
    imageAnnotationUrl: 'https://storage.supabase.co/...'
  },
  interpreted: {
    markings: [
      {
        type: 'circle',
        target: 'chloroplast',
        coordinates: { x: 100, y: 150, width: 50, height: 50 },
        confidence: 0.9,
        meaning: 'Circled the chloroplast'
      }
    ]
  }
}
```

## Database Updates

The endpoint coordinates the following database updates (via Teacher Conductor):

1. **lesson_turns**
   - Initial insert with raw_input_json
   - Update with interpreted_input_json and teacher_response_json

2. **lesson_milestone_progress**
   - Updates status, evidence_json, updated_at for current milestone

3. **lesson_sessions**
   - Updates current_milestone_id if advancing
   - Updates status to 'completed' if lesson should complete
   - Updates completed_at timestamp if completing
   - Updates status to 'active' if first turn after 'ready'

## Requirements Satisfied

- **4.1**: Learner voice input processing
- **4.2**: Learner text input processing
- **5.1**: Insert lesson_turns record with raw input
- **5.2**: Teacher Conductor processes turn with full context
- **5.5**: Teacher response JSON with teaching actions
- **5.6**: Update lesson_turns with interpreted input and teacher response
- **5.7**: Update lesson_milestone_progress records
- **5.8**: Update session current_milestone_id
- **9.4**: Session data access restricted by user ownership
- **10.2**: Backend maintains authoritative state

## Testing

Run tests with:
```bash
deno test supabase/functions/turn-respond/index.test.ts --allow-env --allow-net
```

Tests cover:
- Voice, text, and canvas input modes
- Authentication and authorization
- Missing required fields
- Session not found
- Completed session handling
- Response structure validation
- Teacher response structure
- Progress result structure

## Integration

### Frontend Usage

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/turn-respond`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: currentSessionId,
    learnerInput: {
      mode: 'voice',
      raw: { text: transcribedText, audioUrl },
      interpreted: { text: transcribedText, intent: 'answer', confidence: 0.95 }
    }
  })
})

const { teacherResponse, progressResult } = await response.json()

// Render teaching actions
renderTeachingActions(teacherResponse.actions)

// Play teacher speech
await playTeacherSpeech(teacherResponse.speech)

// Update progress UI
updateProgressDisplay(progressResult)
```

## Related Functions

- **teacher-conductor**: Orchestrates teaching logic and AI response generation
- **progress-tracker**: Assesses milestone progress and completion
- **vision-interpreter**: Analyzes canvas snapshots (called before turn-respond)
- **session-create**: Creates initial session and lesson plan
- **session-complete**: Handles explicit lesson completion

## Notes

- The endpoint is designed to be idempotent for the same turn
- Teacher Conductor handles all complex teaching logic
- Progress Tracker is invoked by Teacher Conductor, not directly
- All state updates are transactional within Teacher Conductor
- Frontend should handle retries for network failures
- Voice input should be transcribed before calling this endpoint
- Canvas snapshots should be analyzed via vision-interpreter before calling
