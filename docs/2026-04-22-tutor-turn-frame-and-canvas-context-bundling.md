read_when: live tutor responses forget learner canvas answers, repeat stale tasks, or logs show `(empty)` even after the learner submitted a real answer.

# Tutor turn-frame and canvas-context bundling fix

## Symptoms

- Live tutor logs showed the latest learner canvas transcript, but `Current canvas summary` still said the answer was empty and not submitted.
- The tutor often ignored what the learner had just selected or typed on:
  - `text_response`
  - `multiple_choice`
  - `fill_blank`
  - other submit-style canvas modes
- Drawing had extra multimodal evidence, but non-drawing modes were still mostly flattened into vague prose.
- The bug looked like model confusion, but the server prompt was missing the real answer state.

## Root cause

Two seams were wrong at the same time.

1. Client submission seam:
   - Most canvas modes kept learner state only in local React component state.
   - On submit, the app sent a prose transcript string such as canvas-interaction text, but not a structured answer payload.
   - So the server never received the actual learner answer as machine-readable state.

2. Prompt bundling seam:
   - The turn route bundled context as:
     - one lossy `Current canvas summary`
     - one flat `Recent dialogue` string
   - This is much weaker than `zo`, which sends structured event-shaped turns plus active-task context.

Result:
- The tutor model saw stale or incomplete state and had to guess.

## What changed

### 1. Structured canvas interaction payloads

The client now sends `canvasInteraction` with tutor turn submissions for all submit-style canvas modes.

Examples:

- `fill_blank` -> slot answers
- `code_block` -> learner code
- `multiple_choice` -> selected ids
- `number_line` -> selected value
- `table_grid` -> edited cells
- `graph_plot` -> learner points
- `matching_pairs` -> learner pairs
- `ordering` -> learner order
- `text_response` -> learner text
- `drawing` -> structured drawing submission metadata in addition to multimodal image evidence

### 2. Structured turn frames in snapshot history

`TutorTurn` now stores optional `canvasInteraction`.

That means later turns can still see:

- what the learner submitted
- how they interacted with the task
- which answer state belonged to that turn

instead of relying only on a lossy prose transcript.

### 3. Current-turn canvas state is merged with the latest learner submission

Before asking the tutor model for the next turn, the server now overlays the latest submitted interaction onto the current canvas state for prompt building.

This fixes the exact regression where:

- transcript said the learner answered
- but canvas summary still said `(empty)`

### 4. Prompt context now includes structured state

The tutor model now receives:

- `Latest learner turn (structured JSON)`
- `Current canvas state (structured JSON)`
- `Recent turn history (structured JSON, chronological oldest first, newest last)`

The old prose summary is still included as secondary context, but it is no longer the main source of truth.

### 5. Legacy transcript compatibility

The route can parse legacy transcript strings like:

- `[Canvas interaction: text_response] {"text":"i dont know"}`

So existing in-flight sessions do not completely lose the fix.

## Before

- learner submits answer on canvas
- local UI knows the answer
- route sees stale snapshot canvas
- prompt says answer empty / not submitted
- model responds as if learner never answered properly

## After

- learner submits answer on canvas
- client sends structured `canvasInteraction`
- route merges latest submission into current canvas context
- route stores that structured interaction in turn history
- prompt shows the real answer state to the model
- tutor can evaluate the actual learner submission and move on correctly

## Tests

- `app/api/tutor/turn/route.test.ts`
  - verifies text-response submissions build structured context instead of stale empty state
- `lib/tutor/model.test.ts`
  - verifies prompt includes structured canvas state, structured learner turn, and structured history
- `components/tutor/tutor-experience.test.tsx`
  - verifies structured canvas submission payloads are forwarded from the client

## Prevention

- Do not flatten learner canvas submissions into prose-only transcripts.
- Treat submit-style canvas modes as event payloads, not mere speech.
- Keep turn history machine-readable where correctness or progression depends on prior interaction state.
- When a learner submission is the current event, merge it into prompt context before the model is called.

## Alternatives considered

### 1. Prompt-only fix

Rejected.

Reason:
- If the server never sends the real answer state, a better prompt cannot recover it.

### 2. Parse only the transcript string forever

Rejected as the main approach.

Reason:
- brittle
- depends on transcript formatting
- fails once payloads grow richer

Kept only as a compatibility bridge for already-running sessions.

### 3. Lift every canvas mode into fully controlled global snapshot state immediately

Rejected for now.

Reason:
- bigger UI rewrite
- higher regression risk
- not required to fix the root cause of missing turn context

## Why the chosen approach is best

The chosen approach is the best tradeoff because it:

- fixes the real missing-data seam
- keeps the UI architecture mostly intact
- matches the stronger `zo` pattern of structured turn context
- preserves compatibility for existing transcript-shaped turns
- avoids a larger canvas-state rewrite right now

## Fallbacks

- No new broad fallback added.
- Only a narrow legacy transcript parser was added so already-running sessions can still recover structured canvas interactions where possible.
