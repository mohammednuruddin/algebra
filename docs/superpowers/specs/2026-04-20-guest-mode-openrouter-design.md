# Guest Mode + OpenRouter Design

## Goal

Convert the teaching app from auth-gated usage to guest-first usage, and replace direct OpenAI/Anthropic branching with an OpenRouter-backed, env-configurable AI provider setup.

Primary outcomes:
- no sign-in required to use the app
- users can start lessons immediately from the landing page
- lesson history and articles persist per browser/device
- AI model selection is configurable through env, not hardcoded in the app flow
- demo path stays smooth even if optional voice env is missing

## Scope

In scope:
- remove auth requirements from the main teaching flow
- remove login as a required entry path
- add guest-local persistence for sessions, history, and articles
- wire OpenRouter as the AI backend contract
- make model selection configurable by env
- update UI copy and routing to reflect guest usage

Out of scope:
- multi-device sync for guest sessions
- public anonymous writes to Supabase
- migration of old authenticated lesson data into guest storage
- deleting every old auth file immediately

## Product Decision

Chosen mode:
- guest per browser

Meaning:
- a user can use the app with no account
- their lessons/history/articles live in browser-local storage
- refreshing the page keeps their local data
- another browser/device will not share that data

Why:
- best hackathon demo path
- no fake security model around anonymous backend writes
- fastest route to a reliable “just works” experience

## Architecture

### 1. Entry Flow

Current:
- home page checks Supabase user
- unauthenticated users are pushed toward `/login`
- lesson/history/article routes assume auth

Target:
- home page is the main start screen for everyone
- login is removed from the normal teaching flow
- lesson UI is directly accessible
- lesson history becomes guest history for this browser

Implementation direction:
- remove login CTAs from the landing page
- expose lesson start directly from the landing page or route users straight into the lesson container
- stop redirecting guest users to `/login`

### 2. Persistence Model

Current:
- session creation assumes authenticated Supabase user
- history/article pages fetch server-side user-scoped rows

Target:
- a browser-local guest store owns:
  - lesson sessions
  - lesson summaries
  - generated articles
  - lesson history metadata

Storage choice:
- localStorage-backed persistence for this pass

Why localStorage instead of IndexedDB:
- faster implementation
- enough for hackathon-sized records
- simpler debug story

Planned data shape:
- `guest_profile`
  - `guestId`
  - `createdAt`
- `guest_lesson_sessions`
  - `id`
  - `topicPrompt`
  - `createdAt`
  - `updatedAt`
  - `status`
  - `lessonPlan`
  - `currentMilestoneId`
  - `turns`
  - `summary`
  - `article`
- `guest_lesson_history`
  - derived or stored summary cards for listing pages

Record ownership:
- implicit by browser storage, not backend auth

### 3. AI Provider Layer

Current:
- Supabase Edge Functions choose OpenAI or Anthropic directly
- model/provider logic duplicated across functions

Target:
- one OpenRouter-compatible provider path
- model configurable by env
- provider config centralized

Env contract:
- `OPENROUTER_API_KEY` required for AI generation
- `OPENROUTER_MODEL` optional, default provided
- `OPENROUTER_BASE_URL` optional, default `https://openrouter.ai/api/v1`
- `OPENROUTER_HTTP_REFERER` optional
- `OPENROUTER_APP_NAME` optional

Default behavior:
- if `OPENROUTER_MODEL` missing, use a sane default model string
- no model names hardcoded across multiple files

Request contract:
- use OpenRouter OpenAI-compatible chat completions endpoint
- send bearer auth with `OPENROUTER_API_KEY`
- send optional referer/title headers when configured

### 4. Voice

Current:
- ElevenLabs routes require auth

Target:
- ElevenLabs routes do not require auth for guest mode
- voice remains optional

Env contract:
- `ELEVENLABS_API_KEY` optional for voice

Behavior:
- if ElevenLabs key exists, voice features work
- if missing, text lesson flow still works
- UI should not dead-end on missing voice env

### 5. History + Article UX

Current:
- history and article pages are auth-protected and backend-fetched

Target:
- history page reads guest-local history
- article viewer reads guest-local article records
- copy changes from “your account history” style assumptions to “this browser’s lessons”

Behavior:
- user can reopen completed lessons locally
- article detail page still supports share/download as a local lesson artifact
- no auth redirect on history/article routes

## Component / Module Plan

### New or reshaped modules

