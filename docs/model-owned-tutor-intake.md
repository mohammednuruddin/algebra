# Model-Owned Tutor Intake

## What changed

The tutor no longer starts with a frontend-owned onboarding wizard that scripts
the opening lines and then hands those lines to TTS.

Instead:

- the page auto-starts a tutor session
- the backend generates the first intake question
- the learner replies in the normal tutor loop
- the backend can ask one natural follow-up question when needed
- the lesson starts only after the model has enough context

## What it was before

The old flow used a fixed `welcome -> topic -> level` stage machine in the UI.
That component decided what the tutor "said", and TTS only read those
hardcoded strings aloud.

## What it is now

The tutor API owns the opening conversation. The UI only renders model-authored
speech and forwards learner replies back through the same turn pipeline.

This keeps the intake behavior closer to the live tutor architecture:

- model decides whether to ask another question
- model can infer learner level from the learner's wording
- tutor transitions into the real lesson from the same conversation flow

## Notes

- Tutor responses now carry only the main spoken line plus turn-control fields.
  The tutor model prompt, parser, and snapshot contract no longer include
  helper text or title.
- Intake snapshots now also carry the next expected handoff action so the UI
  can distinguish normal "thinking" from the final "preparing your lesson"
  transition.
- No new fallback prompts were added for the scripted intake.
- Existing lesson-start fallbacks still exist in the tutor model for broader
  session resilience, but the removed onboarding wizard no longer supplies the
  first spoken lines.
