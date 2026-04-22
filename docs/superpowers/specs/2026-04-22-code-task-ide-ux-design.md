# Code Task IDE UX Design

## Goal

Make the tutor `code_block` canvas feel like a real beginner-friendly mini IDE instead of a plain textarea.

Primary outcomes:
- submitting code shows real runtime output or runtime errors, not only a static "Expected" hint
- beginner Python tasks that call `input()` can collect a real learner response in-browser
- a genuinely new coding task resets editor state cleanly
- a repeated submit on the same task preserves learner code
- the primary action label reflects the real task state
- the editor no longer puts instructional text inside the editable code area
- the editor supports core coding affordances such as bracket/quote auto-close and language-aware indentation

## Scope

In scope:
- `code_block` task UX inside `components/tutor/tutor-canvas-host.tsx`
- task identity/reset behavior for code tasks
- browser-side Python execution and output/result presentation after learner submit
- replacing the plain textarea with a real code editor component
- tests covering same-task resubmits and new-task resets

Out of scope:
- server-side code execution or sandboxing
- grading code correctness beyond showing the real runtime result
- adding a full multi-file IDE
- changing non-code canvas modes unless required by shared helpers

## Product Decisions

### 1. Task identity

Chosen rule:
- a code task is considered new when any of these change:
  - `prompt`
  - `language`
  - `starterCode`
  - `expectedOutput`

Meaning:
- same task after learner submit: keep editor contents and show `Run again`
- new task from tutor: reset editor to the new starter code, clear prior result state, restore the primary action to `Run code`

Why:
- this matches the learner mental model
- it avoids stale `Resubmit` state leaking into the next exercise
- it does not require backend schema changes for a first clean pass

### 2. Prompt placement

Chosen rule:
- task instructions stay outside the editable code surface
- the code surface contains only actual code

Meaning:
- remove comment-style instructional text such as `# Type your math here and press Enter` from the starter/editor body when that text is acting as UX guidance rather than code
- keep prompt copy rendered above the editor as normal UI text
- starter code remains allowed when it is genuine starter code the learner should edit

Why:
- beginners will try to type directly into comment prompts
- mixing instruction text with code makes the starting state ambiguous

### 3. Result presentation

Chosen rule:
- after submit, show a result panel reflecting the actual runtime result
- if expected output exists, show it as reference beside or below the real output

Meaning:
- the learner sees the actual stdout or error produced by the current run in a dedicated result area
- Python `input()` reads from a browser prompt instead of crashing on stdin
- `Expected output` becomes secondary reference text, not the only post-submit feedback artifact
- when a new task starts, result state clears immediately

Why:
- "Expected" alone feels like an answer key, not a response to the learner action
- learners need the real runtime behavior, not an echo of submitted code

### 4. Editor technology

Chosen rule:
- use CodeMirror 6 as the embedded code editor

Why CodeMirror:
- lightweight and browser-friendly compared with Monaco
- strong support for bracket auto-close, indentation, history, and per-language setup
- easier to embed surgically in the current canvas card without turning the feature into a full IDE project

Planned language support for this pass:
- Python first, because the current prompt/examples reference Python behavior
- generic fallback language config for unsupported modes

## Architecture

### 1. Code task state model

Current:
- `CodeBlockMode` keeps local `code` and `submitted` state only
- state initializes once from `codeBlock?.starterCode`
- later task changes can leave stale submit UI behind

Target:
- compute a stable task identity key from the chosen reset fields
- whenever the task key changes:
  - reset editor contents to the current `starterCode`
  - clear learner output/result state
  - clear local "submitted this task" UI state

Implementation direction:
- derive a `taskKey` in `CodeBlockMode`
- use an effect keyed by `taskKey` to reset local state
- continue reading backend `codeBlock.submitted` only as durable snapshot state, not as the only local UI driver

### 2. Output panel contract

Current:
- footer shows optional `Expected: ...`
- no code execution path exists
- no dedicated runtime output surface exists

Target:
- result card appears after submit
- result card includes:
  - `Output`
  - actual stdout when execution succeeds
  - `Error` when execution fails
  - optional `Expected output`
- the result card and editor must stay shrinkable inside the tutor stage instead of pushing off-canvas

First-pass contract:
- code execution happens in-browser for Python tasks
- the output panel must show actual runtime behavior, not echoed source code

Preferred labels:
- `Output`
- `Error`
- optional `Expected output`

Execution approach:
- use an in-browser Python runtime, loaded lazily, so `Run code` behaves like a real mini IDE without a server round-trip

### 3. Action labels

Target labels:
- before first submit on a task: `Run code`
- after submit on the same task: `Run again`
- disabled when editor content is empty or host is disabled

Why:
- `Submit Code`/`Resubmit` sounds form-like, not IDE-like
- `Run code` better matches user expectation

### 4. Editor UX

Target editor behaviors:
- auto-close `()`, `[]`, `{}`, `''`, `""`
- smart indent on Enter
- Tab indentation
- syntax highlighting where language support exists
- visible empty editor starting state with no fake instructional code

Implementation direction:
- create a focused editor wrapper component or local helper inside the tutor canvas module
- configure CodeMirror extensions for:
  - history
  - bracket closing
  - indent-on-input
  - default keymap/indent commands
  - Python language support when `language === 'python'`

## Testing

Add or update tests covering:
- new code task resets editor contents to new starter code
- new code task clears prior submitted/result UI and restores `Run code`
- same task after submit preserves editor contents and shows `Run again`
- prompt text renders outside the editor instead of as editable starter copy
- editor still supports submission flow through the host callback

## Risks

### 1. Rich editor test fragility

Risk:
- CodeMirror can be noisier to test than a textarea

Mitigation:
- test user-visible behavior, not editor internals
- assert on rendered text, submit labels, and callback payloads

### 2. Overclaiming execution

Risk:
- calling submitted code "output" would mislead users if nothing was executed

Mitigation:
- label the panel `Submitted code`
- keep `Expected output` separate

### 3. Reset logic drift

Risk:
- if tutor changes only one field, stale state may survive if the key is incomplete

Mitigation:
- key off all approved fields: `prompt`, `language`, `starterCode`, `expectedOutput`

## Chosen Approach

Best approach for this pass:
- add CodeMirror 6
- add a lazy browser-side Python runtime
- add a task identity key in the client
- reset only on approved task-boundary fields
- show post-submit real output/error plus optional expected output
- rename action labels to `Run code` / `Run again`

Why this is best:
- fixes the real UX issues at root cause
- keeps implementation contained to the code-task surface
- avoids pretending we built code execution when we did not
- leaves room for future real execution without repainting the UX from scratch
