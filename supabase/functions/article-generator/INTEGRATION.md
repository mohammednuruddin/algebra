# Article Generator Integration Guide

## Overview

This guide explains how to integrate the Article Generator Edge Function into the AI Teaching Platform's lesson completion workflow.

## Integration Points

### 1. Session Completion Flow

The Article Generator should be called after a lesson session completes and the summary is generated:

```typescript
// In session-complete endpoint or after session-summarizer
async function completeLesson(sessionId: string) {
  // 1. Mark session as completed
  await supabase
    .from('lesson_sessions')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', sessionId)
  
  // 2. Generate summary
  const summaryResponse = await fetch(
    `${supabaseUrl}/functions/v1/session-summarizer`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    }
  )
  
  // 3. Generate article
  const articleResponse = await fetch(
    `${supabaseUrl}/functions/v1/article-generator`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    }
  )
  
  const { article } = await articleResponse.json()
  return article
}
```

### 2. Frontend Integration - Lesson History Page

Create a lesson history page that displays all completed lessons with their articles:

```typescript
// app/lessons/history/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function LessonHistoryPage() {
  const supabase = createServerClient()
  
  // Fetch all articles for the current user
  const { data: articles } = await supabase
    .from('lesson_articles')
    .select(`
      id,
      title,
      metadata_json,
      created_at,
      session:lesson_sessions(
        id,
        topic_prompt,
        completed_at
      )
    `)
    .order('created_at', { ascending: false })
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Lesson History</h1>
      
      <div className="grid gap-4">
        {articles?.map(article => (
          <ArticleCard
            key={article.id}
            id={article.id}
            title={article.title}
            metadata={article.metadata_json}
            completedAt={article.created_at}
          />
        ))}
      </div>
    </div>
  )
}
```

### 3. Frontend Integration - Article Viewer

Create an article viewer page that renders the markdown with proper formatting:

```typescript
// app/lessons/article/[id]/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export default async function ArticleViewerPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const supabase = createServerClient()
  
  // Fetch article
  const { data: article } = await supabase
    .from('lesson_articles')
    .select('*')
    .eq('id', params.id)
    .single()
  
  if (!article) {
    return <div>Article not found</div>
  }
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="prose prose-lg dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {article.article_markdown}
        </ReactMarkdown>
      </div>
      
      <div className="mt-8 flex gap-4">
        <button onClick={() => downloadAsPDF(article)}>
          Download PDF
        </button>
        <button onClick={() => shareArticle(article.id)}>
          Share Link
        </button>
      </div>
    </div>
  )
}
```

### 4. API Route Integration

Create a Next.js API route to call the Edge Function:

```typescript
// app/api/lesson/article/generate/route.ts
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { sessionId } = await request.json()
  
  // Verify user owns this session
  const { data: session } = await supabase
    .from('lesson_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!session || session.user_id !== user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }
  
  // Call Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/article-generator`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    }
  )
  
  const data = await response.json()
  return NextResponse.json(data)
}
```

## Database Queries

### Fetch All Articles for User

```sql
SELECT 
  a.id,
  a.title,
  a.metadata_json,
  a.created_at,
  s.topic_prompt,
  s.completed_at
FROM lesson_articles a
JOIN lesson_sessions s ON s.id = a.session_id
WHERE a.user_id = $1
ORDER BY a.created_at DESC;
```

### Fetch Article with Session Details

```sql
SELECT 
  a.*,
  s.topic_prompt,
  s.lesson_plan_json,
  s.summary_json,
  s.completed_at
FROM lesson_articles a
JOIN lesson_sessions s ON s.id = a.session_id
WHERE a.id = $1;
```

### Search Articles by Topic

```sql
SELECT *
FROM lesson_articles
WHERE user_id = $1
  AND (
    title ILIKE '%' || $2 || '%'
    OR metadata_json->>'topic' ILIKE '%' || $2 || '%'
  )
ORDER BY created_at DESC;
```

## Storage Access

### Get Article Public URL

```typescript
const { data } = supabase.storage
  .from('lesson-articles')
  .getPublicUrl(article.article_storage_path)

console.log(data.publicUrl)
```

### Download Article

```typescript
const { data, error } = await supabase.storage
  .from('lesson-articles')
  .download(article.article_storage_path)

if (data) {
  const text = await data.text()
  console.log(text) // Markdown content
}
```

## UI Components

### Article Card Component

```typescript
// components/lesson/article-card.tsx
interface ArticleCardProps {
  id: string
  title: string
  metadata: {
    topic: string
    duration: number
    milestonesCompleted: number
    milestonesTotal: number
    difficulty: string
  }
  completedAt: string
}

export function ArticleCard({ 
  id, 
  title, 
  metadata, 
  completedAt 
}: ArticleCardProps) {
  return (
    <Link href={`/lessons/article/${id}`}>
      <div className="border rounded-lg p-4 hover:shadow-lg transition">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        
        <div className="flex gap-4 text-sm text-gray-600 mb-2">
          <span>{metadata.duration} minutes</span>
          <span>
            {metadata.milestonesCompleted}/{metadata.milestonesTotal} milestones
          </span>
          <span className="capitalize">{metadata.difficulty}</span>
        </div>
        
        <p className="text-sm text-gray-500">
          {new Date(completedAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  )
}
```

### Article Viewer Component

```typescript
// components/lesson/article-viewer.tsx
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface ArticleViewerProps {
  markdown: string
}

export function ArticleViewer({ markdown }: ArticleViewerProps) {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ node, ...props }) => (
            <img 
              {...props} 
              className="rounded-lg shadow-md"
              loading="lazy"
            />
          ),
          code: ({ node, inline, ...props }) => (
            inline ? (
              <code className="bg-gray-100 px-1 rounded" {...props} />
            ) : (
              <code className="block bg-gray-100 p-4 rounded" {...props} />
            )
          )
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
```

## Testing Integration

### Test Article Generation

```typescript
// Test in your development environment
const testSessionId = 'your-completed-session-id'

const response = await fetch(
  'http://localhost:54321/functions/v1/article-generator',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId: testSessionId })
  }
)

const result = await response.json()
console.log(result)
```

## Error Handling

```typescript
try {
  const response = await fetch(articleGeneratorUrl, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ sessionId })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate article')
  }
  
  const { article } = await response.json()
  return article
  
} catch (error) {
  console.error('Article generation failed:', error)
  
  // Optionally retry or queue for later
  await queueArticleGeneration(sessionId)
  
  // Show user-friendly message
  toast.error('Article generation in progress. Check back soon!')
}
```

## Performance Considerations

1. **Async Generation**: Consider generating articles asynchronously after lesson completion
2. **Caching**: Cache article markdown in the database for quick retrieval
3. **Lazy Loading**: Load article content only when user navigates to the article page
4. **Image Optimization**: Use Next.js Image component for media assets
5. **Pagination**: Paginate lesson history for users with many completed lessons

## Security

1. **RLS Policies**: Ensure Row Level Security policies are enabled on `lesson_articles` table
2. **User Verification**: Always verify user owns the session before generating article
3. **Storage Permissions**: Configure storage bucket permissions appropriately
4. **API Keys**: Never expose service role keys to the frontend

## Next Steps

1. Implement lesson history page UI
2. Create article viewer with markdown rendering
3. Add PDF export functionality
4. Implement article sharing features
5. Add search and filtering capabilities
6. Create article analytics (views, time spent reading)
