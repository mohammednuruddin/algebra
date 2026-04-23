# Image Hotspot Retired in Favor of Drawing

## Date
2026-04-23

## Read When
- tutor prompt changes around point-on-image tasks
- model starts emitting `set_image_hotspot` again
- image-identification tasks feel weaker than drawing markup tasks

## Decision

The live tutor should no longer be prompted to use `image_hotspot` for point-on-image tasks.

Use `set_drawing` instead when the learner needs to:
- point
- circle
- mark
- trace
- identify a region on an image or diagram

## Why

- drawing is already stronger and more flexible for these tasks
- learner evidence is richer
- prompt guidance becomes simpler
- it avoids steering the tutor toward a weaker tool path

## What Changed

- removed `image_hotspot` from the tutor system prompt guidance
- removed `set_image_hotspot` from the tutor-allowed command list in the prompt contract
- removed `image_hotspot` from the prompt’s canvas mode descriptions
- updated prompt tests so image-pointing guidance prefers `drawing`

## Notes

- runtime/type support may still exist for compatibility, but the tutor prompt should treat drawing as the preferred path
- no new fallback added
