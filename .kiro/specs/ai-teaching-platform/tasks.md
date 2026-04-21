# Implementation Plan: AI Teaching Platform

## Overview

This implementation plan breaks down the AI Teaching Platform into discrete coding tasks following the backend-authoritative architecture. The platform uses Next.js with TypeScript for the frontend, Supabase for backend services (Edge Functions, PostgreSQL, Storage), and integrates multiple AI agents for lesson planning, media preparation, vision interpretation, teaching orchestration, progress tracking, and session summarization.

Implementation follows a bottom-up approach: infrastructure and data layer first, then backend API endpoints and AI agent integrations, followed by frontend components and multimodal interactions, and finally end-to-end integration and testing.

## Tasks

- [x] 1. Project setup and infrastructure configuration
  - Initialize Next.js project with TypeScript, App Router, Tailwind CSS
  - Configure Supabase client and environment variables
  - Set up project directory structure (app/, components/, lib/, types/)
  - Install dependencies: Konva for canvas, ElevenLabs SDK, Supabase client, react-markdown, KaTeX
  - Configure ElevenLabs API keys and voice settings
  - _Requirements: 10.1, 10.2_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create database schema for core tables
    - Create `lesson_sessions` table (id, user_id, topic_prompt, status, lesson_plan_json, media_manifest_json, current_milestone_id, summary_json, created_at, updated_at)
    - Create `lesson_turns` table (id, session_id, turn_number, raw_input_json, interpreted_input_json, teacher_response_json, created_at)
    - Create `lesson_milestone_progress` table (id, session_id, milestone_id, milestone_data_json, status, completed_at)
    - Create `lesson_media_assets` table (id, session_id, asset_type, storage_path, metadata_json, created_at)
    - Create `canvas_snapshots` table (id, session_id, turn_id, storage_path, interpreted_marking_json, created_at)
    - _Requirements: 1.1, 1.3, 2.4, 4.8, 5.1, 5.7, 10.3_
  
  - [x] 2.2 Create database indexes and constraints
    - Add foreign key constraints (session_id references, user_id references)
    - Create indexes on session_id, user_id, status, created_at
    - Add check constraints for status enums (planning, ready, active, completed)
    - _Requirements: 10.2, 10.3_
  
  - [x] 2.3 Set up Supabase Storage buckets
    - Create `media-assets` bucket for lesson images and diagrams
    - Create `canvas-snapshots` bucket for learner drawings and annotations
    - Configure bucket policies for authenticated access
    - _Requirements: 2.2, 2.3, 4.5, 10.4_

- [x] 3. TypeScript types and interfaces
  - [x] 3.1 Define core domain types
    - Create types for LessonPlan, Milestone, Concept, MediaManifest, MediaAsset
    - Create types for LearnerInput, TeacherResponse, TeachingAction
    - Create types for CanvasSnapshot, InterpretedMarking
    - Create types for SessionStatus, MilestoneStatus, InputMode
    - _Requirements: 1.2, 1.5, 2.6, 4.7, 5.5_
  
  - [x] 3.2 Define database record types
    - Create types matching database tables (LessonSession, LessonTurn, MilestoneProgress, MediaAssetRecord, CanvasSnapshotRecord)
    - Create Supabase client types with type-safe queries
    - _Requirements: 10.3_

- [x] 4. Authentication and user management
  - [x] 4.1 Implement Supabase Auth integration
    - Set up Supabase Auth provider configuration
    - Create authentication middleware for API routes
    - Implement user session management
    - _Requirements: 9.1, 9.2_
  
  - [x] 4.2 Create authentication UI components
    - Build login/signup forms with Supabase Auth UI
    - Implement protected route wrapper component
    - Add user profile display component
    - _Requirements: 9.1_
  
  - [x] 4.3 Write unit tests for authentication
    - Test authentication middleware
    - Test protected route access control
    - _Requirements: 9.2, 9.3, 9.4_

