# Teacher Conductor Edge Function

## Overview

The Teacher Conductor is the core orchestration agent for the AI Teaching Platform. It processes teaching turns by analyzing learner inputs, assessing progress, and generating contextually appropriate teaching responses with voice and visual actions.

## Responsibilities

- **Process Teaching Turns**: Handle learner inputs (voice, text, canvas, image annotations)
- **Invoke Progress Tracker**: Assess milestone progress and determine advancement
- **Generate Teacher Responses**: Create natural teaching responses optimized for voice synthesis
- **Manage Teaching State**: Update session status, milestone progress, and turn records
- **Determine Lesson Completion**: Signal when all required milestones are covered

## API Endpoint

```
POST /functions/v1/teacher-conductor
```

## Request Schema

```typescript
{
  sessionId: string          // UUID of the lesson session
  turnId: string             // UUID of the current turn
  learnerInput: {
    mode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
    raw: {
      text?: string                    // Text input or transcribed speech
      audioUrl?: string                // URL to audio recording
      canvasSnapshotUrl?: string       // URL to canvas snapshot
      imageAnnotationUrl?: string      // URL to annotated image
      selection?: string | number      // Selected option
    }
    interpreted?: {
      text?: string                    // Interpreted text
      intent?: string                  // Detected intent
      confidence?: number              // Confidence score (0-1)
      markings?: Array<{               // Interpreted visual markings
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

## Response Schema

```typescript
{
  success: boolean
  teacherResponse: {
    speech: string                     // Natural teaching response for TTS
    displayText?: string               // Optional text to display
    actions: Array<{                   // Teaching actions to execute
      type: 'speak' | 'display_text' | 'show_media' | 'highlight_concept' | 
            'enable_canvas' | 'enable_voice' | 'provide_feedback' | 'advance_milestone'
      params: Record<string, unknown>
      sequenceOrder: number
    }>
    awaitedInputMode: string           // Expected next input mode
    currentMilestoneId: string         // Current milestone ID
    isCorrectAnswer?: boolean          // Whether answer was correct
    feedback?: {
      type: 'positive' | 'corrective' | 'neutral'
      message: string
    }
    shouldCompleteLesson?: boolean     // True if lesson should complete
    nextMilestoneId?: string           // Next milestone if advancing
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

## Teaching Context

The Teacher Conductor uses comprehensive context to generate appropriate responses:

1. **Lesson Plan**: Topic, objective, milestones, concepts, misconceptions
2. **Current Milestone**: Title, description, success criteria, progress status
3. **Prior Turns**: Recent conversation history (last 5 turns)
4. **Learner Input**: Current response with mode and interpreted content
5. **Progress Assessment**: Milestone status, attempts, accuracy, evidence
6. **Interpreted Markings**: Canvas/image analysis from Vision Interpreter

## AI Model Configuration

- **Model**: GPT-4o-mini or Claude 3.5 Haiku
- **Temperature**: 0.7 (natural, conversational teaching responses)
- **Max Tokens**: 2000
- **Response Format**: Structured JSON

## Teaching Guidelines

The AI teacher follows these principles:

- **Natural Speech**: Responses optimized for ElevenLabs TTS
- **Specific Feedback**: Actionable guidance based on learner input
- **Positive Reinforcement**: Celebrate correct answers enthusiastically
- **Socratic Method**: Guide toward understanding without giving away answers
- **Continuity**: Reference prior turns to show progression
- **Adaptive Input**: Suggest appropriate input modes for next interaction
- **Milestone Advancement**: Only advance when success criteria are met
- **Lesson Completion**: Signal completion when all required milestones are covered

## Database Updates

The function updates multiple tables:

1. **lesson_turns**: Add interpreted input and teacher response
2. **lesson_milestone_progress**: Update status, attempts, evidence
3. **lesson_sessions**: Update current milestone, status, completion timestamp

## Error Handling

- **Missing Session**: Returns 500 error if session not found
- **Completed Session**: Returns 500 error if session already completed
- **Missing Milestone**: Returns 500 error if current milestone not in plan
- **Progress Tracker Failure**: Propagates error from Progress Tracker
- **AI API Failure**: Returns 500 error with details

## Integration Points

### Invokes
- **Progress Tracker**: Assesses milestone progress and determines advancement

### Invoked By
- **Frontend**: After learner submits a response

### Database Tables
- **lesson_sessions**: Read lesson plan, update status and milestone
- **lesson_turns**: Read prior turns, update current turn
- **lesson_milestone_progress**: Update progress records
- **canvas_snapshots**: Read interpreted markings

## Example Usage

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/teacher-conductor`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    sessionId: 'uuid-session-id',
    turnId: 'uuid-turn-id',
    learnerInput: {
      mode: 'voice',
      raw: {
        text: 'Chlorophyll absorbs light energy from the sun'
      },
      interpreted: {
        text: 'Chlorophyll absorbs light energy from the sun',
        intent: 'answer_question',
        confidence: 0.95
      }
    }
  })
})

const { teacherResponse, progressResult } = await response.json()

// Render teaching actions
teacherResponse.actions.forEach(action => {
  if (action.type === 'speak') {
    synthesizeSpeech(teacherResponse.speech)
  } else if (action.type === 'show_media') {
    displayMedia(action.params.mediaUrl)
  }
})

// Check for lesson completion
if (teacherResponse.shouldCompleteLesson) {
  navigateToSummary()
}
```

## Testing

Run tests with:

```bash
deno test supabase/functions/teacher-conductor/index.test.ts --allow-env --allow-net
```

## Requirements Satisfied

- **5.2**: Process teaching turn with full context
- **5.3**: Invoke Progress Tracker to assess milestone progress
- **5.4**: Generate teacher response JSON with teaching actions
- **5.5**: Update lesson_turns with interpreted input and teacher response
- **6.4**: Render teaching actions from teacher response
- **8.1**: Signal lesson completion when all milestones covered
- **12.4**: Generate voice text optimized for natural speech synthesis

## Related Functions

- **Progress Tracker**: Assesses milestone progress
- **Vision Interpreter**: Analyzes canvas/image markings
- **Session Summarizer**: Generates lesson summary on completion
