# Session Complete Edge Function

## Overview

The Session Complete Edge Function handles lesson completion by:
1. Invoking the Session Summarizer agent to generate a comprehensive lesson summary
2. Invoking the Article Generator agent to create a structured markdown article
3. Updating the session status to "completed"
4. Storing both summary and article data

This endpoint can be triggered naturally when all milestones are covered, explicitly via button click, or through voice termination phrase detection.

## Endpoint

**POST** `/api/lesson/session/complete`

## Authentication

Requires valid Supabase authentication token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Request Body

```typescript
{
  sessionId: string  // UUID of the lesson session to complete
}
```

## Response

### Success Response (200)

```typescript
{
  success: true,
  session: {
    id: string
    user_id: string
    topic_prompt: string
    status: "completed"
    lesson_plan_json: object
    media_manifest_json: object
    current_milestone_id: string | null
    summary_json: LessonSummary
    article_path: string  // Storage path to article.md
    article_generated_at: string  // ISO timestamp
    completed_at: string  // ISO timestamp
    created_at: string
    updated_at: string
  },
  summary: LessonSummary,
  article: {
    id: string
    title: string  // e.g., "Photosynthesis - How Plants Make Food - January 15, 2024"
    storagePath: string  // e.g., "user-id/session-id/article.md"
    metadata: {
      topic: string
      duration: number
      milestonesTotal: number
      milestonesCompleted: number
      difficulty: string
      mediaCount: number
    }
  },
  message: "Lesson completed successfully"
}
```

### Partial Success (Article Generation Failed)

If article generation fails, the session is still marked as completed:

```typescript
{
  success: true,
  session: { /* session data */ },
  summary: LessonSummary,
  article: null,
  message: "Lesson completed successfully (article generation failed)",
  warning: "Article generation failed but lesson was completed"
}
```

### Error Responses

**401 Unauthorized**
```typescript
{
  error: "Missing authorization header" | "Unauthorized"
}
```

**403 Forbidden**
```typescript
{
  error: "Unauthorized: Session does not belong to user"
}
```

**404 Not Found**
```typescript
{
  error: "Session not found"
}
```

**400 Bad Request**
```typescript
{
  error: "Missing required field: sessionId" | "Session is already completed"
}
```

**500 Internal Server Error**
```typescript
{
  error: string,
  details: string
}
```

## Lesson Summary Structure

```typescript
interface LessonSummary {
  sessionId: string
  topic: string
  objective: string
  duration: {
    startTime: string  // ISO timestamp
    endTime: string    // ISO timestamp
    totalMinutes: number
  }
  milestonesOverview: {
    total: number
    completed: number
    percentComplete: number
    milestones: Array<{
      id: string
      title: string
      status: string
      attempts: number
      accuracy: number
      keyInsights: string[]
    }>
  }
  learnerPerformance: {
    overallEngagement: 'high' | 'medium' | 'low'
    strengthAreas: string[]
    improvementAreas: string[]
    misconceptionsAddressed: string[]
    notableAchievements: string[]
  }
  interactionSummary: {
    totalTurns: number
    inputModesUsed: string[]
    canvasInteractions: number
    voiceInteractions: number
    textInteractions: number
  }
  keyTakeaways: string[]
  recommendedNextSteps: string[]
  generatedAt: string  // ISO timestamp
}
```

## Flow

1. **Authentication**: Verify user authentication via Authorization header
2. **Validation**: Check that sessionId is provided and session exists
3. **Ownership Check**: Verify that the session belongs to the authenticated user
4. **Status Check**: Ensure session is not already completed
5. **Summarization**: Invoke Session Summarizer agent to generate lesson summary
6. **Update Session**: Update session status to "completed", store summary JSON, and set completed_at timestamp
7. **Article Generation**: Invoke Article Generator agent to create markdown article with embedded media
8. **Article Storage**: Store article in Supabase Storage and persist metadata to database
9. **Response**: Return updated session, summary, and article data to client

## Error Handling

The function implements graceful degradation:

- **Summary Generation Failure**: Throws error, session not completed
- **Article Generation Failure**: Logs error, returns success with `article: null`

This ensures that a lesson can always be completed even if article generation fails (e.g., AI service unavailable).

## Integration

This endpoint is called by:
- **Teacher Conductor**: When all milestones are naturally completed
- **Frontend UI**: When user clicks "End Lesson" button
- **Voice Handler**: When user speaks a lesson termination phrase

## Dependencies

- **Session Summarizer Agent** (`session-summarizer`): Generates comprehensive lesson summary
- **Article Generator Agent** (`article-generator`): Creates structured markdown article with embedded media
- **Supabase Auth**: User authentication and authorization
- **PostgreSQL**: Session data persistence
- **Supabase Storage**: Article file storage

## Error Handling

- Validates authentication before processing
- Checks session ownership to prevent unauthorized access
- Prevents duplicate completion of already-completed sessions
- Handles Session Summarizer failures gracefully (throws error)
- Handles Article Generator failures gracefully (continues with article: null)
- Logs all errors with context for debugging

## Testing

Run unit tests:

```bash
deno test supabase/functions/session-complete/index.test.ts --allow-env --allow-net
```

## Requirements Satisfied

- **8.1**: Lesson completion when all milestones covered
- **8.2**: Explicit completion via button click
- **8.3**: Voice termination phrase support
- **8.4**: Session Summarizer invocation
- **8.5**: Session status update to "completed"
- **8.6**: Summary storage and display
- **9.4**: Session ownership validation
- **10.2**: Backend state persistence
- **13.1**: Article Generator synthesizes lesson into structured markdown
- **13.5**: Article stored in Supabase Storage at specified path
- **13.6**: Article metadata persisted to lesson_articles table
- **13.7**: Session record updated with article_path and article_generated_at
