# Canvas Analyze Edge Function

## Overview

The Canvas Analyze Edge Function handles canvas snapshot uploads from the frontend, stores them in Supabase Storage, invokes the Vision Interpreter agent to analyze the snapshot, and persists the results to the database.

**Validates Requirements:** 4.5, 4.6, 4.7, 4.8, 10.4

## Endpoint

```
POST /api/lesson/canvas/analyze
```

## Authentication

Requires a valid Supabase authentication token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Request Body

```typescript
{
  sessionId: string              // Required: ID of the lesson session
  turnId?: string                // Optional: ID of the current turn
  snapshotFile: {                // Required: Canvas snapshot image
    name: string                 // File name
    type: string                 // MIME type (e.g., 'image/png')
    base64Data: string           // Base64-encoded image data (with or without data URI prefix)
  }
  snapshotType?: string          // Optional: Type of snapshot (default: 'canvas_drawing')
  context?: {                    // Optional: Context for vision interpretation
    currentMilestone?: string    // Current learning milestone
    expectedConcepts?: string[]  // Expected concepts to identify
    taskDescription?: string     // Description of the task
  }
}
```

## Response

### Success Response (200)

```typescript
{
  success: true
  snapshotId: string             // ID of the created canvas_snapshots record
  storagePath: string            // Path to the snapshot in storage
  storageUrl: string             // Public URL to access the snapshot
  interpretedMarking: {          // Interpreted marking from Vision Interpreter
    shapes: Array<{
      type: string               // 'circle' | 'rectangle' | 'line' | 'arrow' | 'freehand' | 'text' | 'other'
      description: string
      position?: { x: number; y: number }
      confidence: number
    }>
    text: Array<{
      content: string
      position?: { x: number; y: number }
      confidence: number
    }>
    concepts: Array<{
      name: string
      description: string
      confidence: number
    }>
    annotations: Array<{
      type: string               // 'highlight' | 'underline' | 'circle' | 'arrow' | 'note'
      description: string
      confidence: number
    }>
    overallInterpretation: string
    confidence: number
  }
  message: string
}
```

### Error Responses

**401 Unauthorized**
```typescript
{
  error: "Missing authorization header" | "Unauthorized"
}
```

**400 Bad Request**
```typescript
{
  error: "Missing required fields: sessionId and snapshotFile"
}
```

**403 Forbidden**
```typescript
{
  error: "Unauthorized access to session"
}
```

**404 Not Found**
```typescript
{
  error: "Session not found"
}
```

**500 Internal Server Error**
```typescript
{
  error: string
  details: string
}
```

## Flow

1. **Authentication**: Verify the user is authenticated and owns the session
2. **Upload Snapshot**: Store the canvas snapshot in Supabase Storage at `canvas-snapshots/{user_id}/{sessionId}_{timestamp}.{ext}`
3. **Invoke Vision Interpreter**: Call the `vision-interpreter` Edge Function to analyze the snapshot
4. **Persist Results**: Insert a record in the `canvas_snapshots` table with the interpreted marking JSON
5. **Return Response**: Send the interpreted marking back to the frontend

## Storage

- **Bucket**: `canvas-snapshots`
- **Path Format**: `{user_id}/{sessionId}_{timestamp}.{extension}`
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`
- **Max File Size**: 5 MB
- **Access**: Private (user-owned)

## Database

### canvas_snapshots Table

```sql
CREATE TABLE canvas_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    turn_id UUID REFERENCES lesson_turns(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    snapshot_type TEXT,
    interpreter_result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Example Usage

### Frontend Request

```typescript
const response = await fetch('/api/lesson/canvas/analyze', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: 'abc-123',
    turnId: 'turn-456',
    snapshotFile: {
      name: 'canvas-snapshot.png',
      type: 'image/png',
      base64Data: 'data:image/png;base64,iVBORw0KGgo...'
    },
    snapshotType: 'canvas_drawing',
    context: {
      currentMilestone: 'Understanding fractions',
      expectedConcepts: ['numerator', 'denominator'],
      taskDescription: 'Draw a fraction representation'
    }
  })
})

const result = await response.json()
console.log('Interpreted marking:', result.interpretedMarking)
```

## Dependencies

- **Vision Interpreter**: Calls the `vision-interpreter` Edge Function for image analysis
- **Supabase Storage**: Stores canvas snapshots in the `canvas-snapshots` bucket
- **Supabase Database**: Persists snapshot metadata and interpretation results

## Error Handling

- Validates user authentication and session ownership
- Handles storage upload failures with descriptive error messages
- Retries vision interpretation if the first attempt fails (handled by vision-interpreter)
- Logs all errors for debugging

## Testing

Run tests with:

```bash
deno test supabase/functions/canvas-analyze/index.test.ts --allow-env --allow-net
```

## Related Functions

- `vision-interpreter`: Analyzes canvas snapshots and returns interpreted markings
- `session-create`: Creates lesson sessions that canvas snapshots belong to
- `lesson-planner`: Generates lesson plans that provide context for canvas analysis
