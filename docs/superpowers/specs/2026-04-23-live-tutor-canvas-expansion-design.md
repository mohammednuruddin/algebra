# Live Tutor Canvas Expansion Design

## Goal

Expand the live tutor so it can teach far beyond algebra without turning the canvas system into a widget zoo.

Primary outcomes:
- keep the product as a single live-tutor experience, not a split tutor/practice app
- support both diagram-heavy and reasoning-heavy subjects
- add reusable tutor workspaces that cover many subjects instead of bespoke one-off widgets
- preserve model ownership of when to use the board, which board to use, and how long to keep it active
- make the tutor sound warm, clear, and purposeful when using the board
- avoid over-hyped or repetitive motivational phrasing such as constant "let's go" pushes

## Scope

In scope:
- live tutor canvas expansion inside the existing tutor runtime and stage
- new reusable canvas modes for broad subject coverage
- lightweight interaction skins that still live inside the tutor flow
- tutor prompt/system contract for canvas selection, instructions, lifecycle, and evidence use
- structured learner evidence for the new modes
- phased rollout guidance so implementation can start with the highest-ROI subset

Out of scope:
- a separate practice or review mode
- score/streak-heavy game systems
- full subject-specific editors such as a molecule editor, formal proof editor, or essay IDE
- implementation work in this spec

## Product Decisions

### 1. Live tutor only

Chosen rule:
- every new interaction stays inside the live tutor
- the tutor speaks, the learner manipulates the board, the learner submits evidence, the tutor responds

Why:
- keeps the product coherent
- fits the current runtime architecture
- avoids splitting effort across two interaction models

### 2. Two weight classes

Chosen rule:
- use two classes of live-tutor interactions:
  - core canvases
  - lightweight tutor skins

Core canvases:
- persistent scene/state
- structured learner submission
- tutor-inspectable evidence
- partial-correct handling

Lightweight tutor skins:
- short interaction pattern inside the tutor flow
- lower evidence richness
- less scene complexity

Why:
- lets us ship "all" the desired ideas without making every idea a heavyweight runtime contract
- protects the system from overengineering low-depth mechanics

### 3. Reusable primitives over subject packs

Chosen rule:
- new core canvases must serve at least 3 subjects or provide clearly new learner evidence

Why:
- prevents biology-only, history-only, or chemistry-only widget sprawl
- keeps the system teachable to the model
- improves implementation leverage

### 4. Balanced expansion: diagram-heavy and reasoning-heavy

Chosen rule:
- the first serious expansion should cover both:
  - visual/spatial teaching
  - relational/logical/argument teaching

Why:
- the user explicitly wants both
- subject coverage collapses if the system overfits to only diagrams or only reasoning boards

### 5. Tutor prompt quality is a first-class requirement

Chosen rule:
- the tutor prompt must teach judgment, not merely enumerate commands

Why:
- weak prompt guidance turns canvases into dead props
- the model must know when to use a board, which board fits, how to talk through it, and how to react to evidence

### 6. Tone: warm, not pushy

Chosen rule:
- tutor tone should stay encouraging, calm, and human
- energy is welcome, but hype should be used sparingly
- avoid repetitive "let's go" style phrasing, especially when the learner is confused or working through a hard task

Why:
- live tutoring should feel supportive, not performative
- repeated hype language can make the tutor sound fake or exhausting

## Canvas Taxonomy

### Core Canvases

These should become first-class runtime modes.

### 1. `image_hotspot`

Use for:
- labeling diagrams
- locating body parts, regions, components, landmarks, or circuit elements

Best subjects:
- biology
- geography
- anatomy
- physics
- geometry

Learner evidence:
- selected hotspot ids
- raw click coordinates when no hotspot is hit
- near-miss patterns
- optional confidence

Why it is core:
- high multimodal value
- strong tutor inspectability
- broad subject utility

### 2. `timeline`

Use for:
- chronology
- ordering stages
- arranging steps or transitions through time

Best subjects:
- history
- literature
- evolution
- civics
- scientific procedure

