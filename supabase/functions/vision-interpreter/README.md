# Vision Interpreter Edge Function

## Overview

The Vision Interpreter Edge Function analyzes learner canvas drawings and image annotations using vision AI models (GPT-4o-mini with vision or Claude 3.5 Haiku with vision). It extracts structured information about shapes, text, concepts, and annotations from visual inputs.

## Purpose

This function enables the AI Teaching Platform to understand and interpret learner visual inputs, including:
- Canvas drawings (freehand, shapes, diagrams)
- Image annotations (highlights, circles, arrows, notes)
- Text written on canvas
- Visual representations of concepts

## API Endpoint

**URL**: `/api/agents/vision-interpreter`

**Method**: `POST`

**Authentication**: Requires Supabase service role key

## Request Format

```json
{
  "sessionId": "uuid",
  "turnId": "uuid (optional)",
  "imageUrl": "https://storage.supabase.co/...",
  "context": {
    "currentMilestone": "Understanding circles (optional)",
    "expectedConcepts": ["geometry", "shapes"] (optional),
    "taskDescription": "Draw a circle and label its radius (optional)"
  }
}
```

### Request Fields

- **sessionId** (required): The lesson session ID
- **turnId** (optional): The teaching turn ID if applicable
- **imageUrl** (required): Public URL of the canvas snapshot or annotated image
- **context** (optional): Additional context to improve interpretation accuracy
  - **currentMilestone**: The current learning milestone
  - **expectedConcepts**: Array of concepts the learner should be demonstrating
  - **taskDescription**: Description of the task the learner is completing

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "result": {
    "interpretedMarking": {
      "shapes": [
        {
          "type": "circle|rectangle|line|arrow|freehand|text|other",
          "description": "Detailed description of the shape",
          "position": { "x": 100, "y": 100 },
          "confidence": 0.95
        }
      ],
      "text": [
        {
          "content": "Extracted text content",
          "position": { "x": 50, "y": 50 },
          "confidence": 0.9
        }
      ],
      "concepts": [
        {
          "name": "geometry",
          "description": "What concept the learner is demonstrating",
          "confidence": 0.85
        }
      ],
      "annotations": [
        {
          "type": "highlight|underline|circle|arrow|note",
          "description": "What the annotation indicates",
          "confidence": 0.8
        }
      ],
      "overallInterpretation": "Comprehensive interpretation of what the learner is trying to express",
      "confidence": 0.9
    },
    "rawResponse": "Raw JSON response from vision model",
    "model": "gpt-4o-mini",
    "timestamp": "2026-01-15T12:34:56.789Z"
  },
  "message": "Vision interpretation completed successfully"
}
```

### Error Response (400/500)

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## AI Models

### Primary Model: GPT-4o-mini with Vision
- Fast and cost-effective vision understanding
- Temperature: 0.3 (deterministic interpretation)
- Max tokens: 1000
- Response format: JSON

### Fallback Model: Claude 3.5 Haiku with Vision
- Used when GPT-4o-mini fails
- Temperature: 0.3 (deterministic interpretation)
- Max tokens: 1000

## Environment Variables

Required environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key for GPT-4o-mini
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude (fallback)

## Features

### Context-Aware Interpretation
The function uses optional context information to improve interpretation accuracy:
- Current learning milestone guides what to look for
- Expected concepts help identify relevant visual elements
- Task description provides intent for the drawing

### Structured Output
All interpretations follow a consistent JSON structure with:
- **Shapes**: Geometric and freehand shapes with descriptions
- **Text**: Extracted text content with positions
- **Concepts**: Educational concepts being demonstrated
- **Annotations**: Highlights, circles, arrows, and notes
- **Overall Interpretation**: Comprehensive summary
- **Confidence Scores**: Reliability indicators for each element

### Error Handling
- Automatic fallback from GPT-4o-mini to Claude
- Detailed error messages for debugging
- Graceful handling of API failures

## Integration

This function is called by the `/api/lesson/canvas/analyze` endpoint when:
1. Learner draws on canvas
2. Learner annotates an image
3. Canvas snapshot is captured and uploaded to storage

The interpreted marking JSON is then:
1. Stored in the `canvas_snapshots` table
2. Passed to the Teacher Conductor for response generation
3. Used to assess learner understanding

## Testing

Run tests with:
```bash
npm test supabase/functions/vision-interpreter/index.test.ts
```

Tests cover:
- Interpreted marking structure validation
- Shape and annotation type validation
- Context-aware interpretation
- Error handling
- Response structure validation

## Requirements Satisfied

- **Requirement 4.6**: Analyze canvas snapshots and image annotations
- **Requirement 4.7**: Extract interpreted marking JSON with shapes, text, concepts, and annotations

## Related Components

- `/api/lesson/canvas/analyze`: Canvas analysis endpoint that calls this function
- `canvas_snapshots` table: Stores interpreted markings
- Teacher Conductor: Uses interpreted markings for teaching responses
