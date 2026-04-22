# Tutor Prompt: Answer Validation and Anti-Loop Fix

## Problem

The live tutor model was exhibiting poor behavior in conversation:

1. **Giving away answers**: Including the answer in question prompts like `(Answer: it moves pollen from flower to flower.)`
2. **Not validating correct answers**: When learner answered correctly, model didn't acknowledge it and instead asked another similar question
3. **Repetitive loops**: Getting stuck asking variations of the same question instead of progressing through the lesson

### Example from logs

```
User: "So why are you telling me the answer?"
Model: "Nice—let's clear up the confusion... can you say that in your own words?"
User: "So the pollen is moved from the first flower to the other flower."
Model: "Great catch—I'm not trying to trick you... In one sentence, explain what pollen is doing and where it needs to go."
```

The user gave a correct answer but the model didn't validate it and asked yet another question about the same concept.

## Root Cause

The system prompt in `lib/tutor/model.ts` had rule (9): "When the learner answers, give immediate feedback: say whether they are right, explain why, then move forward."

However, this wasn't strong enough to prevent:
- Including answers in prompts
- Failing to recognize correct answers
- Re-questioning the same concept after a correct answer

## Solution

Modified the system prompt in `lib/tutor/model.ts` (line 1087) to add explicit constraints:

### Changes to Rule (9)
**Before:**
```
(9) When the learner answers, give immediate feedback: say whether they are right, explain why, then move forward.
```

**After:**
```
(9) When the learner answers, give immediate feedback: say whether they are right, explain why, then move forward. If their answer is correct or substantially correct, acknowledge it and progress to the next concept. Do NOT ask another question about the same concept after a correct answer.
```

### New Rule (10)
```
(10) NEVER include the answer in your question prompt. Do not say "(Answer: ...)" or give away the solution. Let the learner think and respond.
```

### Updated Rule (11)
Renumbered from (10), added stronger language:
```
(11) Progress through the lesson outline — do not get stuck repeating the same question or asking variations of the same question. Move to new material after the learner demonstrates understanding.
```

All subsequent rules renumbered accordingly.

## Alternative Approaches Considered

1. **Post-processing validation**: Add logic to detect if the model included answers in prompts and strip them.
   - Rejected: This is a band-aid. The model should learn to not do this from the prompt.

2. **Answer extraction and validation**: Parse the learner's answer and compare to expected answers, then force the model to acknowledge correctness.
   - Rejected: Too complex, would require maintaining answer keys for every possible question. The model should be able to recognize correct answers naturally.

3. **Conversation state tracking**: Track if a question has been asked and answered correctly, then prevent re-asking.
   - Rejected: Adds state complexity. Better to fix the model's behavior through prompt engineering.

## Why This Approach Is Best

- **Minimal change**: Only modifies the system prompt, no code logic changes
- **Addresses root cause**: Fixes the model's behavior at the source rather than working around symptoms
- **Scalable**: Applies to all tutoring sessions, not just specific cases
- **Maintains flexibility**: Model still has freedom to teach, just with clearer constraints

## Testing

The fix addresses the specific failure case shown in logs. To verify:
1. Start a tutor session
2. Answer a question correctly
3. Model should acknowledge correctness and move to next concept
4. Model should not include answers in question prompts