Learner evidence:
- item order
- gaps
- reversals
- unplaced items

### 3. `continuous_axis`

Use for:
- estimating a value or degree on a continuum
- placing examples on a scale or along one or two bounded dimensions

Best subjects:
- physics
- statistics
- geography climate ranges
- economics
- language tone/intensity

Learner evidence:
- placed value
- error distance from target or acceptable range
- optional range/confidence selection

### 4. `venn_diagram`

Use for:
- compare/contrast
- overlap and distinction
- basic set reasoning and classification

Best subjects:
- logic
- grammar
- civics
- science classification
- reading comparison

Learner evidence:
- placements by region
- overlap mistakes
- empty-region misunderstandings

### 5. `token_builder`

Use for:
- building valid structures from pieces

Best subjects:
- algebra expressions
- chemical equations
- grammar construction
- logic statements
- code reasoning

Learner evidence:
- token order
- invalid joins
- missing pieces
- extra pieces

### 6. `process_flow`

Use for:
- building chains, cycles, branches, and causal sequences

Best subjects:
- biology
- chemistry
- history causality
- writing structure
- economics

Learner evidence:
- node order
- arrow direction
- branch selection
- missing steps

### 7. `part_whole_builder`

Use for:
- fractions
- percentages
- ratios
- probability composition
- mixtures

Best subjects:
- math
- statistics
- chemistry composition
- economics shares

Learner evidence:
- partition choice
- shaded/filled proportion
- linked symbolic representation if present

### 8. `map_canvas`

Use for:
- pins
- region selection
- route drawing
- spatial overlays

Best subjects:
- geography
- history campaigns or migration
- trade and transport
- climate
- geology

Learner evidence:
- selected regions
- pin placements
- route points
- layer toggles where relevant

### 9. `claim_evidence_builder`

Use for:
- connecting a claim to supporting evidence and reasoning

Best subjects:
- reading comprehension
- science explanation
- history argument
- civics

Learner evidence:
- claim selection
- evidence-to-claim links
- reasoning text or structured justifications
- unsupported claims

### 10. `compare_matrix`

Use for:
- comparing examples against multiple traits in rows and columns

Best subjects:
- economics systems
- government types
- vocabulary analysis
- species/rock/material classification
- compare/contrast tasks

Learner evidence:
- cell assignments
- blank trait gaps
- conflicting or duplicated placements

### Lightweight Tutor Skins

These should stay inside the live tutor but should not initially become heavyweight first-class scene systems unless later evidence proves they need it.

### 1. `flashcard`

Use for:
- quick memory refresh
- vocabulary
- symbols
- dates
- formula recall

Reason to keep lightweight:
- low evidence richness
- useful pacing tool, not a deep board workspace

### 2. `true_false`

Use for:
- misconception checks
- rapid concept screening
- fast verbal/visual verification

Reason to keep lightweight:
- best as a short tutor move
- lower board complexity than the core canvases
- should not become an arcade-style streak engine

## Implementation Waves

This design covers all requested modes, but implementation should still be phased.

Planning boundary:
- the first implementation plan should cover only Phase 0 and Phase 1
- Phase 2 and Phase 3 should be separate follow-on plans after the first wave is stable
- this avoids a single oversized implementation branch and keeps verification realistic

### Phase 0: Shared foundations

Required first:
- extend canvas mode/type system
- establish a shared evidence envelope pattern for new modes
- add prompt guidance for canvas selection and lifecycle
- split tutor canvas rendering into smaller components where needed
- keep files focused instead of concentrating every mode in one giant host file

### Phase 1: Highest-leverage core set

Ship first:
- `image_hotspot`
- `timeline`
- `continuous_axis`
- `venn_diagram`
- `token_builder`
- `process_flow`

Why:
- best combined subject coverage
- strongest mix of diagram-heavy and reasoning-heavy work
- most clearly different from existing modes

### Phase 2: Extended core coverage

