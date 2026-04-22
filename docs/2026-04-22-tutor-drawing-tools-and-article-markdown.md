# Tutor Drawing Tools and Markdown Article Quality

## Date
2026-04-22

## Read When
- tutor asks the learner to point or mark on an image but the old drawing tools are gone
- the stage shows both a static image card and a separate annotation area
- generated tutor articles feel like plain prose instead of rendered markdown study notes

## Symptoms
- The tutor could ask the learner to mark an image, but the learner only saw the stripped HTML canvas version with no proper pen/eraser/undo/redo toolbar.
- The desktop stage could show the same image twice:
  - once as a static "Visual Context" card
  - once again as the background for the drawing task
- Tutor article generation technically returned `article_markdown`, but the prompt contract was too loose, so output quality drifted toward generic prose instead of proper markdown study notes.

## Root Cause
Two separate regressions:

1. **Tutor drawing path regressed to the lightweight canvas**
   - [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:760)
   - We had a richer, already-built Konva drawing toolset in [components/lesson/drawing-canvas.tsx](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.tsx:1), but tutor drawing mode was not using it anymore.

2. **Article generator prompt was underspecified**
   - [app/api/tutor/article/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.ts:1)
   - The route asked for markdown, but not strongly enough for a real study-guide structure.

## Fix

### 1. Restore the tool-rich drawing canvas
- [components/tutor/tutor-canvas-host.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.tsx:760)
- Tutor drawing mode now uses the shared [DrawingCanvas](/Users/nuru/sanchrobytes/algebra/components/lesson/drawing-canvas.tsx:1) again.
- Result:
  - pen
  - eraser
  - undo / redo
  - clear
  - snapshot submit button

### 2. Make the drawing scene own the image stage
- [components/tutor/tutor-shell.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.tsx:76)
- If the current tutor scene is a drawing task with a background image, the shell no longer renders a second standalone image card above it.
- Result: one coherent annotate stage, not duplicated visuals.

### 3. Strengthen markdown article generation
- [app/api/tutor/article/route.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.ts:33)
- The generator prompt now explicitly asks for:
  - a real markdown study guide
  - `#` title
  - sections like `## Overview`, `## Key Ideas`, `## Worked Example`, `## Recap`, `## Practice Prompts`
  - bullets, numbered steps, tables, fenced code blocks, and math where useful
- Viewer path was already rendering markdown in [app/lessons/article/[id]/client.tsx](/Users/nuru/sanchrobytes/algebra/app/lessons/article/[id]/client.tsx:1), so the main missing piece was output quality, not storage shape.

## Before
- tutor asks for image markup
- learner sees a weak canvas with missing tools
- stage can duplicate the same image
- article output may read like plain text with only superficial markdown

## After
- tutor drawing mode uses the richer shared drawing toolset
- the image-marking task owns the stage cleanly
- article generation is markdown-first and intended for markdown rendering

## Regression Tests
- [components/tutor/tutor-canvas-host.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-canvas-host.test.tsx:1)
  - verifies tutor drawing mode uses the shared drawing canvas and forwards snapshots
- [components/tutor/tutor-shell.test.tsx](/Users/nuru/sanchrobytes/algebra/components/tutor/tutor-shell.test.tsx:1)
  - verifies standalone image stage is hidden when drawing mode already owns that image
- [app/api/tutor/article/route.test.ts](/Users/nuru/sanchrobytes/algebra/app/api/tutor/article/route.test.ts:1)
  - verifies article prompt asks for structured markdown study-guide output

## Alternatives Considered
- Add more buttons to the stripped tutor canvas
  - Rejected. Reinventing the already-better shared drawing toolset.
- Keep the duplicate image card for “extra context”
  - Rejected. Visual noise and stage confusion.
- Leave article route mostly as-is and hope the model formats nicely
  - Rejected. Weak prompt, weak output.

## Why This Approach Is Best
- Reuses the better existing drawing implementation.
- Removes duplicated stage visuals instead of papering over them.
- Keeps article generation markdown-first at the source, where it belongs.

## Fallbacks
- No new broad fallback added.
- No heuristic article rewriter added.
- Root-cause fix only.
