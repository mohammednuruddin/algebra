import type {
  TutorGeneratedImageEdits,
  TutorGeneratedImageMetadata,
  TutorGeneratedImageSwap,
  TutorMediaAsset,
} from '@/lib/types/tutor';

function normalizePromptText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeContextText(value: string) {
  return normalizePromptText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLabel(value: unknown) {
  return typeof value === 'string' ? normalizePromptText(value) : '';
}

function normalizeContextLabel(value: unknown) {
  return escapeContextText(normalizeLabel(value));
}

function normalizeStructuredContextLabel(value: unknown) {
  return normalizeLabel(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function normalizeSwapEntry(
  value: unknown,
  normalizeValue: (input: unknown) => string
): TutorGeneratedImageSwap | null {
  if (!isRecord(value)) {
    return null;
  }

  const from = normalizeValue(value.from);
  const to = normalizeValue(value.to);

  if (!from || !to) {
    return null;
  }

  return { from, to };
}

function normalizeStringArray(
  value: unknown,
  normalizeValue: (input: unknown) => string
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => normalizeValue(item))
    .filter((item): item is string => item.length > 0);
}

function normalizeSwapArray(
  value: unknown,
  normalizeValue: (input: unknown) => string
) {
  if (!Array.isArray(value)) {
    return [] as TutorGeneratedImageSwap[];
  }

  return value
    .map((item) => normalizeSwapEntry(item, normalizeValue))
    .filter((item): item is TutorGeneratedImageSwap => item !== null);
}

function normalizeEditsForPrompt(edits: TutorGeneratedImageEdits) {
  return {
    remove: normalizeStringArray(edits.remove, normalizeLabel),
    swap: normalizeSwapArray(edits.swap, normalizeLabel),
  };
}

function normalizeMetadataEditsForContext(metadata: TutorGeneratedImageMetadata) {
  const requested = isRecord(metadata.requestedEdits) ? metadata.requestedEdits : null;
  const verified = isRecord(metadata.verifiedEdits) ? metadata.verifiedEdits : null;

  return {
    requested: {
      remove: normalizeStringArray(requested?.remove, normalizeStructuredContextLabel),
      swap: normalizeSwapArray(requested?.swap, normalizeStructuredContextLabel),
    },
    verified: {
      remove: normalizeStringArray(
        verified?.removedLabelsVerified,
        normalizeStructuredContextLabel
      ),
      swap: normalizeSwapArray(verified?.swappedLabelsVerified, normalizeStructuredContextLabel),
    },
  };
}

function serializeEdits(value: { remove: string[]; swap: TutorGeneratedImageSwap[] }) {
  if (value.remove.length === 0 && value.swap.length === 0) {
    return null;
  }

  return JSON.stringify(value);
}

function isGeneratedImageMetadata(
  metadata: TutorMediaAsset['metadata']
): metadata is TutorGeneratedImageMetadata {
  return metadata?.assetKind === 'generated';
}

export function buildQuizVariantPrompt(edits: TutorGeneratedImageEdits) {
  const normalizedEdits = normalizeEditsForPrompt(edits);
  const actionLines = [
    ...normalizedEdits.remove.map(
      (label, index) => `${index + 1}. Remove label ${JSON.stringify({ label })}`
    ),
    ...normalizedEdits.swap.map(
      (entry, index) =>
        `${normalizedEdits.remove.length + index + 1}. Swap label ${JSON.stringify(entry)}`
    ),
  ];

  return [
    'Use this image as the exact base image for a quiz variant.',
    '',
    'Apply only these changes:',
    ...actionLines,
    '',
    'Do not change anything else.',
    'Preserve the rest of the image exactly.',
    'This image was already taught to the learner. The goal is to quiz memory and understanding.',
  ].join('\n');
}

export function formatTutorImageContextLine(asset: TutorMediaAsset) {
  const parts = [asset.id, asset.altText, asset.description].map(normalizeContextLabel);

  if (!isGeneratedImageMetadata(asset.metadata)) {
    return parts.join(' | ');
  }

  const edits = normalizeMetadataEditsForContext(asset.metadata);
  const requestedEdits = serializeEdits(edits.requested);
  const verifiedEdits = serializeEdits(edits.verified);
  const metadataParts = [
    normalizeContextLabel(asset.metadata.assetKind),
    `generation: ${normalizeContextLabel(asset.metadata.generationKind)}`,
    asset.metadata.variantKind ? `variant: ${normalizeContextLabel(asset.metadata.variantKind)}` : null,
    asset.metadata.baseImageId
      ? `base image: ${normalizeContextLabel(asset.metadata.baseImageId)}`
      : null,
    requestedEdits ? `requested edits: ${requestedEdits}` : null,
    verifiedEdits ? `verified edits: ${verifiedEdits}` : null,
    asset.metadata.suggestedUse
      ? `suggested use: ${normalizeContextLabel(asset.metadata.suggestedUse)}`
      : null,
  ].filter(Boolean);

  return [...parts, ...metadataParts].join(' | ');
}