1. `lib/guest/*`
- guest id creation
- local persistence helpers
- lesson session serialization
- history/article retrieval helpers

2. `lib/ai/openrouter.ts`
- env parsing
- request builder
- shared chat completion helper

3. lesson runtime hooks
- switch from auth-dependent session creation to guest-local session initialization
- persist state locally after important transitions

### Existing modules to update

1. `app/page.tsx`
- remove sign-in gating
- expose direct lesson entry

2. `app/login/page.tsx`
- remove from primary flow
- can become a simple deprecated/unused page or redirect home

3. `lib/supabase/middleware.ts`
- stop protecting lesson routes for this app path

4. `lib/api/lesson-planner.ts`
- remove auth requirement
- stop inserting auth-owned session rows for guest flow

5. `app/lessons/history/*`
- swap backend authenticated fetch for guest-local data load

6. `app/lessons/article/[id]/*`
- swap auth/server fetch model for guest-local article lookup

7. `app/api/elevenlabs/*`
- remove auth requirement
- fail gracefully only on missing API key or provider errors

8. Supabase AI functions or equivalent server-side AI call path
- replace direct OpenAI/Anthropic branching with shared OpenRouter call helper

## Data Flow

### Start Lesson

1. user opens landing page
2. user enters topic
3. app creates a local guest session id and lesson record
4. planner call generates lesson plan through OpenRouter
5. resulting lesson plan is stored locally
6. lesson board opens

### Respond During Lesson

1. learner submits voice/text/canvas input
2. runtime updates current guest-local session state
3. AI teaching step runs through OpenRouter-backed server path
4. updated turn + progress are stored locally
5. UI renders next response

### Complete Lesson

1. summary/article generation runs
2. article and summary are stored in guest-local persistence
3. history view lists the completed session
4. article page can reopen the saved content

## Error Handling

### Missing OpenRouter key
- show actionable configuration error
- do not crash the entire page shell
- lesson creation should fail with a clear message

### Missing ElevenLabs key
- disable or hide voice actions
- continue with text-first lesson flow

### Corrupt local storage
- fall back to empty guest state
- preserve app usability
- avoid infinite parse crashes

### Model/provider failure
- surface a user-facing lesson generation error
- preserve the local draft session only if useful for retry

## Security / Privacy

- no secret keys exposed to client code
- OpenRouter key stays server-side only
- ElevenLabs key stays server-side only
- browser-local lessons are only as private as the local browser profile
- no anonymous public write surface to Supabase is introduced in this design

## Testing Plan

Required verification:
- landing page works with no auth session
- lesson start works with guest mode
- history page works with only local guest data
- article page works with only local guest data
- voice controls degrade cleanly when ElevenLabs env is missing
- OpenRouter config path works with mocked responses
- auth redirects no longer trigger for lesson/history/article routes

Test types:
- unit tests for guest storage helpers
- unit tests for OpenRouter request helper
- component tests for guest-first landing/history/article flows
- integration tests for lesson session persistence across refresh-compatible reads

## Migration / Rollout

- do not delete old auth modules first
- first remove them from active teaching flow
- keep unused auth components/files temporarily to avoid risky broad deletion
- cleanup can happen in a later pass once guest flow is proven stable

## Alternatives Considered

### Guest + backend persistence
Rejected for now:
- more moving parts
- invites anonymous write concerns
- slower hackathon path

### Keep auth but hide sign-in UI
Rejected:
- dishonest architecture
- users still hit auth blockers in lesson/history/article flows

### No persistence at all
Rejected:
- weak demo
- loses one of the polished app outcomes already built

## Acceptance Criteria

- user can open the app and start a lesson without signing in
- no lesson route redirects to `/login`
- completed guest lessons appear in local history
- guest article viewer opens previously saved local articles
- OpenRouter is the active AI provider path
- model can be changed through env without code edits
- missing ElevenLabs key does not block text lesson usage

## Implementation Notes

Recommended order:
1. remove route protection and landing/login gating
2. add guest storage layer
3. rewire lesson runtime to local guest persistence
4. rewire history/article pages
5. add OpenRouter provider helper and switch AI calls
6. loosen ElevenLabs auth requirement
7. verify end-to-end guest flow

## Self-Review

Checks completed:
- no placeholder sections
- no contradictory persistence model
- scope constrained to one implementation plan
- explicit choice made for local guest persistence over backend guest writes
