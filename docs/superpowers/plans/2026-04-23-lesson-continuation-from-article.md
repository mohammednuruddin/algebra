# Lesson Continuation From Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a learner continue a completed lesson from its article, with the prior lesson's hidden context feeding both session prep and live tutoring.

**Architecture:** Persist a continuation context beside the guest lesson record, add an article CTA that routes back to the tutor home surface, then pass the continuation payload into session creation so prep and tutor prompts can resume semantically instead of restoring raw UI state.

**Tech Stack:** Next.js App Router, React 19, Vitest, browser guest storage, OpenRouter-backed tutor prompts

---

## File Map

- Modify: `lib/types/tutor.ts`
- Modify: `lib/guest/guest-lesson-store.ts`
- Modify: `lib/guest/guest-lesson-store.test.ts`
- Create: `lib/tutor/continuation.ts`
- Modify: `lib/hooks/use-tutor-session.ts`
- Modify: `lib/hooks/use-tutor-session.test.tsx`
- Modify: `app/api/tutor/article/route.ts`
- Modify: `app/api/tutor/session/create/route.ts`
- Modify: `app/api/tutor/session/create/route.test.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`
- Modify: `components/tutor/tutor-experience.tsx`
- Modify: `components/tutor/tutor-experience.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/lessons/article/[id]/client.tsx`
- Modify: `app/lessons/article/[id]/client.test.tsx`
- Modify: `app/lessons/article/[id]/README.md`
- Modify: `docs/2026-04-22-model-owned-lesson-ending.md` only if prompt guidance section needs cross-reference

### Task 1: Continuation Domain Model

**Files:**
- Modify: `lib/types/tutor.ts`
- Create: `lib/tutor/continuation.ts`
- Test: `lib/guest/guest-lesson-store.test.ts`

- [ ] Step 1: Add failing test coverage for hidden continuation persistence expectations.
- [ ] Step 2: Run `npm test -- lib/guest/guest-lesson-store.test.ts` and confirm the new expectation fails for missing continuation data.
- [ ] Step 3: Add `TutorContinuationContext` types plus helper builders in `lib/tutor/continuation.ts`.
- [ ] Step 4: Extend guest lesson record persistence to store continuation context.
- [ ] Step 5: Re-run `npm test -- lib/guest/guest-lesson-store.test.ts`.

### Task 2: Article Generation + Article CTA

**Files:**
- Modify: `app/api/tutor/article/route.ts`
- Modify: `lib/hooks/use-tutor-session.ts`
- Modify: `lib/hooks/use-tutor-session.test.tsx`
- Modify: `app/lessons/article/[id]/client.tsx`
- Modify: `app/lessons/article/[id]/client.test.tsx`

- [ ] Step 1: Add failing tests for saving continuation context after article generation and for rendering a `Continue lesson` CTA on the article page.
- [ ] Step 2: Run `npm test -- lib/hooks/use-tutor-session.test.tsx app/lessons/article/[id]/client.test.tsx` and confirm failure.
- [ ] Step 3: Build continuation context during article persistence and save it into the guest lesson record.
- [ ] Step 4: Add article CTA wiring back to the tutor entry route with a continuation marker.
- [ ] Step 5: Re-run `npm test -- lib/hooks/use-tutor-session.test.tsx app/lessons/article/[id]/client.test.tsx`.

### Task 3: Continue-Session Boot Flow

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/tutor/tutor-experience.tsx`
- Modify: `components/tutor/tutor-experience.test.tsx`

- [ ] Step 1: Add failing tests for auto-starting a continued session when the query marker resolves a stored continuation payload.
- [ ] Step 2: Run `npm test -- components/tutor/tutor-experience.test.tsx` and confirm failure.
- [ ] Step 3: Read the continuation marker in the client, resolve context from guest storage, and call `startSession` with that continuation payload.
- [ ] Step 4: Surface an honest error if the continuation payload is missing instead of silently starting blank intake.
- [ ] Step 5: Re-run `npm test -- components/tutor/tutor-experience.test.tsx`.

### Task 4: Continuation-Aware Session Creation + Tutor Prompts

**Files:**
- Modify: `app/api/tutor/session/create/route.ts`
- Modify: `app/api/tutor/session/create/route.test.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`

- [ ] Step 1: Add failing route and prompt tests for continuation-aware create-session behavior.
- [ ] Step 2: Run `npm test -- app/api/tutor/session/create/route.test.ts app/api/tutor/turn/route.test.ts lib/tutor/model.test.ts` and confirm failure where continuation support is absent.
- [ ] Step 3: Accept continuation payload in session creation, skip intake, and generate a resumed lesson opening.
- [ ] Step 4: Update prep/opening/live tutor prompts so they consume continuation context, strengths, weaknesses, resume hint, and optional prior visual reuse.
- [ ] Step 5: Re-run `npm test -- app/api/tutor/session/create/route.test.ts app/api/tutor/turn/route.test.ts lib/tutor/model.test.ts`.

### Task 5: Docs + Final Verification

**Files:**
- Modify: `app/lessons/article/[id]/README.md`
- Modify: `docs/superpowers/specs/2026-04-23-lesson-continuation-from-article-design.md`
- Modify: `docs/superpowers/plans/2026-04-23-lesson-continuation-from-article.md`

- [ ] Step 1: Update article docs with the continuation flow and hidden context behavior.
- [ ] Step 2: Run targeted tests for every changed area.
- [ ] Step 3: Run repo gate commands: `npm run lint`, `npx tsc --noEmit`, and `npm test -- app/lessons/article/[id]/client.test.tsx lib/hooks/use-tutor-session.test.tsx components/tutor/tutor-experience.test.tsx app/api/tutor/session/create/route.test.ts lib/tutor/model.test.ts lib/guest/guest-lesson-store.test.ts`.
- [ ] Step 4: Review output, fix failures, and rerun until clean.
