# Media Planner Edge Function

## Overview

The Media Planner is an AI agent that analyzes lesson plans and generates a media manifest identifying visual assets needed to enhance learning. It determines what types of media (images, diagrams, charts, formulas) would be most beneficial for each concept and milestone.

## Endpoint

```
POST /functions/v1/media-planner
```

## Request

```typescript
{
  sessionId: string;      // UUID of the lesson session
  lessonPlan: LessonPlan; // Complete lesson plan object
}
```

## Response

```typescript
{
  success: boolean;
  mediaManifest: MediaManifest;
  message: string;
}
```

### MediaManifest Structure

```typescript
{
  items: MediaItem[];
  totalEstimatedAssets: number;
}
```

### MediaItem Structure

```typescript
{
  id: string;                    // Unique identifier (ma1, ma2, etc.)
  type: 'image' | 'diagram' | 'chart' | 'formula';
  description: string;           // What this media shows
  altText: string;              // Accessibility description
  relatedMilestones: string[];  // Milestone IDs this media supports
  searchQuery?: string;         // Query for finding existing media
  generationPrompt?: string;    // Prompt for generating new media
}
```

## Media Type Guidelines

### Image
- Use for: Concrete objects, real-world examples, photographs
- Example: "A photograph of a plant leaf showing chloroplasts"

### Diagram
- Use for: Processes, relationships, systems, workflows
- Example: "Diagram showing the steps of photosynthesis in a plant cell"

### Chart
- Use for: Data visualization, comparisons, statistics
- Example: "Bar chart comparing photosynthesis rates under different light conditions"

### Formula
- Use for: Mathematical equations, chemical formulas
- Example: "The chemical equation for photosynthesis: 6CO2 + 6H2O + light → C6H12O6 + 6O2"

## AI Model Configuration

- **Model**: GPT-4o-mini or Claude 3.5 Haiku
- **Temperature**: 0.3 (deterministic, focused output)
- **Max Tokens**: 2000
- **Response Format**: JSON object

## Workflow

1. Receive lesson plan from session creation flow
2. Analyze milestones and concepts to identify visual learning opportunities
3. For each identified need:
   - Determine appropriate media type
   - Create descriptive text and alt text
   - Generate either a search query (for existing media) or generation prompt (for new media)
   - Link to relevant milestones
4. Validate manifest structure
5. Store manifest in session record (`media_manifest_json`)
6. Return manifest for downstream processing

## Integration

The Media Planner is called after the Lesson Planner completes:

```typescript
// 1. Generate lesson plan
const lessonPlan = await generateLessonPlan(topicPrompt);

// 2. Generate media manifest
const mediaManifest = await generateMediaManifest(sessionId, lessonPlan);

// 3. Process media assets (fetch or generate)
for (const item of mediaManifest.items) {
  if (item.searchQuery) {
    await fetchMedia(item);
  } else if (item.generationPrompt) {
    await generateMedia(item);
  }
}
```

## Error Handling

- Retries with exponential backoff (3 attempts)
- Validates manifest structure before storing
- Returns detailed error messages for debugging
- Logs all errors with context

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - AI service API key

## Testing

Run tests locally:

```bash
deno test --allow-net --allow-env supabase/functions/media-planner/index.test.ts
```

## Requirements Validation

**Validates: Requirements 1.4, 2.1, 2.6**

- ✅ 1.4: Media Planner analyzes lesson plan and produces media manifest
- ✅ 2.1: System processes each media item before teaching begins
- ✅ 2.6: Media manifest stored as structured JSON in session record
