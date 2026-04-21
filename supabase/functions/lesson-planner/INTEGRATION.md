# Lesson Planner Integration Guide

This guide explains how to integrate the Lesson Planner Edge Function into your application.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Supabase project created
3. AI API key (OpenAI or Anthropic)

## Setup

### 1. Configure Environment Variables

Set your AI API key in Supabase:

```bash
# For OpenAI (recommended)
supabase secrets set OPENAI_API_KEY=sk-...

# OR for Anthropic
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Deploy the Function

```bash
supabase functions deploy lesson-planner
```

### 3. Verify Deployment

```bash
supabase functions list
```

You should see `lesson-planner` in the list.

## Frontend Integration

### Create a Session and Generate Lesson Plan

```typescript
// lib/api/lesson-planner.ts
import { createClient } from '@/lib/supabase/client'

export async function createLessonSession(topicPrompt: string) {
  const supabase = createClient()
  
  // 1. Create session record with status "planning"
  const { data: session, error: sessionError } = await supabase
    .from('lesson_sessions')
    .insert({
      topic_prompt: topicPrompt,
      status: 'planning'
    })
    .select()
    .single()
  
  if (sessionError) throw sessionError
  
  // 2. Call lesson planner Edge Function
  const { data: planResult, error: planError } = await supabase.functions.invoke(
    'lesson-planner',
    {
      body: {
        sessionId: session.id,
        topicPrompt: topicPrompt
      }
    }
  )
  
  if (planError) throw planError
  
  return {
    session,
    lessonPlan: planResult.lessonPlan
  }
}
```

### Usage in a Component

```typescript
// app/lesson/create/page.tsx
'use client'

import { useState } from 'react'
import { createLessonSession } from '@/lib/api/lesson-planner'

export default function CreateLessonPage() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { session, lessonPlan } = await createLessonSession(topic)
      
      // Navigate to lesson board or next step
      console.log('Session created:', session.id)
      console.log('Lesson plan:', lessonPlan)
      
      // TODO: Navigate to media planning or lesson board
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Start a New Lesson</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium mb-2">
            What would you like to learn?
          </label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Introduction to fractions"
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating lesson plan...' : 'Start Lesson'}
        </button>
        
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
      </form>
    </div>
  )
}
```

## Testing Locally

### 1. Start Supabase Locally

```bash
supabase start
```

### 2. Create .env File for Functions

Create `supabase/functions/.env`:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
OPENAI_API_KEY=your-openai-key
```

### 3. Serve the Function

```bash
supabase functions serve lesson-planner --env-file supabase/functions/.env
```

### 4. Test with curl

```bash
# Get your local anon key
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

# Create a test session first (you'll need a valid user_id)
curl -X POST http://localhost:54321/rest/v1/lesson_sessions \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_prompt": "Introduction to fractions",
    "status": "planning"
  }'

# Use the returned session ID to test the function
curl -X POST http://localhost:54321/functions/v1/lesson-planner \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id-here",
    "topicPrompt": "Introduction to fractions"
  }'
```

## Expected Response

```json
{
  "success": true,
  "lessonPlan": {
    "topic": "Introduction to Fractions",
    "normalizedTopic": "introduction-to-fractions",
    "objective": "Understand basic fraction concepts and operations",
    "milestones": [
      {
        "id": "m1",
        "title": "Understanding What Fractions Are",
        "description": "Learn the basic concept of fractions as parts of a whole",
        "required": true,
        "successCriteria": [
          "Can explain what a fraction represents",
          "Can identify the numerator and denominator"
        ],
        "estimatedDuration": 5
      }
    ],
    "concepts": [
      {
        "id": "c1",
        "name": "Numerator and Denominator",
        "description": "The top and bottom numbers in a fraction",
        "relatedMilestones": ["m1"],
        "misconceptions": [
          "The bigger the denominator, the bigger the fraction"
        ]
      }
    ],
    "estimatedDuration": 20,
    "difficulty": "beginner",
    "visualsNeeded": true,
    "interactiveMoments": [
      {
        "id": "im1",
        "type": "canvas_task",
        "milestoneId": "m1",
        "prompt": "Draw a circle and shade in one half",
        "expectedResponseType": "canvas_drawing"
      }
    ]
  },
  "message": "Lesson plan generated successfully"
}
```

## Error Handling

The function returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (missing sessionId or topicPrompt)
- `500`: Server error (AI API failure, database error)

Example error response:

```json
{
  "error": "No AI API key configured",
  "details": "Error: No AI API key configured"
}
```

## Next Steps

After the lesson plan is generated:

1. Call the Media Planner Edge Function (Task 6.2)
2. Process media assets (Tasks 6.3, 6.4)
3. Update session status to "ready"
4. Display lesson board to learner

## Monitoring

Check function logs:

```bash
# Local
supabase functions logs lesson-planner

# Production
supabase functions logs lesson-planner --project-ref your-project-ref
```

## Troubleshooting

### Function times out
- Check AI API key is valid
- Verify network connectivity to AI service
- Check Supabase logs for detailed error messages

### Validation fails
- Ensure AI model is returning valid JSON
- Check that all required fields are present
- Verify milestone array is not empty

### Database update fails
- Verify session exists with correct ID
- Check RLS policies allow updates
- Ensure user is authenticated
