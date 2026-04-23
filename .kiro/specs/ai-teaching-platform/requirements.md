# Requirements Document: AI Teaching Platform

## Introduction

The AI Teaching Platform is a voice-first, agentic web application that provides interactive, personalized teaching experiences for any topic. The system employs a plan-first architecture where lesson planning occurs before teaching begins, enabling structured, goal-oriented instruction with multimodal interactions including voice, text, canvas drawing, and image annotation.

## Glossary

- **System**: The AI Teaching Platform as a whole
- **Frontend**: The Next.js/React client application
- **Backend**: The Supabase-based server infrastructure (Edge Functions, PostgreSQL, Storage)
- **Lesson_Planner**: AI agent responsible for generating structured lesson plans
- **Media_Planner**: AI agent that determines media needs for lessons
- **Media_Fetcher**: AI agent that retrieves existing media assets
- **Image_Generator**: AI agent that creates new visual media
- **Vision_Interpreter**: AI agent that analyzes canvas drawings and image annotations
- **Teacher_Conductor**: AI agent that orchestrates teaching interactions
- **Progress_Tracker**: AI agent that monitors milestone completion
- **Session_Summarizer**: AI agent that generates lesson summaries
- **Learner**: The user receiving instruction
- **Session**: A single teaching interaction from start to completion
- **Milestone**: A learning goal within a lesson plan
- **Turn**: A single interaction cycle (learner input + teacher response)
- **Canvas_Snapshot**: A captured image of learner canvas drawings or annotations
- **Media_Asset**: An image, diagram, or visual resource used in teaching

## Requirements

### Requirement 1: Session Creation and Lesson Planning

**User Story:** As a learner, I want to start a lesson on any topic, so that I can receive structured, personalized instruction.

#### Acceptance Criteria

1. WHEN a learner submits a topic prompt, THE Backend SHALL create a session record with status "planning"
2. WHEN a session is created, THE Lesson_Planner SHALL generate a lesson plan containing milestones and key concepts
3. WHEN the lesson plan is generated, THE Backend SHALL store the lesson plan as structured JSON in the session record
4. WHEN lesson planning completes, THE Media_Planner SHALL analyze the lesson plan and produce a media manifest identifying required visual assets
5. THE lesson plan JSON SHALL include at least one milestone with associated learning objectives

### Requirement 2: Media Asset Preparation

**User Story:** As a learner, I want visual aids prepared before teaching begins, so that I can better understand concepts through multimodal presentation.

#### Acceptance Criteria

1. WHEN the media manifest is generated, THE System SHALL process each media item before teaching begins
2. WHERE existing media is available, THE Media_Fetcher SHALL retrieve candidate assets through an image search provider before teaching begins
3. THE System SHALL evaluate candidate images for clarity, teachability, and clutter before selecting lesson visuals
4. WHEN an image is selected, THE System SHALL generate a structured image description so the tutor can reference visible regions and labels accurately
5. WHERE existing media is not sufficient, THE Image_Generator SHALL create a new visual asset
6. WHEN a media asset is obtained, THE Backend SHALL insert a lesson_media_assets record linking the asset to the session
7. WHEN all media assets are prepared, THE Backend SHALL update the session status to "ready"
8. THE System SHALL store media manifest as structured JSON in the session record

### Requirement 3: Session Readiness and Teaching Initiation

**User Story:** As a learner, I want to begin interactive teaching once preparation is complete, so that I can start learning without delays.

#### Acceptance Criteria

1. WHEN the session status becomes "ready", THE Frontend SHALL display the lesson board interface
2. WHEN the lesson board is displayed, THE System SHALL present the first teaching turn to the learner
3. THE lesson board SHALL include prepared media assets relevant to the current teaching context
4. THE System SHALL enable voice, text, canvas, and image annotation input modes

### Requirement 4: Multimodal Learner Input Processing

**User Story:** As a learner, I want to respond using voice, text, drawing, or image marking, so that I can express my understanding in the most natural way.

#### Acceptance Criteria