- [x] 5. Checkpoint - Ensure infrastructure is ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend: Lesson Planner agent integration
  - [x] 6.1 Create Lesson Planner Edge Function
    - Implement `/api/agents/lesson-planner` Edge Function
    - Integrate with AI service API (GPT-4o-mini or Claude 3.5 Haiku) for lesson plan generation
    - Parse and validate lesson plan JSON structure
    - Handle errors and retries with exponential backoff
    - Use temperature 0.3 for consistent planning
    - _Requirements: 1.2, 1.3, 1.5, 11.1_
  
  - [x] 6.2 Write unit tests for Lesson Planner
    - Test lesson plan JSON validation
    - Test error handling and retry logic
    - Mock AI service responses
    - _Requirements: 1.2, 1.5, 11.1_

- [x] 7. Backend: Media Planner and asset preparation agents
  - [x] 7.1 Create Media Planner Edge Function
    - Implement `/api/agents/media-planner` Edge Function
    - Analyze lesson plan and generate media manifest
    - Determine media types needed (images, diagrams, charts)
    - _Requirements: 1.4, 2.1, 2.6_
  
  - [x] 7.2 Create Media Fetcher Edge Function
    - Implement `/api/agents/media-fetcher` Edge Function
    - Integrate with media search API (Unsplash, Pexels, or similar)
    - Download and upload media to Supabase Storage
    - Return media asset metadata
    - _Requirements: 2.2, 10.4_
  
  - [x] 7.3 Create Image Generator Edge Function
    - Implement `/api/agents/image-generator` Edge Function
    - Integrate with image generation API (DALL-E, Stable Diffusion, or similar)
    - Generate images based on media manifest specifications
    - Upload generated images to Supabase Storage
    - _Requirements: 2.3, 10.4_
  
  - [x] 7.4 Write unit tests for media agents
    - Test media manifest generation
    - Test media fetching and storage upload
    - Test image generation and storage upload
    - Mock external API calls
    - _Requirements: 2.1, 2.2, 2.3, 11.2_

- [x] 8. Backend: Session creation API endpoint
  - [x] 8.1 Implement session creation endpoint
    - Create `/api/lesson/session/create` Edge Function
    - Validate authentication and topic prompt
    - Create session record with status "planning"
    - Invoke Lesson Planner agent
    - Store lesson plan JSON in session
    - Invoke Media Planner agent
    - Process media manifest (fetch or generate assets)
    - Insert lesson_media_assets records
    - Update session status to "ready"
    - Return session data to frontend
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 9.2, 9.3, 10.2_
  
  - [x] 8.2 Write integration tests for session creation
    - Test end-to-end session creation flow
    - Test error handling for AI agent failures
    - Test media preparation with mocked external services
    - _Requirements: 1.1, 1.2, 1.3, 2.5, 11.1, 11.2_

- [x] 9. Backend: Vision Interpreter agent integration
  - [x] 9.1 Create Vision Interpreter Edge Function
    - Implement `/api/agents/vision-interpreter` Edge Function
    - Integrate with vision AI API (GPT-4o-mini with vision or Claude 3.5 Haiku with vision)
    - Analyze canvas snapshots and image annotations
    - Extract interpreted marking JSON (shapes, text, concepts identified)
    - Use temperature 0.3 for deterministic interpretation
    - _Requirements: 4.6, 4.7_
  
  - [x] 9.2 Create canvas analysis endpoint
    - Implement `/api/lesson/canvas/analyze` Edge Function
    - Receive canvas snapshot upload from frontend
    - Store snapshot in Supabase Storage
    - Invoke Vision Interpreter agent
    - Insert canvas_snapshots record with interpreted marking JSON
    - Return interpreted marking to frontend
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 10.4_
  
  - [x] 9.3 Write unit tests for Vision Interpreter
    - Test vision analysis with sample images
    - Test interpreted marking JSON structure
    - Mock vision AI API responses
    - _Requirements: 4.7_

- [x] 10. Backend: Progress Tracker agent integration
  - [x] 10.1 Create Progress Tracker Edge Function
    - Implement `/api/agents/progress-tracker` Edge Function
    - Assess learner understanding against milestone criteria
    - Analyze turn history and learner responses
    - Return progress status for all milestones
    - Determine milestone completion
    - _Requirements: 5.3, 5.4, 7.2, 7.3_
  
  - [x] 10.2 Write unit tests for Progress Tracker
    - Test milestone progress assessment logic
    - Test completion detection
    - Mock turn history and learner responses
    - _Requirements: 5.4, 7.2, 7.3, 7.5_

