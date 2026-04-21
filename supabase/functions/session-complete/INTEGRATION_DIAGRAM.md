# Session Complete Integration Diagram

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SESSION COMPLETION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────┐
│  Client  │
│ (Frontend)│
└────┬─────┘
     │
     │ POST /session-complete
     │ { sessionId: "uuid" }
     │
     ▼
┌─────────────────────┐
│ Session Complete    │
│  Edge Function      │
└──────┬──────────────┘
       │
       │ 1. Verify Auth & Ownership
       │
       ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ (lesson_sessions)   │
└──────┬──────────────┘
       │
       │ 2. Check session status
       │
       ▼
┌─────────────────────┐
│ Session Summarizer  │
│   Edge Function     │
└──────┬──────────────┘
       │
       │ 3. Generate summary
       │    - Analyze lesson plan
       │    - Review all turns
       │    - Assess performance
       │
       ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ UPDATE session:     │
│ - status: completed │
│ - summary_json      │
│ - completed_at      │
└──────┬──────────────┘
       │
       │ 4. Session marked complete
       │
       ▼
┌─────────────────────┐
│ Article Generator   │
│   Edge Function     │
└──────┬──────────────┘
       │
       │ 5. Fetch lesson data
       │    ├─ Lesson plan
       │    ├─ All turns
       │    ├─ Media assets
       │    └─ Summary
       │
       ▼
┌─────────────────────┐
│   AI Service        │
│ (GPT-4o-mini or     │
│  Claude 3.5 Haiku)  │
└──────┬──────────────┘
       │
       │ 6. Generate markdown
       │    - Structured sections
       │    - Embedded media
       │    - LaTeX formulas
       │
       ▼
┌─────────────────────┐
│ Supabase Storage    │
│ (lesson-articles)   │
│ user-id/session-id/ │
│   article.md        │
└──────┬──────────────┘
       │
       │ 7. Store article file
       │
       ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ INSERT INTO         │
│ lesson_articles:    │
│ - title             │
│ - article_markdown  │
│ - storage_path      │
│ - metadata_json     │
└──────┬──────────────┘
       │
       │ 8. Persist metadata
       │
       ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ UPDATE session:     │
│ - article_path      │
│ - article_generated │
└──────┬──────────────┘
       │
       │ 9. Link article to session
       │
       ▼
┌─────────────────────┐
│ Session Complete    │
│  Edge Function      │
└──────┬──────────────┘
       │
       │ 10. Return response
       │
       ▼
┌──────────┐
│  Client  │ ◄─── {
│ (Frontend)│       success: true,
└──────────┘       session: {...},
                   summary: {...},
                   article: {
                     id: "uuid",
                     title: "...",
                     storagePath: "...",
                     metadata: {...}
                   }
                 }
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING PATHS                             │
└─────────────────────────────────────────────────────────────────────────┘

Session Complete
       │
       ├─ Auth Failed ──────────► 401 Unauthorized
       │
       ├─ Session Not Found ────► 404 Not Found
       │
       ├─ Not Owner ────────────► 403 Forbidden
       │
       ├─ Already Completed ────► 400 Bad Request
       │
       ├─ Summarizer Failed ────► 500 Internal Error
       │                           (Session NOT completed)
       │
       └─ Article Gen Failed ───► 200 Success
                                   (Session completed)
                                   article: null
                                   warning: "Article generation failed"