1. WHEN a learner provides voice input, THE Frontend SHALL detect turn boundaries using browser voice activity detection before sending audio for transcription
2. WHEN a learner provides text input, THE Frontend SHALL send the text to the Backend
3. WHEN a learner draws on the canvas, THE Frontend SHALL capture a canvas snapshot as an image
4. WHEN a learner annotates an image, THE Frontend SHALL capture the annotated image as a snapshot
5. WHEN a learner finishes speaking, THE System SHALL transcribe the audio through a speech-to-text service before passing the learner turn to the tutor runtime
6. WHEN a canvas snapshot is captured, THE Frontend SHALL keep the latest snapshot available for the next learner speech or text turn
7. WHEN a canvas snapshot is uploaded or submitted, THE Backend SHALL invoke the Vision_Interpreter to analyze the snapshot
8. WHEN the Vision_Interpreter analyzes a snapshot, THE System SHALL produce interpreted marking JSON describing the learner's visual input
9. WHEN a snapshot is analyzed, THE Backend SHALL insert a canvas_snapshots record

### Requirement 5: Teaching Turn Orchestration

**User Story:** As a learner, I want the system to understand my responses and provide appropriate teaching feedback, so that I can progress toward learning goals.

#### Acceptance Criteria

1. WHEN a learner submits a response, THE Backend SHALL insert a lesson_turns record containing the raw input
2. WHEN a turn is recorded, THE Teacher_Conductor SHALL process the turn with full context including lesson plan, current milestone, prior turns, and interpreted markings
3. THE Teacher_Conductor SHALL receive both learner transcript and latest interpreted canvas context when both are available in the same turn
4. WHEN processing a turn, THE Teacher_Conductor SHALL invoke the Progress_Tracker to assess milestone progress
5. WHEN the Progress_Tracker is invoked, THE System SHALL return the current progress status for all milestones
6. WHEN turn processing completes, THE Teacher_Conductor SHALL produce a teacher response JSON containing teaching actions and voice text
7. WHEN the teacher response is generated, THE Backend SHALL update the lesson_turns record with interpreted input and teacher response
8. WHEN milestone progress changes, THE Backend SHALL update the lesson_milestone_progress records
9. WHEN the current milestone changes, THE Backend SHALL update the session's current_milestone_id

### Requirement 6: Teaching Response Rendering

**User Story:** As a learner, I want to receive teaching feedback through voice and visual actions, so that I can understand the material effectively.

#### Acceptance Criteria

1. WHEN the Backend returns a teacher response, THE Frontend SHALL render all teaching actions specified in the response JSON
2. WHEN the teacher response includes voice text, THE Frontend SHALL synthesize and play the speech using Web Audio API
3. THE Frontend SHALL display visual teaching actions synchronously with voice output
4. THE teaching actions SHALL support displaying media assets, highlighting concepts, and providing feedback

### Requirement 7: Progress Tracking and Milestone Management

**User Story:** As a learner, I want the system to track my progress toward learning goals, so that I can see my advancement and stay motivated.

#### Acceptance Criteria

1. WHEN a session begins, THE System SHALL initialize progress records for all milestones in the lesson plan
2. WHILE teaching is active, THE Progress_Tracker SHALL continuously assess learner understanding against milestone criteria
3. WHEN a milestone is achieved, THE System SHALL mark the milestone as complete in lesson_milestone_progress
4. WHEN a milestone is completed, THE System SHALL advance to the next milestone in the lesson plan
5. THE System SHALL maintain progress state across all teaching turns within a session

### Requirement 8: Lesson Completion

**User Story:** As a learner, I want to complete lessons either naturally or explicitly using voice or UI controls, so that I can review what I learned and end the session appropriately.

#### Acceptance Criteria

1. WHEN all milestones are completed, THE Teacher_Conductor SHALL signal lesson completion
2. WHEN a learner clicks the end lesson button, THE Backend SHALL initiate lesson completion
3. WHEN a learner speaks a lesson termination phrase, THE System SHALL recognize the intent and initiate lesson completion
4. WHEN lesson completion is initiated, THE Session_Summarizer SHALL generate a summary with context including lesson plan, all turns, milestone progress, and learner performance
5. WHEN the summary is generated, THE Backend SHALL update the session status to "completed" and store the summary JSON
6. WHEN the session is completed, THE Frontend SHALL display the lesson summary to the learner

### Requirement 9: Authentication and User Management

**User Story:** As a learner, I want to securely access the platform, so that my learning progress and data are protected.

#### Acceptance Criteria

1. THE System SHALL authenticate learners using Supabase Auth
2. WHEN a learner accesses the platform, THE Backend SHALL verify authentication before allowing session creation
3. THE System SHALL associate all sessions with the authenticated learner's user ID
4. THE System SHALL restrict access to session data based on user ownership

### Requirement 10: Data Persistence and State Management

**User Story:** As a system operator, I want all teaching state stored reliably, so that sessions can be recovered and analyzed.

#### Acceptance Criteria

