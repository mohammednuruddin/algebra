# Teacher Conductor Integration Guide

## Overview

This guide explains how to integrate the Teacher Conductor Edge Function into the AI Teaching Platform frontend and backend workflows.

## Frontend Integration

### 1. Submit Learner Response

When a learner provides input (voice, text, canvas, or image), the frontend should:

1. Create a turn record in the database
2. If canvas/image input, upload snapshot and invoke Vision Interpreter
3. Call Teacher Conductor with learner input
4. Render teacher response actions
5. Play synthesized speech

```typescript
// lib/api/teacher-conductor.ts
import { createClient } from '@/lib/supabase/client'

export interface LearnerInput {
  mode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
  raw: {
    text?: string
    audioUrl?: string
    canvasSnapshotUrl?: string
    imageAnnotationUrl?: string
    selection?: string | number
  }
  interpreted?: {
    text?: string
    intent?: string
    confidence?: number
    markings?: Array<{
      type: string
      target?: string
      coordinates?: { x: number; y: number; width?: number; height?: number }
      confidence: number
      meaning?: string
    }>
  }
}

export interface TeacherResponse {
  speech: string
  displayText?: string
  actions: Array<{
    type: string
    params: Record<string, unknown>
    sequenceOrder: number
  }>
  awaitedInputMode: string
  currentMilestoneId: string
  isCorrectAnswer?: boolean
  feedback?: {
    type: 'positive' | 'corrective' | 'neutral'
    message: string
  }
  shouldCompleteLesson?: boolean
  nextMilestoneId?: string
}

export async function submitLearnerResponse(
  sessionId: string,
  learnerInput: LearnerInput
): Promise<{ teacherResponse: TeacherResponse; progressResult: any }> {
  const supabase = createClient()
  
  // 1. Get next turn index
  const { data: turns, error: turnsError } = await supabase
    .from('lesson_turns')
    .select('turn_index')
    .eq('session_id', sessionId)
    .order('turn_index', { ascending: false })
    .limit(1)
  
  if (turnsError) throw turnsError
  
  const nextTurnIndex = turns && turns.length > 0 ? turns[0].turn_index + 1 : 1
  
  // 2. Create turn record
  const { data: turn, error: turnError } = await supabase
    .from('lesson_turns')
    .insert({
      session_id: sessionId,
      turn_index: nextTurnIndex,
      actor: 'learner',
      input_mode: learnerInput.mode,
      raw_input_json: learnerInput
    })
    .select()
    .single()
  
  if (turnError) throw turnError
  
  // 3. If canvas/image input, handle snapshot
  if (learnerInput.mode === 'canvas_draw' || 
      learnerInput.mode === 'canvas_mark' || 
      learnerInput.mode === 'image_annotation') {
    
    if (learnerInput.raw.canvasSnapshotUrl || learnerInput.raw.imageAnnotationUrl) {
      const imageUrl = learnerInput.raw.canvasSnapshotUrl || learnerInput.raw.imageAnnotationUrl
      
      // Call Vision Interpreter
      const visionResponse = await fetch('/api/lesson/canvas/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          turnId: turn.id,
          imageUrl
        })
      })
      
      if (!visionResponse.ok) {
        console.error('Vision interpretation failed')
      } else {
        const visionResult = await visionResponse.json()
        // Update learner input with interpretation
        learnerInput.interpreted = {
          ...learnerInput.interpreted,
          markings: visionResult.result.interpretedMarking.shapes
        }
      }
    }
  }
  
  // 4. Call Teacher Conductor
  const { data: functionData, error: functionError } = await supabase.functions.invoke(
    'teacher-conductor',
    {
      body: {
        sessionId,
        turnId: turn.id,
        learnerInput
      }
    }
  )
  
  if (functionError) throw functionError
  
  return {
    teacherResponse: functionData.teacherResponse,
    progressResult: functionData.progressResult
  }
}
```

### 2. Render Teacher Response

```typescript
// components/lesson/TeacherResponseRenderer.tsx
import { useEffect, useState } from 'react'
import { TeacherResponse } from '@/lib/api/teacher-conductor'

interface Props {
  response: TeacherResponse
  onComplete: () => void
}

export function TeacherResponseRenderer({ response, onComplete }: Props) {
  const [currentActionIndex, setCurrentActionIndex] = useState(0)
  
  useEffect(() => {
    // Sort actions by sequence order
    const sortedActions = [...response.actions].sort(
      (a, b) => a.sequenceOrder - b.sequenceOrder
    )
    
    // Execute actions sequentially
    async function executeActions() {
      for (let i = 0; i < sortedActions.length; i++) {
        setCurrentActionIndex(i)
        const action = sortedActions[i]
        
        switch (action.type) {
          case 'speak':
            await synthesizeSpeech(response.speech)
            break
          case 'display_text':
            displayText(action.params.text as string)
            break
          case 'show_media':
            displayMedia(action.params.mediaUrl as string)
            break
          case 'highlight_concept':
            highlightConcept(action.params.conceptId as string)
            break
          case 'provide_feedback':
            showFeedback(response.feedback!)
            break
          case 'advance_milestone':
            showMilestoneAdvancement(action.params.milestoneId as string)
            break
        }
        
        // Wait for action to complete
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      onComplete()
    }
    
    executeActions()
  }, [response])
  
  return (
    <div className="teacher-response">
      {response.displayText && (
        <div className="display-text">{response.displayText}</div>
      )}
      {response.feedback && (
        <div className={`feedback feedback-${response.feedback.type}`}>
          {response.feedback.message}
        </div>
      )}
    </div>
  )
}

async function synthesizeSpeech(text: string): Promise<void> {
  // Use ElevenLabs TTS to synthesize and play speech
  // Implementation depends on ElevenLabs SDK integration
}

function displayText(text: string): void {
  // Display text in UI
}

function displayMedia(mediaUrl: string): void {
  // Show image or diagram
}

function highlightConcept(conceptId: string): void {
  // Highlight concept in lesson board
}

function showFeedback(feedback: { type: string; message: string }): void {
  // Show feedback notification
}

function showMilestoneAdvancement(milestoneId: string): void {
  // Show milestone completion animation
}
```

