read_when: tutor logs show `[Object]` instead of readable history, or drawing scenes stay locked / keep old marks after the tutor issues a fresh drawing turn.

# Tutor debug-history visibility and drawing-scene reset fix

## Symptoms

- Terminal logs showed:
  - `role: 'user', content: [ [Object], [Object], ... ]`
  - so the real structured turn history was not readable.
- After a learner submitted drawing markup and the tutor issued a fresh drawing turn, the next scene could:
  - keep the old marks visible
  - keep the drawing scene feeling locked
  - make it look like the background image itself had been modified

## Root cause

Two separate seams:

1. Debug logging seam
   - raw multimodal message arrays were logged directly
   - nested content parts collapsed to `[Object]`
   - so the history was technically present but human-unreadable

2. Drawing scene identity seam
   - the drawing scene key depended only on prompt/background strings
   - when a new `set_drawing` turn reused the same prompt/background, the local drawing component treated it like the same scene
   - old local line state and local submit-lock state could therefore survive into the next tutor turn

## Fix

### 1. Readable debug logging

Added a shared formatter that:

- expands multimodal message content
- keeps text blocks readable
- truncates giant image/data URLs safely

So the tutor logs now show actual structured history instead of `[Object]`.

### 2. Real drawing scene revision

Added `sceneRevision` to tutor drawing state.

Every fresh `set_drawing` task now increments that revision, even if:

- prompt is the same
- background image URL is the same

The drawing UI keys off that revision, so a new drawing task gets a genuinely fresh local scene.

## Before

- fresh drawing task could reuse old local drawing state
- old marks could remain visible
- local submit-lock could leak into the next turn
- logs hid structured history behind `[Object]`

## After

- fresh `set_drawing` turns always get a fresh drawing scene
- old local marks do not leak into the next drawing task
- logs print readable structured history

## Tests

- `lib/tutor/runtime.test.ts`
  - drawing scene revision increments for repeated drawing tasks
- `components/tutor/tutor-canvas-host.test.tsx`
  - repeated drawing task with a new scene revision unlocks the canvas again
- `lib/tutor/debug-log.test.ts`
  - multimodal debug messages expand into readable history and truncate image payload URLs

## Prevention

- Do not identify drawing scenes only by prompt/background text.
- When a model issues a new drawing task, give the runtime a fresh scene identity.
- Never log raw nested multimodal structures if humans actually need to inspect them.

## Alternatives considered

### 1. Reset drawing state in an effect with synchronous `setState`

Rejected.

Reason:
- the linter correctly flagged it
- worse React pattern
- unnecessary once scene identity is explicit

### 2. Keep raw debug logs as-is

Rejected.

Reason:
- technically present, practically useless

## Why the chosen approach is best

The chosen fix is best because it:

- fixes the real scene-identity bug instead of papering over it
- keeps drawing reset behavior tied to explicit new drawing tasks
- improves logs without dumping gigantic raw data URLs

## Fallbacks

- No new fallback added.