1. THE Backend SHALL maintain authoritative state for all teaching sessions
2. WHEN any state change occurs, THE Backend SHALL persist the change to the PostgreSQL database
3. THE System SHALL store all lesson plans, media manifests, turn data, and progress records as structured JSON
4. THE System SHALL store all media assets and canvas snapshots in Supabase Storage
5. THE Frontend SHALL synchronize its state with the Backend after each teaching turn

### Requirement 11: Error Handling and Recovery

**User Story:** As a learner, I want the system to handle errors gracefully, so that technical issues don't disrupt my learning experience.

#### Acceptance Criteria

1. WHEN an AI agent fails to respond, THE System SHALL retry the request with exponential backoff
2. WHEN media preparation fails, THE System SHALL continue with available media and log the failure
3. WHEN a teaching turn fails, THE Frontend SHALL display an error message and allow the learner to retry
4. WHEN storage operations fail, THE System SHALL queue the operation for retry
5. THE System SHALL log all errors with sufficient context for debugging

### Requirement 12: Voice Interaction Quality

**User Story:** As a learner, I want clear, natural voice interactions with automatic turn detection, so that the teaching experience feels conversational and engaging.

#### Acceptance Criteria

1. WHEN the Backend generates teacher speech, THE System SHALL use ElevenLabs TTS API with Eleven Flash v2.5 model for fast, natural voice output
2. THE System SHALL support learner speech transcription using ElevenLabs Scribe
3. WHEN voice input is processed, THE System SHALL transcribe speech to text through ElevenLabs Scribe before sending the turn to the tutor runtime
4. THE Teacher_Conductor SHALL generate voice text optimized for natural speech synthesis
5. THE System SHALL use browser-based voice activity detection for learner turn detection and barge-in behavior
6. THE Frontend SHALL stop or interrupt teacher playback when the learner begins speaking
7. THE System SHALL use ElevenLabs voice `hpp4J3VqNfWAUOO0d1Us` as the default teacher voice unless overridden by configuration



### Requirement 13: Lesson Article Generation and History

**User Story:** As a learner, I want my completed lessons saved as comprehensive articles with images and formulas, so that I can review what I learned and build a personal knowledge library.

#### Acceptance Criteria

1. WHEN a lesson is completed, THE Article_Generator SHALL synthesize the lesson into a structured markdown article
2. WHEN generating an article, THE Article_Generator SHALL include all media assets (images, diagrams, generated visuals) at appropriate positions in the content
3. WHEN generating an article, THE Article_Generator SHALL include formulas and equations using LaTeX/markdown math notation
4. WHEN generating an article, THE System SHALL create a descriptive title following the pattern "[Topic] - [Key Concept] - [Date]"
5. WHEN an article is generated, THE Backend SHALL store the markdown file in Supabase Storage at path `{user_id}/{session_id}/article.md`
6. WHEN an article is stored, THE Backend SHALL insert a lesson_articles record with title, article_markdown, storage_path, and metadata
7. WHEN an article is created, THE Backend SHALL update the lesson_sessions record with article_path and article_generated_at timestamp
8. WHEN a learner accesses the lesson history page, THE Frontend SHALL display a list of all completed lessons with titles, dates, and thumbnail previews
9. WHEN a learner clicks on a lesson in history, THE Frontend SHALL render the full article with proper markdown formatting, embedded images, and LaTeX formulas
10. THE lesson history page SHALL support search and filtering by topic and date range
11. THE article viewer SHALL provide options to download the article as PDF or share a link
12. THE article SHALL include metadata showing topic, date, duration, and milestones covered

### Requirement 14: Guest-first Demo Access and Configurable AI Provider

**User Story:** As a learner, I want to use the app immediately without signing in, so that the demo experience is frictionless, while the operator can switch AI models through configuration.

#### Acceptance Criteria

1. THE Frontend SHALL allow learners to start lessons without authentication
2. THE System SHALL persist guest lesson sessions, summaries, and articles locally per browser
3. THE lesson history and article viewer SHALL read guest-local data when running in guest mode
4. THE System SHALL use OpenRouter as the configurable AI provider path for lesson generation/runtime requests
5. THE System SHALL support AI model selection through environment configuration without code edits
6. THE System SHALL keep provider API keys server-side only
7. THE System SHALL allow text-first lesson usage when ElevenLabs voice credentials are absent
8. THE System SHALL support a zo-inspired immersive tutor runtime with a central canvas/media stage and floating voice controls
9. THE System SHALL support separate OpenRouter model configuration for main tutoring and image understanding
