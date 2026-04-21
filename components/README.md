# UI Components Documentation

This directory contains the core UI components for the AI Teaching Platform.

## Layout Components

### MainLayout (`layout/main-layout.tsx`)

The main application layout component that provides consistent header, navigation, and structure across all pages.

**Features:**
- Responsive header with platform branding
- Navigation links (Start Lesson, History) for authenticated users
- User menu with authentication status
- Sign in/out functionality

**Usage:**
```tsx
import { MainLayout } from '@/components/layout/main-layout';

export default async function Page() {
  return (
    <MainLayout>
      <YourContent />
    </MainLayout>
  );
}
```

## Lesson Components

### LessonStart (`lesson/lesson-start.tsx`)

A form component for starting a new lesson by entering a topic.

**Features:**
- Topic input with validation
- Loading states during lesson creation
- Progress indicators (planning, preparing media, etc.)
- Error handling and display

**Props:**
```typescript
interface LessonStartProps {
  onStartLesson: (topic: string) => Promise<void>;
}
```

**Usage:**
```tsx
import { LessonStart } from '@/components/lesson/lesson-start';

function MyPage() {
  const handleStartLesson = async (topic: string) => {
    // Call API to create lesson
    await createLesson(topic);
  };

  return <LessonStart onStartLesson={handleStartLesson} />;
}
```

### LessonBoard (`lesson/lesson-board.tsx`)

The main teaching interface that displays lesson content, progress, and interactions.

**Features:**
- Topic and current milestone display
- Media asset rendering with captions
- Progress tracking sidebar with milestone status
- Visual progress indicators (completed, in progress, not started)
- Progress bar showing completion percentage
- End lesson button

**Props:**
```typescript
interface LessonBoardProps {
  sessionId: string;
  topic: string;
  milestones: Milestone[];
  currentMilestoneId: string | null;
  mediaAssets: MediaAsset[];
  onEndLesson: () => Promise<void>;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
}

interface MediaAsset {
  id: string;
  url: string;
  type: string;
  caption?: string;
}
```

**Usage:**
```tsx
import { LessonBoard } from '@/components/lesson/lesson-board';

function MyPage() {
  const handleEndLesson = async () => {
    // Call API to end lesson
    await endLesson(sessionId);
  };

  return (
    <LessonBoard
      sessionId="session-123"
      topic="Photosynthesis"
      milestones={milestones}
      currentMilestoneId="milestone-2"
      mediaAssets={assets}
      onEndLesson={handleEndLesson}
    />
  );
}
```

## Demo

Visit `/demo` to see interactive demonstrations of all components.

## Testing

All components have comprehensive unit tests. Run tests with:

```bash
npm test
```

Test files are co-located with components:
- `components/layout/main-layout.test.tsx`
- `components/lesson/lesson-start.test.tsx`
- `components/lesson/lesson-board.test.tsx`

## Design System

Components use Tailwind CSS with a consistent design system:

**Colors:**
- Primary: Indigo (indigo-600, indigo-700)
- Success: Green (green-600, green-700)
- Error: Red (red-600, red-700)
- Neutral: Gray scale

**Spacing:**
- Consistent padding and margins using Tailwind's spacing scale
- Responsive breakpoints (sm, md, lg)

**Typography:**
- Font weights: medium (500), semibold (600), bold (700)
- Text sizes: sm, base, lg, xl, 2xl, 3xl, 4xl

## Future Enhancements

The following components will be added in future tasks:
- Canvas drawing component (Konva integration)
- Voice input/output components (ElevenLabs integration)
- Text input component
- Teaching action renderer
- Lesson summary display