- [x] 11. Backend: Teacher Conductor agent integration
  - [x] 11.1 Create Teacher Conductor Edge Function
    - Implement `/api/agents/teacher-conductor` Edge Function
    - Integrate with AI service API (GPT-4o-mini or Claude 3.5 Haiku)
    - Process teaching turn with full context (lesson plan, current milestone, prior turns, interpreted markings)
    - Invoke Progress Tracker to assess milestone progress
    - Generate teacher response JSON with teaching actions and voice text
    - Determine if lesson should complete (all milestones covered)
    - Use temperature 0.7 for natural teaching responses
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.4, 8.1, 12.4_
  
  - [x] 11.2 Write unit tests for Teacher Conductor
    - Test turn processing with various input types
    - Test teaching response generation
    - Test lesson completion detection
    - Mock Progress Tracker responses
    - _Requirements: 5.2, 5.5, 8.1_

- [x] 12. Backend: Teaching turn response endpoint
  - [x] 12.1 Implement turn response endpoint
    - Create `/api/lesson/turn/respond` Edge Function
    - Validate authentication and session ownership
    - Insert lesson_turns record with raw input JSON
    - Invoke Teacher Conductor agent
    - Update lesson_turns record with interpreted input and teacher response
    - Update lesson_milestone_progress records
    - Update session current_milestone_id if milestone changed
    - Return teacher response to frontend
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 9.4, 10.2_
  
  - [x] 12.2 Write integration tests for turn response
    - Test end-to-end turn processing flow
    - Test voice, text, canvas, and image annotation inputs
    - Test milestone progress updates
    - Test error handling and retries
    - _Requirements: 5.1, 5.6, 5.7, 11.1, 11.3_

- [x] 13. Backend: Session Summarizer agent integration
  - [x] 13.1 Create Session Summarizer Edge Function
    - Implement `/api/agents/session-summarizer` Edge Function
    - Analyze lesson plan, all turns, milestone progress, learner performance
    - Generate comprehensive lesson summary JSON
    - _Requirements: 8.4_
  
  - [x] 13.2 Write unit tests for Session Summarizer
    - Test summary generation with sample session data
    - Test summary JSON structure
    - Mock AI service responses
    - _Requirements: 8.4_

- [x] 14. Backend: Lesson completion endpoint
  - [x] 14.1 Implement lesson completion endpoint
    - Create `/api/lesson/session/complete` Edge Function
    - Validate authentication and session ownership
    - Invoke Session Summarizer agent
    - Update session status to "completed"
    - Store summary JSON in session record
    - Return completion response with summary
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.4, 10.2_
  
  - [x] 14.2 Write integration tests for lesson completion
    - Test natural completion (all milestones covered)
    - Test explicit completion (user button click)
    - Test summary generation and storage
    - _Requirements: 8.1, 8.4, 8.5, 8.6_

- [x] 15. Checkpoint - Ensure backend APIs are functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Frontend: Core UI components and layout
  - [x] 16.1 Create main layout and navigation
    - Build app layout with header, navigation, and content area
    - Implement responsive design with Tailwind CSS
    - Add user profile menu and logout functionality
    - _Requirements: 3.1, 9.1_
  
  - [x] 16.2 Create lesson start interface
    - Build topic prompt input form
    - Add loading state during lesson planning
    - Display planning progress indicators
    - _Requirements: 1.1, 3.1_
  
  - [x] 16.3 Create lesson board component
    - Build main teaching interface layout
    - Display current milestone and progress indicators
    - Render media assets in teaching context
    - Add end lesson button
    - _Requirements: 3.1, 3.2, 3.3, 8.2_

