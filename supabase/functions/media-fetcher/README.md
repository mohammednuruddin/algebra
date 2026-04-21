# Media Fetcher Edge Function

## Overview

The Media Fetcher is an AI agent that retrieves existing media assets from external sources (Unsplash, Pexels) based on search queries. It downloads the media, uploads it to Supabase Storage, and creates database records linking the assets to lesson sessions.

## Endpoint

```
POST /functions/v1/media-fetcher
```

## Request

```typescript
{
  sessionId: string;      // UUID of the lesson session
  mediaItemId: string;    // ID from media manifest (ma1, ma2, etc.)
  searchQuery: string;    // Search query for finding media
  type: 'image' | 'diagram' | 'chart' | 'formula';
}
```

## Response

```typescript
{
  success: boolean;
  asset: MediaAssetResult;
  message: string;
}
```

### MediaAssetResult Structure

```typescript
{
  id: string;              // Database record UUID
  url: string;             // Public URL to access the media
  storagePath: string;     // Path in Supabase Storage
  sourceUrl: string;       // Original source URL (for attribution)
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    source: string;        // 'unsplash' or 'pexels'
    photographer?: string;
    photographerUrl?: string;
  }
}
```

## Media Sources

### Primary: Unsplash
- High-quality, curated photography
- Free to use with attribution
- API: `https://api.unsplash.com/search/photos`
- Orientation: Landscape (better for educational content)
- Results: 1 per query (best match)

### Fallback: Pexels
- Alternative free stock photo source
- Used when Unsplash fails or has no results
- API: `https://api.pexels.com/v1/search`
- Orientation: Landscape
- Results: 1 per query (best match)

## Workflow

1. Receive media fetch request with search query
2. Try to fetch from Unsplash:
   - Search for images matching query
   - Select best match (first result)
   - Extract image URL and metadata
3. If Unsplash fails, fallback to Pexels:
   - Search for photos matching query
   - Select best match (first result)
   - Extract photo URL and metadata
4. Download the image from source URL
5. Upload to Supabase Storage:
   - Bucket: `media-assets`
   - Path: `{sessionId}/{mediaItemId}.{extension}`
   - Content type: Detected from blob or default to `image/jpeg`
6. Insert `lesson_media_assets` record:
   - Link to session
   - Store metadata (source, photographer, dimensions)
   - Include search query and fetch timestamp
7. Return asset result with public URL

## Storage Path Format

```
{sessionId}/{mediaItemId}.{extension}

Examples:
- abc-123/ma1.jpg
- def-456/ma2.png
- ghi-789/ma3.webp
```

## Error Handling

- **Missing API Keys**: Returns error if neither Unsplash nor Pexels keys are configured
- **No Results**: Returns error if both sources have no matching images
- **Download Failures**: Returns error if image cannot be downloaded from source
- **Storage Failures**: Returns error if upload to Supabase Storage fails
- **Database Failures**: Returns error if media asset record cannot be inserted

## Environment Variables

Required (at least one):
- `UNSPLASH_ACCESS_KEY` - Unsplash API access key
- `PEXELS_API_KEY` - Pexels API key

Also required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database and storage access

## Testing

Run tests locally:

```bash
npm test supabase/functions/media-fetcher/index.test.ts
```

## Integration

The Media Fetcher is called during session creation for media items marked with `source: 'fetch'`:

```typescript
// After media manifest is generated
for (const item of mediaManifest.items) {
  if (item.source === 'fetch' && item.searchQuery) {
    const result = await fetchMedia({
      sessionId,
      mediaItemId: item.id,
      searchQuery: item.searchQuery,
      type: item.type
    });
    console.log(`Fetched media: ${result.asset.url}`);
  }
}
```

## Attribution

Both Unsplash and Pexels require attribution. The function stores photographer information in metadata:

```typescript
{
  photographer: "Jane Doe",
  photographerUrl: "https://unsplash.com/@janedoe",
  sourceUrl: "https://unsplash.com/photos/abc123"
}
```

Frontend should display attribution when showing these images.

## Requirements Validation

**Validates: Requirements 2.2, 2.4, 10.4**

- ✅ 2.2: Media Fetcher retrieves existing media and uploads to storage
- ✅ 2.4: Inserts lesson_media_assets record linking asset to session
- ✅ 10.4: Stores media assets in Supabase Storage