Ship next:
- `part_whole_builder`
- `map_canvas`
- `claim_evidence_builder`
- `compare_matrix`

Why:
- deepens coverage once the shared patterns from Phase 1 are stable

### Phase 3: Lightweight skins

Ship after the core system is healthy:
- `flashcard`
- `true_false`

Why:
- useful, but less foundational than the core tutor workspaces

## Mode-to-Subject Coverage Matrix

High-value coverage map:

- science:
  - `image_hotspot`
  - `process_flow`
  - `continuous_axis`
  - `part_whole_builder`
  - `claim_evidence_builder`
- math:
  - `token_builder`
  - `continuous_axis`
  - `part_whole_builder`
  - `venn_diagram`
- history and civics:
  - `timeline`
  - `process_flow`
  - `claim_evidence_builder`
  - `compare_matrix`
  - `map_canvas`
- geography:
  - `image_hotspot`
  - `map_canvas`
  - `continuous_axis`
  - `compare_matrix`
- language and reading:
  - `token_builder`
  - `claim_evidence_builder`
  - `compare_matrix`
  - `timeline`
  - `venn_diagram`
- economics and business:
  - `process_flow`
  - `compare_matrix`
  - `continuous_axis`
  - `claim_evidence_builder`
  - `map_canvas`

## Liveliness Principles

The board should feel alive because the interaction is meaningful, not because the UI is noisy.

Chosen rule:
- liveliness comes from interaction grammar, feedback, and tutor timing
- not from arbitrary animation, score spam, or decorative chrome

Examples by mode:
- `image_hotspot`: tutor spotlight pulse, near-hit ring, reveal labels after submit
- `timeline`: snap lanes, tutor scrubbing through the sequence, gentle reorder animation
- `continuous_axis`: shaded target bands, live preview, precision nudges
- `venn_diagram`: region glow, partial-credit feedback, overlap emphasis
- `token_builder`: magnetic slots, validity hints, tutor reading the built structure aloud
- `process_flow`: animated arrows, branch tracing, broken path emphasis
- `map_canvas`: route drawing, layer fade-in, pin confirmation pulse
- `claim_evidence_builder`: connection lines appear, unsupported claims stay dim

Anti-patterns:
- score-first design
- generic "great job" spam without inspecting the submission
- decorative chrome that duplicates tutor speech

## Tutor System Prompt Contract

This is the most important implementation seam.

The system prompt should teach the tutor:
- when to stay in voice only
- when to use the canvas
- which canvas fits the teaching move
- how to issue concrete instructions
- how to interpret learner evidence
- how to continue or clear the scene

### 1. Canvas selection rubric

The prompt should explicitly map teaching intent to canvas type.

Examples:
- identify or locate on an image -> `image_hotspot`
- arrange in time or sequence -> `timeline`
- place on a range/continuum -> `continuous_axis`
- compare overlap and difference -> `venn_diagram`
- assemble a valid structure -> `token_builder`
- trace a chain/cycle/cause -> `process_flow`
- show fractions/shares/composition -> `part_whole_builder`
- locate or route in space -> `map_canvas`
- support a claim with evidence -> `claim_evidence_builder`
- compare multiple examples across traits -> `compare_matrix`

### 2. When not to use canvas

The prompt should tell the tutor:
- do not force the board for simple verbal checks
- do not open a canvas just because one exists
- choose voice-only when the task is faster, clearer, and equally assessable without the board

### 3. Instruction style

The prompt should require canvas instructions to be:
- short
- concrete
- single-step when possible
- naturally spoken
- free of robotic UI narration

Good style:
- "Tap the part of the flower where pollen is made."
- "Place these events in the order they happened."
- "Drag the shared traits into the center."

Bad style:
- "Please interact with the board to continue."
- "Use the available canvas tools to complete the task."

### 4. Canvas lifecycle

The prompt should explicitly use the existing lifecycle contract:
- `replace` for a new board task
- `keep` when continuing the same board
- `clear` when the board is no longer useful

### 5. Evidence use

The prompt should require the tutor to inspect what the learner actually submitted.