- [x] 17. Frontend: Canvas integration with Konva
  - [x] 17.1 Implement Konva canvas component
    - Create canvas component with Konva Stage and Layer
    - Implement drawing tools (pen, shapes, text)
    - Add color and stroke width controls
    - Implement undo/redo functionality
    - _Requirements: 4.3_
  
  - [x] 17.2 Implement canvas snapshot capture
    - Add snapshot capture function using Konva toDataURL
    - Convert canvas to image blob
    - Upload snapshot to Supabase Storage
    - Call canvas analysis API endpoint
    - _Requirements: 4.3, 4.5_
  
  - [x] 17.3 Implement image annotation mode
    - Load media assets onto canvas as background
    - Enable drawing/marking on top of images
    - Capture annotated image as snapshot
    - _Requirements: 4.4, 4.5_
  
  - [x] 17.4 Write unit tests for canvas components
    - Test drawing tool functionality
    - Test snapshot capture
    - Test image annotation mode
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 18. Frontend: Voice and audio integration with ElevenLabs
  - [x] 18.1 Implement ElevenLabs voice input capture
    - Install and configure ElevenLabs SDK
    - Implement ElevenLabs Scribe for real-time speech-to-text
    - Add microphone permission handling
    - Configure streaming transcription with automatic punctuation
    - Implement VAD for barge-in detection
    - _Requirements: 4.1, 12.2, 12.3, 12.6_
  
  - [x] 18.2 Implement ElevenLabs text-to-speech output
    - Configure ElevenLabs TTS API with Eleven Turbo v2.5 model
    - Implement voice selection and speech rate controls
    - Configure voice settings (stability: 0.5, similarity: 0.75, style: 0.0)
    - Synchronize speech with visual teaching actions
    - Add play/pause/stop controls
    - Implement audio streaming for low latency
    - _Requirements: 6.2, 12.1, 12.4, 12.5, 12.7_
  
  - [x] 18.3 Write unit tests for ElevenLabs audio components
    - Test voice input capture with Scribe
    - Test speech synthesis with TTS
    - Mock ElevenLabs SDK
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 19. Frontend: Input mode management
  - [x] 19.1 Create input mode selector component
    - Build UI for switching between voice, text, canvas, image annotation modes
    - Implement mode-specific input interfaces
    - Handle mode transitions and state management
    - _Requirements: 3.4, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 19.2 Create text input component
    - Build text input form with submit button
    - Add input validation
    - Handle text submission to turn response API
    - _Requirements: 4.2_
  
  - [x] 19.3 Implement voice termination phrase detection
    - Analyze transcribed voice input for lesson end phrases
    - Trigger lesson completion when detected
    - _Requirements: 8.3_

- [x] 20. Frontend: Teaching response rendering
  - [x] 20.1 Create teaching action renderer
    - Parse teacher response JSON
    - Render teaching actions (display media, highlight concepts, provide feedback)
    - Implement action sequencing and timing
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 20.2 Integrate voice output with visual actions
    - Synchronize speech synthesis with teaching action rendering
    - Implement visual highlighting during speech
    - Add animation and transitions for teaching actions
    - _Requirements: 6.2, 6.3_
  
  - [x] 20.3 Write unit tests for teaching response rendering
    - Test action parsing and rendering
    - Test synchronization with voice output
    - Mock teacher response data
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 21. Frontend: Progress tracking UI
  - [x] 21.1 Create milestone progress display
    - Build progress indicator component showing all milestones
    - Highlight current milestone
    - Show completion status for each milestone
    - Update progress in real-time after each turn
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 21.2 Write unit tests for progress display
    - Test progress indicator rendering
    - Test milestone status updates
    - Mock progress data
    - _Requirements: 7.1, 7.5_

- [x] 22. Frontend: Lesson summary display
  - [x] 22.1 Create lesson summary component
    - Build summary display with lesson overview
    - Show milestone completion status
    - Display learner performance insights
    - Add option to start new lesson
    - _Requirements: 8.6_
  
  - [x] 22.2 Write unit tests for summary display
    - Test summary rendering
    - Test summary data parsing
    - Mock summary JSON
    - _Requirements: 8.6_

- [x] 23. Frontend: State management and API integration
  - [x] 23.1 Implement session state management
    - Create React context or state management for session data
    - Implement API client functions for all backend endpoints
    - Handle loading states and error states
    - Synchronize frontend state with backend after each turn
    - _Requirements: 10.5, 11.3_
  
  - [x] 23.2 Implement error handling and retry logic
    - Display user-friendly error messages
    - Implement retry functionality for failed requests
    - Handle network errors and timeouts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [x] 23.3 Write integration tests for state management
    - Test session state updates
    - Test API error handling
    - Test retry logic
    - _Requirements: 10.5, 11.3_