```

## Data Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARTICLE GENERATOR DATA INPUTS                         │
└─────────────────────────────────────────────────────────────────────────┘

Article Generator receives sessionId and fetches:

┌─────────────────────┐
│  lesson_sessions    │
│  ┌───────────────┐  │
│  │ lesson_plan   │──┼──► Milestones, concepts, objectives
│  │ summary_json  │──┼──► Performance, takeaways, insights
│  │ completed_at  │──┼──► Timestamp for article title
│  └───────────────┘  │
└─────────────────────┘

┌─────────────────────┐
│   lesson_turns      │
│  ┌───────────────┐  │
│  │ teacher_resp  │──┼──► Teaching moments, explanations
│  │ learner_input │──┼──► Questions, responses
│  └───────────────┘  │
└─────────────────────┘

┌─────────────────────┐
│ lesson_media_assets │
│  ┌───────────────┐  │
│  │ storage_path  │──┼──► Image URLs for embedding
│  │ metadata_json │──┼──► Descriptions, context
│  └───────────────┘  │
└─────────────────────┘

         │
         │ All data combined
         ▼

┌─────────────────────┐
│   AI Prompt         │
│  ┌───────────────┐  │
│  │ System: Guide │  │
│  │ User: Context │  │
│  └───────────────┘  │
└─────────────────────┘

         │
         ▼

┌─────────────────────┐
│ Generated Article   │
│  ┌───────────────┐  │
│  │ # Title       │  │
│  │ ## Intro      │  │
│  │ ## Milestone1 │  │
│  │ ![image](...) │  │
│  │ $formula$     │  │
│  │ ## Summary    │  │
│  └───────────────┘  │
└─────────────────────┘
```

## Response Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUCCESS RESPONSE                                 │
└─────────────────────────────────────────────────────────────────────────┘

{
  success: true,
  
  session: {
    id: "session-uuid",
    status: "completed",
    summary_json: { ... },
    article_path: "user-id/session-id/article.md",  ◄─ NEW
    article_generated_at: "2024-01-15T10:30:00Z",   ◄─ NEW
    completed_at: "2024-01-15T10:30:00Z"
  },
  
  summary: {
    sessionId: "session-uuid",
    topic: "Photosynthesis",
    milestonesOverview: { ... },
    learnerPerformance: { ... },
    keyTakeaways: [ ... ]
  },
  
  article: {                                         ◄─ NEW
    id: "article-uuid",
    title: "Photosynthesis - How Plants Make Food - January 15, 2024",
    storagePath: "user-id/session-id/article.md",
    metadata: {
      topic: "Photosynthesis",
      duration: 30,
      milestonesTotal: 3,
      milestonesCompleted: 3,
      difficulty: "beginner",
      mediaCount: 2
    }
  },
  
  message: "Lesson completed successfully"
}
```

## Database Schema Updates

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATABASE RELATIONSHIPS                              │
└─────────────────────────────────────────────────────────────────────────┘

lesson_sessions
├─ id (PK)
├─ user_id (FK → auth.users)
├─ status: "completed"
├─ summary_json: { ... }
├─ article_path: "user-id/session-id/article.md"  ◄─ Links to storage
├─ article_generated_at: timestamp
└─ completed_at: timestamp

         │
         │ 1:1 relationship
         ▼

lesson_articles
├─ id (PK)
├─ session_id (FK → lesson_sessions)  ◄─ Links back to session
├─ user_id (FK → auth.users)
├─ title: "Topic - Concept - Date"
├─ article_markdown: "# Full markdown content..."
├─ article_storage_path: "user-id/session-id/article.md"
└─ metadata_json: { topic, duration, milestones, ... }

         │
         │ References
         ▼

Supabase Storage
bucket: lesson-articles
path: user-id/session-id/article.md
content: Markdown file with embedded media URLs
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION TOUCHPOINTS                             │
└─────────────────────────────────────────────────────────────────────────┘

Frontend Integration:
├─ Call POST /session-complete
├─ Receive article data in response
├─ Display article link/preview
└─ Navigate to article viewer

Backend Integration:
├─ Session Complete invokes Article Generator
├─ Article Generator fetches from DB
├─ Article Generator uploads to Storage
└─ Article Generator updates DB

Storage Integration:
├─ Create lesson-articles bucket
├─ Store markdown files
└─ Serve via public URLs

Database Integration:
├─ lesson_sessions.article_path
├─ lesson_sessions.article_generated_at
└─ lesson_articles table (full record)
```
