read_when: live tutor sounds sterile, mechanical, or worksheet-like instead of warm, empathetic, and human.

# Live tutor personality port from Zo

## Problem

The algebra live tutor was teaching content, but it had almost no personality.

Symptoms:

- too clinical
- too worksheet-like
- not enough empathy when the learner was confused
- little warmth or playful energy
- did not feel like the `zo` tutor

## Root cause

The tutor prompts focused almost entirely on:

- command correctness
- canvas alignment
- task progression

But they lacked an explicit tutor identity/personality contract like `zo` has in its prompt builder and shared tutor policy.

`zo` explicitly frames the tutor as:

- warm
- encouraging
- adaptive to learner mood and personality
- playful when appropriate
- human and conversational

Algebra mostly framed the tutor as a task engine.

## What changed

Added a reusable live-tutor personality guidance block in:

- [lib/tutor/model.ts](/Users/nuru/sanchrobytes/algebra/lib/tutor/model.ts:52)

That guidance now tells the model to be:

- warm
- encouraging
- emotionally aware
- lightly playful when it fits
- compassionate when the learner is confused or frustrated
- non-robotic and non-worksheet-like

Applied this personality guidance to:

- lesson preparation prompt
- opening live tutor turn prompt
- normal live tutor turn prompt
- non-model fallback phrasing

## Before

- tutor: “Good. Keep going.”
- felt cold and generic

## After

- tutor is instructed to sound like a kind human coach
- validates confusion briefly
- lowers pressure when learner is stuck
- celebrates correct progress naturally
- uses more vivid and conversational phrasing

## Tests

- `lib/tutor/model.test.ts`
  - lesson preparation prompt includes warm human opening guidance
  - opening tutor prompt includes Zo-like personality contract
  - turn prompt includes warmth, empathy, and playful guidance

## Alternatives considered

### 1. Add random praise phrases in UI/runtime

Rejected.

Reason:
- fake
- brittle
- would not improve actual teaching style

### 2. Only patch fallback strings

Rejected.

Reason:
- the real issue was the model contract, not only fallback wording

### 3. Full `zo` prompt-builder transplant

Rejected for now.

Reason:
- much bigger architecture import
- not necessary to fix the missing personality seam

## Why this approach is best

Best tradeoff:

- ports the soul of `zo` without importing the whole backend architecture
- keeps existing tutor runtime intact
- improves preparation, opening, and normal turns consistently
- easy to verify with prompt-level regression tests

## Fallbacks

- No new fallback added.
- Existing fallback wording was made warmer so it does not break personality parity when fallback happens.
