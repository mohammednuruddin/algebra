# Lesson History Page

## Overview

The lesson history page displays completed lessons for the current browser session. It provides a visual grid of lesson cards with thumbnails, titles, dates, and quick stats.

## Features

- **Authentication Check**: Redirects to login if user is not authenticated
- **Lesson List**: Displays all completed lessons with articles
- **Responsive Grid**: 1 column on mobile, 2 on tablet, 3 on desktop
- **Lesson Cards**: Each card shows:
  - Thumbnail preview (first image or placeholder)
  - Lesson title
  - Completion date
  - Duration (in minutes)
  - Milestones covered (e.g., "3/4 milestones")
  - Difficulty level
  - Completion percentage with progress bar
- **Empty State**: Shows helpful message when no lessons exist
- **Navigation**: Click any card to view the full article

## Route

`/lessons/history`

## Data Source

For guest lessons, the page reads from browser-backed lesson history via `listGuestHistoryItems()`.
Thumbnail selection prefers:
- `metadata_json.first_image_url`
- the first persisted lesson media asset URL
- placeholder artwork only when no lesson image exists

## Metadata Structure

```typescript
{
  topic?: string;
  duration?: number; // in seconds
  milestones_covered?: number;
  total_milestones?: number;
  completion_percentage?: number;
  difficulty?: string;
  first_image_url?: string;
}
```

## Implementation Details

- **Server Component**: Uses Next.js App Router server component pattern
- **Supabase Client**: Server-side Supabase client for secure data fetching
- **Tailwind CSS**: Responsive styling with dark mode support
- **Type Safety**: Full TypeScript types for lesson data

## Testing

Unit tests cover:
- Authentication redirect
- Lesson list display
- Empty state handling
- Database error handling

Run tests:
```bash
npm test app/lessons/history/page.test.tsx
```

## Related Components

- `UserMenu`: User profile and logout functionality
- Article Viewer: `/lessons/article/[id]` (to be implemented in task 32.1)

## Requirements

Implements requirement 13.8:
> WHEN a learner accesses the lesson history page, THE Frontend SHALL display a list of all completed lessons with titles, dates, and thumbnail previews