- [x] 24. Checkpoint - Ensure frontend components are functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 25. End-to-end integration and testing
  - [x] 25.1 Implement complete lesson flow
    - Wire together session creation, teaching turns, and lesson completion
    - Test full user journey from topic prompt to lesson summary
    - Verify all input modes work correctly (voice, text, canvas, image annotation)
    - _Requirements: 1.1, 3.1, 4.1, 4.2, 4.3, 4.4, 5.1, 6.1, 8.1_
  
  - [x] 25.2 Test multimodal interactions
    - Test voice input with teaching response
    - Test text input with teaching response
    - Test canvas drawing with vision interpretation
    - Test image annotation with vision interpretation
    - Verify teaching actions render correctly for all input types
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 6.1, 6.2_
  
  - [x] 25.3 Test progress tracking and milestone advancement
    - Verify milestone progress updates after each turn
    - Test milestone completion detection
    - Test advancement to next milestone
    - Verify lesson completion when all milestones covered
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1_
  
  - [x] 25.4 Test lesson completion scenarios
    - Test natural completion (all milestones covered)
    - Test explicit completion via button click
    - Test voice termination phrase detection
    - Verify summary generation and display
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 25.5 Write end-to-end integration tests
    - Test complete lesson flow with mocked AI services
    - Test error recovery scenarios
    - Test authentication and authorization
    - _Requirements: 9.2, 9.3, 9.4, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 26. Performance optimization and polish
  - [x] 26.1 Optimize media loading and caching
    - Implement lazy loading for media assets
    - Add caching strategy for frequently used assets
    - Optimize image sizes and formats
    - _Requirements: 2.2, 2.3, 10.4_
  
  - [x] 26.2 Optimize audio performance
    - Reduce latency for voice input capture
    - Optimize speech synthesis performance
    - Implement audio buffering for smooth playback
    - _Requirements: 12.1, 12.2_
  
  - [x] 26.3 Add loading states and animations
    - Implement skeleton loaders for async operations
    - Add smooth transitions between teaching turns
    - Polish UI animations and interactions
    - _Requirements: 3.1, 6.1_

- [x] 27. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Implementation uses TypeScript throughout for type safety
- Backend-authoritative architecture ensures consistent state management
- AI agent integrations should include error handling and retry logic
- All media assets and canvas snapshots stored in Supabase Storage
- Frontend synchronizes state with backend after each teaching turn


- [x] 28. Backend: Article Generator agent integration
  - [x] 28.1 Create Article Generator Edge Function
    - Implement `/api/agents/article-generator` Edge Function
    - Integrate with AI service API (GPT-4o-mini or Claude 3.5 Haiku) for article generation
    - Synthesize lesson plan, turns, and media into structured markdown
    - Generate descriptive title following pattern "[Topic] - [Key Concept] - [Date]"
    - Embed media assets at appropriate positions using markdown image syntax
    - Include formulas and equations using LaTeX notation
    - Structure content with sections for each milestone
    - Use temperature 0.3 for consistent article generation
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [x] 28.2 Write unit tests for Article Generator
    - Test article markdown generation
    - Test title generation
    - Test media embedding
    - Test formula formatting
    - Mock AI service responses
    - _Requirements: 13.1, 13.4_

