# Media Planner Integration Guide

## Overview

The Media Planner Edge Function is called after the Lesson Planner completes to analyze the lesson plan and generate a media manifest. This manifest identifies what visual assets (images, diagrams, charts, formulas) would enhance the learning experience.

## Integration Flow

```
Session Creation
    ↓
Lesson Planner (generates lesson plan)
    ↓
Media Planner (generates media manifest) ← YOU ARE HERE
    ↓
Media Fetcher (retrieves existing media)
    ↓
Image Generator (creates new media)
    ↓
Session Ready (status: 'ready')
```

## Calling the Media Planner

### From Session Creation Flow

After the Lesson Planner completes, call the Media Planner:

```typescript
// 1. Generate lesson plan
const lessonPlanResponse = await fetch(`${supabaseUrl}/functions/v1/lesson-planner`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId,
    topicPrompt
  })
})

const { lessonPlan } = await lessonPlanResponse.json()

// 2. Generate media manifest
const mediaPlannerResponse = await fetch(`${supabaseUrl}/functions/v1/media-planner`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId,
    lessonPlan
  })
})

const { mediaManifest } = await mediaPlannerResponse.json()

// 3. Process media assets
for (const item of mediaManifest.items) {
  if (item.searchQuery) {
    // Call Media Fetcher (Task 7.2)
    await fetchMediaAsset(sessionId, item)
  } else if (item.generationPrompt) {
    // Call Image Generator (Task 7.3)
    await generateMediaAsset(sessionId, item)
  }
}

// 4. Update session status to 'ready'
await supabase
  .from('lesson_sessions')
  .update({ status: 'ready' })
  .eq('id', sessionId)
```

## Request Format

```typescript
interface MediaPlannerRequest {
  sessionId: string      // UUID of the lesson session
  lessonPlan: LessonPlan // Complete lesson plan from Lesson Planner
}
```

## Response Format

```typescript
interface MediaPlannerResponse {
  success: boolean
  mediaManifest: MediaManifest
  message: string
}

interface MediaManifest {
  items: MediaItem[]
  totalEstimatedAssets: number
}

interface MediaItem {
  id: string                    // ma1, ma2, etc.
  type: 'image' | 'diagram' | 'chart' | 'formula'
  description: string           // What this media shows
  altText: string              // Accessibility description
  relatedMilestones: string[]  // Milestone IDs
  searchQuery?: string         // For Media Fetcher
  generationPrompt?: string    // For Image Generator
}
```

## Database Updates

The Media Planner automatically updates the session record:

```sql
UPDATE lesson_sessions
SET 
  media_manifest_json = $1,
  updated_at = NOW()
WHERE id = $2
```

## Next Steps

After the Media Planner completes:

1. **Process Media Assets** (Tasks 7.2, 7.3):
   - For items with `searchQuery`: Call Media Fetcher
   - For items with `generationPrompt`: Call Image Generator
   - Insert records into `lesson_media_assets` table

2. **Update Session Status**:
   - Once all media is prepared, set `status = 'ready'`
   - Frontend can then display the lesson board

## Error Handling

The Media Planner includes retry logic with exponential backoff:

```typescript
try {
  const response = await fetch('/functions/v1/media-planner', { ... })
  
  if (!response.ok) {
    throw new Error(`Media Planner failed: ${response.status}`)
  }
  
  const { mediaManifest } = await response.json()
  
  // Continue with media processing...
  
} catch (error) {
  console.error('Media planning failed:', error)
  
  // Option 1: Continue without media
  await supabase
    .from('lesson_sessions')
    .update({ 
      status: 'ready',
      media_manifest_json: { items: [], totalEstimatedAssets: 0 }
    })
    .eq('id', sessionId)
  
  // Option 2: Retry media planning
  // Option 3: Fail session creation
}
```

## Media Type Guidelines

### When to Use Each Type

**Image**: Concrete objects, real-world examples
- Example: "A photograph of a plant leaf"
- Use `searchQuery` to find existing photos

**Diagram**: Processes, systems, relationships
- Example: "Diagram showing photosynthesis steps"
- Use `generationPrompt` to create custom diagrams

**Chart**: Data visualization, comparisons
- Example: "Bar chart of light absorption rates"
- Use `generationPrompt` for custom charts

**Formula**: Mathematical or chemical equations
- Example: "6CO2 + 6H2O + light → C6H12O6 + 6O2"
- Use `generationPrompt` to format equations

## Testing

Run tests to verify integration:

```bash
npm test -- supabase/functions/media-planner/index.test.ts
```

## Requirements Validation

**Validates: Requirements 1.4, 2.1, 2.6**

- ✅ 1.4: Media Planner analyzes lesson plan and produces media manifest
- ✅ 2.1: System processes each media item before teaching begins
- ✅ 2.6: Media manifest stored as structured JSON in session record

## Example Media Manifest

```json
{
  "items": [
    {
      "id": "ma1",
      "type": "diagram",
      "description": "Diagram showing the photosynthesis process in a plant cell",
      "altText": "A labeled diagram illustrating how chloroplasts convert sunlight, water, and CO2 into glucose and oxygen",
      "relatedMilestones": ["m1", "m2"],
      "generationPrompt": "Create an educational diagram showing the photosynthesis process inside a plant cell, with labels for chloroplast, sunlight, water, CO2, glucose, and oxygen. Use a clear, simple style suitable for beginners."
    },
    {
      "id": "ma2",
      "type": "chart",
      "description": "Chart showing light absorption spectrum of chlorophyll",
      "altText": "A line graph showing how chlorophyll absorbs different wavelengths of light, with peaks in blue and red regions",
      "relatedMilestones": ["m1"],
      "searchQuery": "chlorophyll light absorption spectrum graph"
    },
    {
      "id": "ma3",
      "type": "formula",
      "description": "Chemical equation for photosynthesis",
      "altText": "The chemical equation: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2",
      "relatedMilestones": ["m2"],
      "generationPrompt": "Display the photosynthesis chemical equation in a clear, readable format: 6CO2 + 6H2O + light → C6H12O6 + 6O2"
    }
  ],
  "totalEstimatedAssets": 3
}
```

## Frontend Integration

Once media is prepared, the frontend can access it:

```typescript
// Fetch session with media manifest
const { data: session } = await supabase
  .from('lesson_sessions')
  .select('*, lesson_media_assets(*)')
  .eq('id', sessionId)
  .single()

// Display media assets on lesson board
const mediaManifest = session.media_manifest_json
const mediaAssets = session.lesson_media_assets

// Render media for current milestone
const currentMilestoneMedia = mediaAssets.filter(asset => {
  const manifestItem = mediaManifest.items.find(item => item.id === asset.metadata_json.manifestItemId)
  return manifestItem?.relatedMilestones.includes(currentMilestoneId)
})
```
