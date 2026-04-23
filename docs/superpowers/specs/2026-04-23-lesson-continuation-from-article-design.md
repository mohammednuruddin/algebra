# Lesson Continuation From Article Design

## Date
2026-04-23

## Read When
- adding a `Continue lesson` action to lesson articles
- a new tutor session should continue from a completed lesson instead of starting cold
- article history must keep hidden continuation context without showing it in article UI

## Goal
Let a learner open a completed lesson article, tap `Continue lesson`, and begin a brand-new tutor session that remembers the prior lesson's transcript, images, board state summary, and learning signals without exposing that raw context in the article body.

## Product Decision
- Start a fresh session, not a raw UI restore.
- Keep the completed lesson immutable.
- Carry forward semantic lesson context, not the entire old live board.
- Restore a prior image only when it helps the next turn.

## Existing Constraints
- The active tutor stack is the `tutor-*` flow, not the older `lesson-*` guest flow.
- Guest-mode tutor snapshots live in browser storage via [lib/guest/guest-tutor-store.ts](/Users/nuru/sanchrobytes/algebra/lib/guest/guest-tutor-store.ts:1).
- Article generation already knows the source session id via [app/api/tutor/article/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.ts:259).
- The server route cannot read browser local storage, so continuation context must be assembled on the client and posted into session creation.

## Architecture

### 1. Hidden Continuation Context
Add a `TutorContinuationContext` domain object that captures:
- source session id and article id
- lesson topic, learner level, outline
- completed transcript turns
- prepared and shown images
- last active image id
- final canvas summary plus a snapshot of the final canvas state
- derived focus notes such as likely strengths, weaknesses, and next-step recommendations

This context is stored alongside the guest lesson record after article generation. It is not rendered in the article UI.

### 2. Article To Tutor Handoff
The article page adds a `Continue lesson` CTA. That CTA links back to the home tutor surface with a lightweight query marker such as `?continue=<articleId>`.

The home tutor client reads the query marker, resolves the hidden continuation context from guest storage, and starts a new tutor session with that context in the create-session payload.

### 3. Fresh Session, Continued Memory
`/api/tutor/session/create` accepts an optional continuation context payload.

When continuation exists:
- skip intake
- prepare the new lesson from the old context
- create a new session id
- generate a new opening tutor turn that references prior strengths, weaknesses, and where to resume
- selectively seed the first active image from the prior session when it is still relevant

The new session remains independent from the old one, but keeps lineage to it inside the snapshot.

### 4. Prompt Contract
Lesson preparation prompt gains continuation-aware inputs:
- prior lesson summary
- prior outline and transcript
- strengths
- weaknesses
- recommended resumption point
- whether a prior visual should be reused

Opening-turn prompt gains continuation-aware guidance:
- briefly bridge from the previous lesson
- avoid repeating the full old opening
- explicitly build from the learner's earlier strengths and weak spots
- optionally restore one useful image

Live-turn prompt also receives the continuation summary so the tutor can keep inferring progress in context instead of treating the learner as brand new.

## Data Shape

### `TutorContinuationContext`
- `sourceSessionId: string`
- `sourceArticleId: string | null`
- `topic: string`
- `learnerLevel: string`
- `outline: string[]`
- `turns: TutorTurn[]`
- `mediaAssets: TutorMediaAsset[]`
- `activeImageId: string | null`
- `canvasSummary: string`
- `canvasState: TutorCanvasState`
- `strengths: string[]`
- `weaknesses: string[]`
- `recommendedNextSteps: string[]`
- `resumeHint: string`
- `completedAt: string`

### Guest persistence
Extend the guest lesson record with:
- `continuationContext: TutorContinuationContext | null`

Keep article metadata lightweight. The article remains the visible artifact; the lesson record owns the hidden continuation payload.

## Why This Approach
- avoids brittle full-board resurrection
- keeps the old lesson frozen and trustworthy
- keeps server responsibilities honest
- gives prep and tutor prompts the real context they need
- keeps the user-facing article clean

## Rejected Alternatives

### Exact board restore by default
Rejected. Too fragile, too stateful, too easy to reopen stale mid-task UI.

### Pass only article id to the server
Rejected. Server route cannot access guest browser storage.

### Copy the entire transcript blob into visible article markdown
Rejected. Bloats the article and mixes review content with runtime internals.

## Testing Strategy
- article page shows `Continue lesson` only when continuation context exists
- article CTA links back with continuation marker
- guest lesson persistence saves continuation context after article generation
- tutor experience auto-starts a continued session from the query marker
- session create route skips intake and forwards continuation-aware prep/opening inputs
- model prompt tests verify continuation instructions are present

## Fallbacks
- No new runtime fallback path should silently start a blank new lesson when continuation context is missing.
- If continuation context cannot be resolved, the UI should stay honest and fall back to the normal start surface with a visible error.