- [x] 29. Backend: Article storage and persistence
  - [x] 29.1 Create lesson_articles database table
    - Create table with id, session_id, user_id, title, article_markdown, article_storage_path, metadata_json, created_at, updated_at
    - Add foreign key constraints to lesson_sessions and auth.users
    - Create indexes on session_id, user_id, created_at
    - _Requirements: 13.6, 13.7_
  
  - [x] 29.2 Update lesson_sessions table schema
    - Add article_path column (text, nullable)
    - Add article_generated_at column (timestamp, nullable)
    - _Requirements: 13.7_
  
  - [x] 29.3 Create lesson-articles storage bucket
    - Create Supabase Storage bucket for article markdown files
    - Configure bucket policies for authenticated user access
    - Set up path structure: {user_id}/{session_id}/article.md
    - _Requirements: 13.5_
  
  - [x] 29.4 Implement article storage logic
    - Store generated markdown file in Supabase Storage
    - Insert lesson_articles record with article data
    - Update lesson_sessions with article_path and timestamp
    - Handle storage errors and retries
    - _Requirements: 13.5, 13.6, 13.7_
  
  - [x] 29.5 Write integration tests for article storage
    - Test article file upload to storage
    - Test lesson_articles record insertion
    - Test lesson_sessions update
    - Test error handling
    - _Requirements: 13.5, 13.6, 13.7_

- [x] 30. Backend: Update lesson completion endpoint for article generation
  - [x] 30.1 Integrate Article Generator into completion flow
    - After Session Summarizer completes, invoke Article Generator
    - Pass lesson plan, turns, media assets, and summary to Article Generator
    - Store generated article in storage
    - Persist article metadata to database
    - Return article data in completion response
    - _Requirements: 13.1, 13.5, 13.6, 13.7_
  
  - [x] 30.2 Write integration tests for article generation in completion flow
    - Test end-to-end article generation on lesson completion
    - Test article data in completion response
    - Verify article storage and database persistence
    - _Requirements: 13.1, 13.5, 13.6, 13.7_

- [x] 31. Frontend: Lesson history page
  - [x] 31.1 Create lesson history page component
    - Build `/lessons/history` page with App Router
    - Fetch all completed lessons for authenticated user
    - Display list with titles, dates, and thumbnail previews
    - Show quick stats: duration, milestones covered, completion percentage
    - Implement responsive grid layout with Tailwind CSS
    - _Requirements: 13.8_
  
  - [x] 31.2 Implement search and filter functionality
    - Add search input for filtering by topic
    - Add date range filter controls
    - Implement client-side or server-side filtering
    - Update URL query parameters for shareable filtered views
    - _Requirements: 13.10_
  
  - [x] 31.3 Create lesson history API endpoint
    - Implement `/api/lesson/history` Edge Function
    - Query lesson_articles table for user's completed lessons
    - Return list with titles, dates, metadata, and first image URL
    - Support pagination for large lesson histories
    - _Requirements: 13.8_
  
  - [x] 31.4 Write unit tests for lesson history page
    - Test lesson list rendering
    - Test search and filter functionality
    - Test pagination
    - Mock API responses
    - _Requirements: 13.8, 13.10_

- [x] 32. Frontend: Article viewer page
  - [x] 32.1 Create article viewer page component
    - Build `/lessons/article/[id]` page with App Router
    - Fetch article data by lesson article ID
    - Render markdown content with proper formatting
    - Display embedded images from storage URLs
    - Render LaTeX formulas using math rendering library (KaTeX or MathJax)
    - _Requirements: 13.9_
  
  - [x] 32.2 Implement metadata sidebar
    - Display topic, date, duration, milestones covered
    - Show lesson completion stats
    - Add navigation back to lesson history
    - _Requirements: 13.12_
  
  - [x] 32.3 Add download and share functionality
    - Implement "Download as PDF" button using PDF generation library
    - Implement "Share Link" button with copy-to-clipboard
    - Generate shareable URL for article
    - _Requirements: 13.11_
  
  - [x] 32.4 Create article fetch API endpoint
    - Implement `/api/lesson/article/[id]` Edge Function
    - Fetch article markdown and metadata from database
    - Verify user ownership or sharing permissions
    - Return article data with storage URLs for media
    - _Requirements: 13.9_
  
  - [x] 32.5 Write unit tests for article viewer
    - Test markdown rendering
    - Test LaTeX formula rendering
    - Test image embedding
    - Test download and share functionality
    - Mock API responses
    - _Requirements: 13.9, 13.11, 13.12_