The tutor should:
- name what is correct
- name what is misplaced or missing
- react to the exact learner evidence
- decide whether to:
  - re-ask
  - give a hint
  - narrow the task
  - reveal part of the answer
  - switch modes
  - continue with voice

The tutor should not:
- ignore a submission and continue generically
- say "good job" without evidence
- restate the original instruction as if no submission happened

### 6. Tone rules inside the prompt

The prompt should explicitly say:
- be warm and encouraging
- do not sound like a worksheet engine
- use energy sparingly and naturally
- avoid repetitive hype language such as constant "let's go"
- when the learner is confused, lower pressure and become more concrete

## State and Runtime Design

Implementation should keep the runtime generic rather than special-casing each subject.

### 1. Type system

Expected design direction:
- extend `TutorCanvasMode`
- add per-mode state interfaces
- add per-mode command types for setup and clearing
- keep a shared canvas action contract: `keep | replace | clear`

### 2. Submission envelope

Expected design direction:
- every submission should include:
  - `mode`
  - structured evidence for that mode
  - optional summary for prompt/debug readability

Examples:
- `image_hotspot` -> hotspot ids, click coordinates
- `timeline` -> ordered item ids
- `continuous_axis` -> value and optional confidence/range
- `process_flow` -> node order and edge connections

### 3. Tutor canvas host structure

Expected design direction:
- avoid one massive mode host file growing indefinitely
- split each core canvas into focused render/interaction modules
- keep shared wrappers and submit plumbing separate from mode-specific UI

Why:
- easier testing
- easier future expansion
- aligns with the repo rule to keep files reasonably small and focused

### 4. Evidence-aware summarization

Expected design direction:
- each mode should have a concise evidence summary path for prompt/debug logs
- summary should be human-readable without throwing away structured detail

## Testing

Implementation should add or update tests for:
- runtime command application for each new mode
- tutor prompt coverage for:
  - selection rubric
  - lifecycle rules
  - evidence use
  - tone rules
- canvas host interaction and submission payloads
- route-level forwarding of new evidence to the tutor model
- regressions where:
  - the tutor opens the wrong board
  - stale board state leaks into a new task
  - learner submissions are ignored or flattened

## Risks

### 1. Widget zoo

Risk:
- too many bespoke interactions with no shared mental model

Mitigation:
- keep the 3-subject rule
- prefer generic primitives
- phase implementation instead of shipping everything at once

### 2. Prompt bloat

Risk:
- a huge prompt that names modes but does not teach judgment

Mitigation:
- include a compact rubric and a few high-quality examples
- prioritize decision rules over giant descriptions

### 3. Over-gamification

Risk:
- flashy but shallow tutor behavior

Mitigation:
- keep flashcard and true/false lightweight
- make liveliness come from interaction quality, not streak systems

### 4. Host-file sprawl

Risk:
- one giant render component becomes unreadable and brittle

Mitigation:
- split per-mode components early
- keep shared submission plumbing separate

## Alternatives Considered

### 1. Subject packs first

Rejected.

Why:
- duplicates logic
- teaches the model too many special cases
- scales poorly

### 2. Mini-games first

Rejected.

Why:
- good demo energy
- weak tutor depth
- poor evidence richness

### 3. Diagram-only expansion

Rejected.

Why:
- would leave language, civics, economics, and reasoning tasks underpowered

### 4. Reasoning-only expansion

Rejected.

Why:
- would leave strong science/geography visual teaching underpowered

## Chosen Approach

Best approach:
- keep live tutor as the only product mode
- build reusable core canvases plus lightweight skins
- start with the highest-leverage mixed wave
- design the tutor system prompt as a real canvas-judgment contract
- make the tutor warm and clear without drifting into pushy hype

Why this is best:
- covers all requested interaction ideas without collapsing the runtime
- fits the current architecture
- supports both visual and reasoning subjects
- keeps the model in control of the teaching flow
- gives implementation a clean phase order instead of a giant all-at-once rewrite
