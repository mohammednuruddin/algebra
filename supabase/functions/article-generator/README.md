# Article Generator Edge Function

## Overview

The Article Generator is an AI-powered Edge Function that synthesizes completed lesson sessions into comprehensive, well-structured markdown articles. It transforms lesson plans, teaching turns, media assets, and learner performance data into readable educational content suitable for review and reference.

## Purpose

After a lesson completes, this function:
- Generates a structured markdown article capturing the entire learning experience
- Embeds media assets (images, diagrams) at appropriate positions
- Includes formulas and equations using LaTeX notation
- Creates a descriptive title following the pattern: `[Topic] - [Key Concept] - [Date]`
- Stores the article in Supabase Storage for permanent access
- Creates a database record for quick retrieval and listing

## API Endpoint

**POST** `/api/agents/article-generator`

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
  "article": {
    "id": "uuid",
    "title": "Understanding Photosynthesis - How Plants Make Food - January 15, 2026",
    "storagePath": "user-id/session-id/article.md",
    "metadata": {
      "topic": "Understanding Photosynthesis",
      "duration": 15,
      "milestonesTotal": 3,
      "milestonesCompleted": 3,
      "difficulty": "beginner",
      "mediaCount": 2
    }
  },
  "message": "Article generated successfully"
}
```

## Article Structure

Generated articles follow this structure:

```markdown
# [Auto-Generated Title]

**Topic:** [Lesson Topic]
**Date:** [Completion Date]
**Duration:** [X minutes]
**Milestones Covered:** [X/Y]

## Introduction

[Brief overview of what was taught and learned]

## [Milestone 1 Title]

[Explanation of concept with embedded media]

![Diagram description](storage-url)

### Key Points
- [Point 1]
- [Point 2]

### Examples
[Worked examples from teaching turns]

## [Milestone 2 Title]

[Content continues...]

## Summary

[What the learner accomplished, key takeaways, and next steps]
```

## Features

### 1. AI-Powered Content Synthesis
- Uses GPT-4o-mini or Claude 3.5 Haiku with temperature 0.3 for consistent generation
- Synthesizes lesson plan, teaching turns, and performance data into cohesive narrative
- Preserves key concepts, examples, and explanations from the teaching session

### 2. Media Embedding
- Automatically embeds images and diagrams at appropriate positions
- Uses markdown image syntax with descriptive alt text
- Replaces placeholders with actual Supabase Storage URLs

### 3. LaTeX Formula Support
- Inline formulas: `$E = mc^2$`
- Block formulas: `$$\int_0^\infty e^{-x} dx = 1$$`
- Chemical equations: `$$6CO_2 + 6H_2O + \text{light} \rightarrow C_6H_{12}O_6 + 6O_2$$`

### 4. Descriptive Title Generation
- Pattern: `[Topic] - [Key Concept] - [Date]`
- Examples:
  - "Understanding Photosynthesis - How Plants Make Food - January 15, 2026"
  - "Fractions Fundamentals - Halves and Quarters - January 15, 2026"
  - "World War 1 Overview - Causes and Major Events - January 15, 2026"

### 5. Storage and Persistence
- Articles stored in `lesson-articles` bucket
- Path format: `{user_id}/{session_id}/article.md`
- Database record in `lesson_articles` table
- Session updated with `article_path` and `article_generated_at`

## Requirements Validation

**Validates Requirements:**
- **13.1**: Article Generator synthesizes lesson into structured markdown
- **13.2**: Includes all media assets at appropriate positions
- **13.3**: Includes formulas using LaTeX notation
- **13.4**: Generates descriptive title following pattern

## AI Model Configuration

### OpenAI (GPT-4o-mini)
```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.3,
  max_tokens: 4000,
  response_format: { type: 'json_object' }
}
```

### Anthropic (Claude 3.5 Haiku)
```typescript
{
  model: 'claude-3-5-haiku-20241022',
  temperature: 0.3,
  max_tokens: 4000
}
```

## Error Handling

The function handles various error scenarios:
- Missing or invalid session ID
- Session not completed
- Missing lesson plan or summary
- AI API failures
- Storage upload failures
- Database insertion failures

All errors are logged and returned with appropriate HTTP status codes.

## Testing

Run tests with:
```bash
deno test supabase/functions/article-generator/index.test.ts --allow-env --allow-net
```

Tests cover:
- Title generation format
- Markdown structure validation
- Media embedding logic
- Metadata structure
- LaTeX formula handling
- Storage path format

## Integration

The Article Generator is typically called after the Session Summarizer completes:

1. Lesson completes → Session status set to "completed"
2. Session Summarizer generates summary JSON
3. **Article Generator creates markdown article**
4. Article stored in database and storage
5. Frontend displays article in lesson history

## Dependencies

- Supabase Client (`@supabase/supabase-js@2`)
- OpenAI API or Anthropic API
- Deno Standard Library

## Environment Variables

Required:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: AI service API key
