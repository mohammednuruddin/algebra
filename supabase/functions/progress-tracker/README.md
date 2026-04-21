# Progress Tracker Edge Function

## Overview

The Progress Tracker is an AI-powered agent that assesses learner understanding against milestone success criteria throughout a teaching session. It analyzes turn history, learner responses, and teacher feedback to determine progress status for all milestones and identify when learners are ready to advance.

## Purpose

- **Assess Understanding**: Evaluate learner comprehension against milestone success criteria
- **Track Progress**: Monitor status transitions (not_started → introduced → practiced → covered → confirmed)
- **Determine Advancement**: Identify when learners have mastered concepts and should move to the next milestone
- **Enable Completion**: Signal when all required milestones are completed and the lesson should end

## API Endpoint

**URL**: `/api/agents/progress-tracker`  
**Method**: `POST`  
**Content-Type**: `application/json`

### Request Body

```json
{
  "sessionId": "uuid",
  "currentMilestoneId": "m1" // optional, defaults to session's current_milestone_id
}
```

### Response

```json
{
  "success": true,
  "result": {
    "sessionId": "uuid",
    "currentMilestoneId": "m1",
    "nextMilestoneId": "m2",
    "allMilestonesProgress": [
      {
        "milestoneId": "m1",
        "status": "confirmed",
        "attempts": 5,
        "correctAttempts": 4,
        "accuracy": 0.8,
        "evidence": ["Correctly identified concept", "Explained reasoning clearly"],
        "shouldAdvance": true,
        "reasoning": "Learner has consistently demonstrated mastery of success criteria"
      }
    ],
    "overallProgress": {
      "totalMilestones": 3,
      "completedMilestones": 1,
      "currentMilestoneIndex": 0,
      "percentComplete": 33.33
    },
    "shouldCompleteLesson": false,
    "timestamp": "2026-01-15T10:30:00Z"
  },
  "message": "Progress tracking completed successfully"
}
```

## Milestone Status Definitions

- **not_started**: Milestone hasn't been introduced yet
- **introduced**: Milestone has been presented but learner hasn't practiced
- **practiced**: Learner has attempted tasks but hasn't demonstrated mastery
- **covered**: Learner has demonstrated understanding of core concepts
- **confirmed**: Learner has consistently demonstrated mastery (ready to advance)

## Assessment Logic

The Progress Tracker uses AI to analyze:

1. **Success Criteria**: Milestone-specific learning objectives
2. **Turn History**: All learner inputs and teacher responses for the milestone
3. **Current Progress**: Existing attempts, correct attempts, and evidence
4. **Feedback Patterns**: Teacher feedback types (positive, corrective, neutral)
5. **Answer Correctness**: Whether learner responses were marked correct

### AI Assessment

The function uses GPT-4o-mini or Claude 3.5 Haiku to:
- Evaluate learner understanding against success criteria
- Determine appropriate status transitions
- Decide if learner should advance to next milestone
- Generate reasoning and evidence for the assessment

## Integration

### Called By

- **Teacher Conductor**: During turn processing to assess milestone progress
- **Session Completion**: To verify all required milestones are completed

### Dependencies

- **Supabase Database**: Fetches session, turns, and progress records
- **AI Service**: OpenAI GPT-4o-mini or Anthropic Claude 3.5 Haiku
- **Environment Variables**:
  - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Error Handling

- Returns 400 for missing required fields
- Returns 500 for database errors, AI service failures, or internal errors
- Logs detailed error information for debugging
- Gracefully handles missing progress records (treats as not_started)

## Testing

Run unit tests:
```bash
deno test supabase/functions/progress-tracker/index.test.ts --allow-env --allow-net
```

Tests cover:
- Request validation
- Accuracy calculations
- Milestone completion detection
- Lesson completion criteria
- Next milestone identification
- Progress percentage calculations
- Turn filtering
- Evidence accumulation
- Status validation

## Requirements Satisfied

- **5.3**: Teacher Conductor invokes Progress Tracker to assess milestone progress
- **5.4**: Progress Tracker returns current progress status for all milestones
- **7.2**: System continuously assesses learner understanding against milestone criteria
- **7.3**: System marks milestones as complete when achieved

## Related Functions

- **Lesson Planner**: Generates milestones with success criteria
- **Teacher Conductor**: Uses progress assessments to guide teaching
- **Session Summarizer**: Uses final progress data for lesson summary
