# Session Summarizer Edge Function

## Overview

The Session Summarizer is an AI-powered Edge Function that generates comprehensive lesson summaries after a teaching session completes. It analyzes the entire lesson context including the lesson plan, all teaching turns, milestone progress, and learner performance to produce actionable insights and recommendations.

## Purpose

- Generate comprehensive summaries of completed lesson sessions
- Analyze learner performance across all milestones
- Identify strengths, improvement areas, and misconceptions addressed
- Provide key takeaways and recommended next steps
- Track interaction patterns and engagement levels

## API Endpoint

**POST** `/functions/v1/session-summarizer`

### Request Body

```json
{
  "sessionId": "uuid"
}
```

### Response

```json
{
  "success": true,
  "summary": {
    "sessionId": "uuid",
    "topic": "Introduction to Fractions",
    "objective": "Understand basic fraction concepts",
    "duration": {
      "startTime": "2026-01-15T10:00:00Z",
      "endTime": "2026-01-15T10:25:00Z",
      "totalMinutes": 25
    },
    "milestonesOverview": {
      "total": 3,
      "completed": 2,
      "percentComplete": 66.67,
      "milestones": [
        {
          "id": "m1",
          "title": "Understanding Halves",
          "status": "confirmed",
          "attempts": 5,
          "accuracy": 80,
          "keyInsights": [
            "Demonstrated strong visual understanding",
            "Needed guidance on terminology"
          ]
        }
      ]
    },
    "learnerPerformance": {
      "overallEngagement": "high",
      "strengthAreas": ["Visual reasoning", "Persistence"],
      "improvementAreas": ["Mathematical terminology"],
      "misconceptionsAddressed": ["Fractions must have equal parts"],
      "notableAchievements": ["Successfully identified halves in complex shapes"]
    },
    "interactionSummary": {
      "totalTurns": 15,
      "inputModesUsed": ["voice", "canvas_draw", "text"],
      "canvasInteractions": 8,
      "voiceInteractions": 5,
      "textInteractions": 2
    },
    "keyTakeaways": [
      "Learner has strong visual-spatial skills",
      "Needs more practice with fraction terminology"
    ],
    "recommendedNextSteps": [
      "Practice comparing fractions with different denominators",
      "Review fraction vocabulary"
    ],
    "generatedAt": "2026-01-15T10:26:00Z"
  },
  "message": "Lesson summary generated successfully"
}
```

## Features

### 1. Comprehensive Context Analysis

The summarizer analyzes:
- Complete lesson plan with milestones and concepts
- All teaching turns (learner inputs and teacher responses)
- Milestone progress records with evidence
- Session metadata (duration, timestamps)

### 2. AI-Powered Insights

Uses GPT-4o-mini or Claude 3.5 Haiku to:
- Assess overall learner engagement (high/medium/low)
- Identify specific strength areas
- Pinpoint improvement opportunities
- Track misconceptions addressed during the lesson
- Highlight notable achievements
- Generate actionable key takeaways
- Recommend concrete next steps

### 3. Milestone Performance Tracking

For each milestone:
- Status (not_started, introduced, practiced, covered, confirmed)
- Number of attempts
- Accuracy percentage
- Key insights about learner performance

### 4. Interaction Pattern Analysis

Tracks:
- Total learner turns
- Input modes used (voice, text, canvas, etc.)
- Breakdown by interaction type
- Engagement patterns

## AI Model Configuration

- **Model**: GPT-4o-mini or Claude 3.5 Haiku
- **Temperature**: 0.3 (consistent, focused analysis)
- **Max Tokens**: 2000
- **Response Format**: Structured JSON

## Error Handling

The function handles:
- Missing or invalid session IDs
- Sessions that are not yet completed
- Missing lesson plans or milestone data
- AI API failures
- Database query errors

All errors return appropriate HTTP status codes and descriptive error messages.

## Requirements Satisfied

- **Requirement 8.4**: Generate comprehensive lesson summary with context including lesson plan, all turns, milestone progress, and learner performance

## Integration

This function is typically invoked by the lesson completion endpoint (`/api/lesson/session/complete`) after a teaching session ends. The generated summary is stored in the `lesson_sessions.summary_json` field.

## Testing

Unit tests cover:
- Summary structure validation
- Required field presence
- Data type validation
- Engagement level validation
- Milestone progress tracking
- Learner performance analysis
- Interaction summary accuracy
- Duration calculation

Run tests with:
```bash
npm test -- supabase/functions/session-summarizer/index.test.ts
```

## Dependencies

- Deno standard library (HTTP server)
- Supabase JS client
- OpenAI API or Anthropic API (configured via environment variables)

## Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: AI service API key

## Example Usage

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/session-summarizer`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    sessionId: 'abc-123-def-456'
  })
})

const { summary } = await response.json()
console.log(`Lesson completed: ${summary.milestonesOverview.completed}/${summary.milestonesOverview.total} milestones`)
console.log(`Engagement: ${summary.learnerPerformance.overallEngagement}`)
console.log(`Key takeaways: ${summary.keyTakeaways.join(', ')}`)
```

## Performance Considerations

- Summary generation typically takes 2-5 seconds depending on lesson length
- AI API calls are the primary latency factor
- Large lessons (50+ turns) may take longer to process
- Consider implementing caching for frequently accessed summaries

## Future Enhancements

- Support for comparative analysis across multiple sessions
- Trend analysis for learner progress over time
- Customizable summary templates
- Export summaries in multiple formats (PDF, markdown)
- Integration with learning analytics dashboards
