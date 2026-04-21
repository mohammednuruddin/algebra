# Lesson Planner Edge Function

This Supabase Edge Function generates structured lesson plans using AI (GPT-4o-mini or Claude 3.5 Haiku).

## Purpose

The Lesson Planner agent is responsible for:
- Generating structured lesson plans with milestones and concepts
- Identifying interactive moments for learner engagement
- Estimating lesson duration and difficulty
- Determining if visual aids are needed
- Initializing milestone progress tracking

## API Endpoint

**POST** `/api/agents/lesson-planner`

### Request Body

```json
{
  "sessionId": "uuid",
  "topicPrompt": "string"
}
```

### Response

```json
{
  "success": true,
  "lessonPlan": {
    "topic": "Understanding Photosynthesis",
    "normalizedTopic": "understanding-photosynthesis",
    "objective": "Learn how plants convert sunlight into energy",
    "milestones": [
      {
        "id": "m1",
        "title": "Introduction to Photosynthesis",
        "description": "Understand the basic concept and importance",
        "required": true,
        "successCriteria": ["Can explain what photosynthesis is", "Can identify why it's important"],
        "estimatedDuration": 5
      }
    ],
    "concepts": [
      {
        "id": "c1",
        "name": "Chlorophyll",
        "description": "The green pigment that captures sunlight",
        "relatedMilestones": ["m1"],
        "misconceptions": ["Plants eat soil for food"]
      }
    ],
    "estimatedDuration": 20,
    "difficulty": "beginner",
    "visualsNeeded": true,
    "interactiveMoments": [
      {
        "id": "im1",
        "type": "question",
        "milestoneId": "m1",
        "prompt": "What do you think plants need to make food?",
        "expectedResponseType": "voice_or_text"
      }
    ]
  },
  "message": "Lesson plan generated successfully"
}
```

## Configuration

### Environment Variables

Set these in your Supabase project settings under Edge Functions:

- `OPENAI_API_KEY` - For using GPT-4o-mini (recommended)
- `ANTHROPIC_API_KEY` - For using Claude 3.5 Haiku (alternative)

The function will use OpenAI if `OPENAI_API_KEY` is set, otherwise it will use Anthropic.

### AI Model Settings

- **Temperature**: 0.3 (for consistent, structured planning)
- **Max Tokens**: 4000
- **Model**: GPT-4o-mini or Claude 3.5 Haiku

## Features

### Retry Logic with Exponential Backoff

The function implements automatic retry with exponential backoff:
- Max retries: 3
- Initial delay: 1000ms
- Backoff multiplier: 2x

This ensures resilience against temporary API failures.

### Validation

The function validates the generated lesson plan to ensure:
- All required fields are present
- At least one milestone exists
- Concepts and interactive moments are arrays
- Difficulty level is valid (beginner/intermediate/advanced)

### Database Updates

On success, the function:
1. Updates the `lesson_sessions` table with the lesson plan JSON
2. Sets the `normalized_topic` field
3. Initializes `lesson_milestone_progress` records for each milestone

## Error Handling

The function handles errors gracefully:
- Returns 400 for missing required fields
- Returns 500 for AI API failures or database errors
- Logs detailed error information for debugging
- Implements CORS headers for cross-origin requests

## Local Development

To test locally with Supabase CLI:

```bash
# Start Supabase locally
supabase start

# Serve the function
supabase functions serve lesson-planner --env-file supabase/functions/.env

# Test with curl
curl -X POST http://localhost:54321/functions/v1/lesson-planner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "sessionId": "test-session-id",
    "topicPrompt": "Introduction to fractions"
  }'
```

## Deployment

Deploy to Supabase:

```bash
# Deploy the function
supabase functions deploy lesson-planner

# Set environment variables
supabase secrets set OPENAI_API_KEY=your-key-here
```

## Integration

This function is called during the session creation flow:

1. Frontend creates a session with status "planning"
2. Frontend calls this Edge Function with sessionId and topicPrompt
3. Function generates lesson plan and updates session
4. Frontend proceeds to media planning phase

See the design document for the complete session creation sequence.
