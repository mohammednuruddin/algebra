# Image Generator Edge Function

## Overview

The Image Generator is an AI agent that creates new visual assets using image generation models (DALL-E 3, Stable Diffusion) based on generation prompts. It generates educational diagrams, illustrations, and visual aids, uploads them to Supabase Storage, and creates database records linking the assets to lesson sessions.

## Endpoint

```
POST /functions/v1/image-generator
```

## Request

```typescript
{
  sessionId: string;      // UUID of the lesson session
  mediaItemId: string;    // ID from media manifest (ma1, ma2, etc.)
  prompt: string;         // Generation prompt describing desired image
  type: 'image' | 'diagram' | 'chart' | 'formula';
}
```

## Response

```typescript
{
  success: boolean;
  asset: GeneratedImageResult;
  message: string;
}
```

### GeneratedImageResult Structure

```typescript
{
  id: string;              // Database record UUID
  url: string;             // Public URL to access the generated image
  storagePath: string;     // Path in Supabase Storage
  metadata: {
    prompt: string;        // Original generation prompt
    model: string;         // Model used ('dall-e-3' or 'stable-diffusion-xl')
    generatedAt: string;   // ISO timestamp
  }
}
```

## Image Generation Models

### Primary: DALL-E 3
- OpenAI's latest image generation model
- High-quality, coherent images
- API: `https://api.openai.com/v1/images/generations`
- Configuration:
  - Model: `dall-e-3`
  - Size: `1024x1024`
  - Quality: `standard` (faster generation)
  - Style: `natural` (suitable for educational content)
  - N: 1 (single image)

### Fallback: Stable Diffusion XL
- Open-source alternative via Replicate
- Used when DALL-E fails or is unavailable
- API: `https://api.replicate.com/v1/predictions`
- Configuration:
  - Model: `stability-ai/sdxl`
  - Size: `1024x1024`
  - Outputs: 1
- Requires polling for completion

## Prompt Enhancement

The function automatically enhances prompts for educational content:

**Original prompt:**
```
photosynthesis process
```

**Enhanced prompt (DALL-E):**
```
Educational diagram or illustration: photosynthesis process. 
Style: clear, simple, suitable for learning. 
High quality, well-labeled if applicable.
```

**Enhanced prompt (Stable Diffusion):**
```
photosynthesis process, educational illustration, 
clear and simple, high quality, detailed
```

## Workflow

1. Receive image generation request with prompt
2. Try to generate with DALL-E 3:
   - Enhance prompt for educational content
   - Call OpenAI API with configuration
   - Extract generated image URL
   - Store revised prompt from API
3. If DALL-E fails, fallback to Stable Diffusion:
   - Enhance prompt for SD style
   - Create prediction via Replicate API
   - Poll for completion (check every 1 second)
   - Extract output image URL
4. Download the generated image
5. Upload to Supabase Storage:
   - Bucket: `media-assets`
   - Path: `{sessionId}/{mediaItemId}_generated.png`
   - Content type: `image/png`
6. Insert `lesson_media_assets` record:
   - Link to session
   - Store metadata (model, prompt, timestamp)
   - Mark source as 'generated'
7. Return asset result with public URL

## Storage Path Format

```
{sessionId}/{mediaItemId}_generated.png

Examples:
- abc-123/ma1_generated.png
- def-456/ma2_generated.png
- ghi-789/ma3_generated.png
```

All generated images are stored as PNG format.

## Error Handling

- **Missing API Keys**: Returns error if neither OpenAI nor Replicate keys are configured
- **Generation Failures**: Returns error if both DALL-E and Stable Diffusion fail
- **Download Failures**: Returns error if generated image cannot be downloaded
- **Storage Failures**: Returns error if upload to Supabase Storage fails
- **Database Failures**: Returns error if media asset record cannot be inserted
- **Prediction Failures**: Returns error if Stable Diffusion prediction fails or times out

## Environment Variables

Required (at least one):
- `OPENAI_API_KEY` - OpenAI API key for DALL-E 3
- `REPLICATE_API_KEY` - Replicate API key for Stable Diffusion

Also required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database and storage access

## Testing

Run tests locally:

```bash
npm test supabase/functions/image-generator/index.test.ts
```

## Integration

The Image Generator is called during session creation for media items marked with `source: 'generate'`:

```typescript
// After media manifest is generated
for (const item of mediaManifest.items) {
  if (item.source === 'generate' && item.generationPrompt) {
    const result = await generateImage({
      sessionId,
      mediaItemId: item.id,
      prompt: item.generationPrompt,
      type: item.type
    });
    console.log(`Generated image: ${result.asset.url}`);
  }
}
```

## Use Cases

### Diagrams
Generate process diagrams, system illustrations, concept maps:
```
"Create a diagram showing the steps of photosynthesis in a plant cell"
```

### Charts
Generate visual comparisons, data representations:
```
"Create a bar chart comparing photosynthesis rates under different light conditions"
```

### Illustrations
Generate educational illustrations for abstract concepts:
```
"Illustrate the concept of cellular respiration with labeled components"
```

### Formulas
Generate visual representations of mathematical or chemical formulas:
```
"Display the chemical equation for photosynthesis with molecule diagrams"
```

## Quality Considerations

- **Standard Quality**: Used for faster generation (not HD)
- **Natural Style**: Produces realistic, educational-appropriate images
- **Size**: 1024x1024 provides good quality while being reasonably sized
- **Educational Enhancement**: Prompts are automatically enhanced to emphasize clarity and learning suitability

## Requirements Validation

**Validates: Requirements 2.3, 2.4, 10.4**

- ✅ 2.3: Image Generator creates new visual assets when existing media not available
- ✅ 2.4: Inserts lesson_media_assets record linking asset to session
- ✅ 10.4: Stores generated media in Supabase Storage