### 3. Handle Lesson Completion

```typescript
// components/lesson/LessonBoard.tsx
import { useRouter } from 'next/navigation'
import { submitLearnerResponse } from '@/lib/api/teacher-conductor'

export function LessonBoard({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  
  async function handleLearnerInput(input: LearnerInput) {
    try {
      const { teacherResponse, progressResult } = await submitLearnerResponse(
        sessionId,
        input
      )
      
      // Render teacher response
      renderTeacherResponse(teacherResponse)
      
      // Check for lesson completion
      if (teacherResponse.shouldCompleteLesson || progressResult.shouldCompleteLesson) {
        // Navigate to summary page
        router.push(`/lessons/summary/${sessionId}`)
      }
    } catch (error) {
      console.error('Failed to process learner input:', error)
      showError('Something went wrong. Please try again.')
    }
  }
  
  return (
    <div className="lesson-board">
      {/* Lesson UI */}
    </div>
  )
}
```

## Backend Integration

### 1. API Route for Teacher Conductor

```typescript
// app/api/lesson/turn/respond/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { sessionId, learnerInput } = body
    
    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Create turn record
    const { data: turns } = await supabase
      .from('lesson_turns')
      .select('turn_index')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: false })
      .limit(1)
    
    const nextTurnIndex = turns && turns.length > 0 ? turns[0].turn_index + 1 : 1
    
    const { data: turn, error: turnError } = await supabase
      .from('lesson_turns')
      .insert({
        session_id: sessionId,
        turn_index: nextTurnIndex,
        actor: 'learner',
        input_mode: learnerInput.mode,
        raw_input_json: learnerInput
      })
      .select()
      .single()
    
    if (turnError) throw turnError
    
    // Call Teacher Conductor
    const { data, error } = await supabase.functions.invoke('teacher-conductor', {
      body: {
        sessionId,
        turnId: turn.id,
        learnerInput
      }
    })
    
    if (error) throw error
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error in turn/respond:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Testing Integration

### Unit Tests

```bash
# Test Teacher Conductor function
deno test supabase/functions/teacher-conductor/index.test.ts --allow-env --allow-net
```

### Integration Tests

```typescript
// __tests__/integration/teacher-conductor.test.ts
import { createClient } from '@supabase/supabase-js'

describe('Teacher Conductor Integration', () => {
  it('should process voice input and generate response', async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
    
    // Create test session
    const { data: session } = await supabase
      .from('lesson_sessions')
      .insert({
        user_id: 'test-user-id',
        topic_prompt: 'Test topic',
        status: 'active',
        lesson_plan_json: { /* test lesson plan */ }
      })
      .select()
      .single()
    
    // Create turn
    const { data: turn } = await supabase
      .from('lesson_turns')
      .insert({
        session_id: session.id,
        turn_index: 1,
        actor: 'learner',
        input_mode: 'voice',
        raw_input_json: {
          mode: 'voice',
          raw: { text: 'Test answer' }
        }
      })
      .select()
      .single()
    
    // Call Teacher Conductor
    const { data, error } = await supabase.functions.invoke('teacher-conductor', {
      body: {
        sessionId: session.id,
        turnId: turn.id,
        learnerInput: {
          mode: 'voice',
          raw: { text: 'Test answer' }
        }
      }
    })
    
    expect(error).toBeNull()
    expect(data.success).toBe(true)
    expect(data.teacherResponse).toBeDefined()
    expect(data.teacherResponse.speech).toBeDefined()
    expect(data.progressResult).toBeDefined()
  })
})
```

## Deployment

1. Deploy the function to Supabase:

```bash
supabase functions deploy teacher-conductor
```

2. Set environment variables:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-key
# OR
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
```

3. Verify deployment:

```bash
supabase functions list
```

## Monitoring

Monitor function performance and errors:

```bash
# View logs
supabase functions logs teacher-conductor

# View metrics
supabase functions metrics teacher-conductor
```

## Troubleshooting

### Common Issues

1. **Progress Tracker fails**: Ensure Progress Tracker function is deployed and accessible
2. **AI API errors**: Verify API keys are set correctly
3. **Session not found**: Check session ID and user authentication
4. **Milestone not found**: Verify lesson plan structure and current milestone ID

### Debug Mode

Enable detailed logging by setting:

```bash
supabase secrets set LOG_LEVEL=debug
```

## Related Documentation

- [Teacher Conductor README](./README.md)
- [Progress Tracker Integration](../progress-tracker/INTEGRATION.md)
- [Vision Interpreter Integration](../vision-interpreter/README.md)