- [x] 33. Frontend: Markdown and LaTeX rendering
  - [x] 33.1 Integrate markdown rendering library
    - Install and configure markdown parser (e.g., react-markdown, marked)
    - Support GitHub Flavored Markdown (GFM)
    - Configure syntax highlighting for code blocks if needed
    - _Requirements: 13.9_
  
  - [x] 33.2 Integrate LaTeX rendering library
    - Install and configure math rendering library (KaTeX or MathJax)
    - Support inline math ($...$) and block math ($$...$$)
    - Configure rendering options for optimal display
    - _Requirements: 13.9_
  
  - [x] 33.3 Style article content
    - Create CSS styles for article typography
    - Style headings, paragraphs, lists, images
    - Ensure responsive layout for mobile and desktop
    - Add print-friendly styles for PDF generation
    - _Requirements: 13.9_
  
  - [x] 33.4 Write unit tests for rendering components
    - Test markdown parsing and rendering
    - Test LaTeX formula rendering
    - Test image embedding
    - _Requirements: 13.9_

- [x] 34. Checkpoint - Ensure lesson article feature is functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 35. Demo mode: Guest-first access and configurable OpenRouter provider
  - [x] 35.1 Remove sign-in requirement from the main teaching flow
    - Route landing page directly into lesson usage
    - Redirect `/login` back to home
    - Remove auth-based lesson route protection
    - _Implementation note: Guest mode now drives the active app flow_

  - [x] 35.2 Persist lesson sessions locally per browser
    - Add guest identity helper
    - Add local lesson storage for sessions, summaries, and articles
    - Make lesson history/article pages read guest-local data
    - _Implementation note: History now reflects this browser's saved lessons_

  - [x] 35.3 Switch AI provider wiring to OpenRouter
    - Add env-configurable OpenRouter helper and proxy route
    - Make model selection configurable via env
    - Keep provider secrets server-side only
    - _Implementation note: Requires `OPENROUTER_API_KEY`; `OPENROUTER_MODEL` optional_

  - [x] 35.4 Make voice optional for guest mode
    - Remove auth checks from ElevenLabs routes
    - Expose runtime voice capability flag
    - Hide voice mode when ElevenLabs env is absent
    - _Implementation note: `ELEVENLABS_API_KEY` is optional_

- [x] 36. Demo mode: zo-style tutor runtime rewrite
  - [x] 36.1 Rebuild the lesson shell around a single immersive tutor surface
    - Replace the fragmented lesson board layout with a central stage, teacher panel, progress rail, and floating voice dock
    - Keep guest-local persistence while shifting the UX toward the original voice-first teaching vision
    - _Implementation note: `LessonContainer` now renders a zo-inspired tutor shell instead of the older board/input stack_

  - [x] 36.2 Implement browser VAD + AssemblyAI learner speech flow
    - Replace ElevenLabs Scribe-based learner STT with browser VAD (`@ricky0123/vad-react`) plus AssemblyAI transcription
    - Preserve teacher TTS through ElevenLabs and set the default teacher voice to `hpp4J3VqNfWAUOO0d1Us`
    - Interrupt teacher playback when the learner begins speaking
    - _Implementation note: requires `ASSEMBLYAI_API_KEY`; `ELEVENLABS_API_KEY` remains optional for teacher speech_

  - [x] 36.3 Bundle learner speech with latest canvas context
    - Keep the latest canvas snapshot and interpreted markings ready for the next learner speech/text turn
    - Submit multimodal learner turns that include transcript plus latest canvas context when available
    - _Implementation note: learner turns now carry transcript + snapshot context into the same tutor response cycle_

  - [x] 36.4 Add live media search and image understanding for lesson visuals
    - Search Google Images through Serper before or during lesson preparation when visuals are needed
    - Score candidate images for teachability and clutter
    - Describe selected images with `google/gemini-2.5-flash-lite` through OpenRouter so the tutor knows what is visible
    - _Implementation note: requires `SERPER_API_KEY`; image understanding uses `OPENROUTER_IMAGE_MODEL` with Gemini Flash Lite default_

  - [x] 36.5 Align runtime model configuration with the demo stack
    - Use `moonshotai/kimi-k2.5:nitro` as the main tutor model through OpenRouter
    - Surface runtime capability flags for STT, TTS, and image search
    - _Implementation note: main tutor model is now documented directly in the lesson shell and env config path_
