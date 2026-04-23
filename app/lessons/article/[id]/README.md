# Article Viewer with Metadata Sidebar

## Overview

This directory contains the article viewer page for displaying completed lesson articles with a comprehensive metadata sidebar.

## Task 32.2 Implementation

### Features Implemented

1. **Metadata Sidebar** (Requirement 13.12)
   - Displays topic from lesson metadata
   - Shows formatted date (e.g., "January 15, 2026")
   - Displays duration in human-readable format (e.g., "30 min" or "1h 30m")
   - Shows milestones covered (e.g., "3 / 4 completed")
   - Displays completion percentage with visual progress bar
   - Sticky positioning for easy access while scrolling

2. **Lesson Completion Stats**
   - Visual progress bar showing completion percentage
   - Milestone completion count
   - Duration tracking

3. **Navigation**
   - "Back to Lesson History" link in header
   - "All Lessons" button in sidebar
   - Both navigate to `/lessons/history`

4. **Article Content Display**
   - Article title prominently displayed
   - Markdown content rendered (basic pre-formatted display)
   - Responsive layout with sidebar on desktop, stacked on mobile

5. **Lesson Continuation**
   - "Continue lesson" CTA appears when hidden continuation context exists
   - CTA links back to the tutor home surface with the article id marker
   - The continuation packet stays hidden from the rendered article body
   - The tutor uses that packet to resume from prior strengths, weaknesses, turns, and visuals

## Files

- `page.tsx` - Server component that fetches article data and handles authentication
- `client.tsx` - Client component that renders the article viewer with metadata sidebar
- `client.test.tsx` - Unit tests for the metadata sidebar and article viewer
- `page.test.tsx` - Tests for server-side authentication and data fetching
- `not-found.tsx` - 404 page for missing or unauthorized articles
- `README.md` - This file

## Components

### ArticleViewer (client.tsx)

Main client component that displays:
- Article content area (3/4 width on desktop)
- Metadata sidebar (1/4 width on desktop)
- Responsive grid layout
- Optional continue-lesson CTA when guest continuation context exists

### Metadata Header Features

- **Topic**: Displays the lesson topic with Target icon
- **Date**: Formatted date with Calendar icon
- **Duration**: Human-readable duration with Clock icon
- **Milestones**: Completion count with CheckCircle2 icon
- **Completion**: Percentage with visual progress bar
- **Navigation**: Button to return to lesson history

### Helper Functions

- `formatDuration(seconds)`: Converts seconds to "X min" or "Xh Ym" format
- `formatDate(dateString)`: Formats date as "Month Day, Year"

## Testing

Tests cover:
- article metadata and markdown rendering
- share feedback
- continue-lesson CTA rendering
- guest article not-found state

Run tests:
```bash
npm test -- 'app/lessons/article'
```

## Dependencies

- `lucide-react`: Icons for metadata sidebar
- `next`: App Router and server components
- `@/lib/supabase/server`: Database access
- `@/lib/types/database`: TypeScript types

## Future Enhancements

Task 32.1 and 32.3-32.5 will add:
- Proper markdown rendering with react-markdown
- LaTeX formula rendering with KaTeX
- Embedded image display
- PDF download functionality
- Share link functionality
