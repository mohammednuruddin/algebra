# Tutor Article Retries

## Date
2026-04-22

## Read When
- `/api/tutor/article` fails because the model returned malformed JSON or missing `article_markdown`
- guest article persistence throws transient browser storage errors such as `Another write batch or compaction is already active`

## Symptoms
- Article generation could fail on the first malformed model response with:
  - `Article generation returned invalid format`
- Guest lesson history writes could fail on transient storage compaction collisions and never retry.

## Root Cause
Two transient paths had no bounded retry behavior:

1. [app/api/tutor/article/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.ts:1)
   - one malformed or empty model response ended the request immediately
2. [lib/hooks/use-tutor-session.ts](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.ts:1)
   - local guest article persistence treated browser storage compaction collisions as fatal

## Fix
- Added a shared bounded retry helper in [lib/utils/retry.ts](/Users/nuru/sanchrobytes/algebra/lib/utils/retry.ts:1)
- Article generation now retries up to 3 times when the upstream response is transiently unusable:
  - missing content
  - invalid JSON payload shape
  - missing `article_markdown`
  - upstream `429` or `5xx`
- Guest lesson article persistence now retries up to 3 times for transient compaction/write-batch collisions.

## Before
- first malformed generation response => hard 500
- first transient guest-store compaction error => article not persisted locally

## After
- bounded retries: max 3 attempts
- same root operation retried; no broad fallback path added
- final error still surfaces if all 3 attempts fail

## Regression Tests
- [app/api/tutor/article/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.test.ts:1)
  - retries malformed responses until the third attempt succeeds
  - stops after 3 malformed attempts
- [lib/hooks/use-tutor-session.test.tsx](/Users/nuru/sanchrobytes/algebra/lib/hooks/use-tutor-session.test.tsx:1)
  - retries guest lesson persistence after transient compaction failures

## Alternatives Considered
- Retry the whole client request blindly from the UI
  - Rejected. That would hide which layer failed and could multiply upstream model calls.
- Add permissive article-format fallbacks
  - Rejected. Wrong fix. We want the real article contract, then a bounded retry when the model drifts.

## Why This Approach Is Best
- Retries happen at the failing boundary.
- Max-attempt cap is explicit.
- No new broad fallback behavior.
