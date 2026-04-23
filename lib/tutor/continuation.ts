import { summarizeTutorCanvas } from '@/lib/tutor/runtime';
import type {
  TutorContinuationContext,
  TutorContinuationNotes,
  TutorRuntimeSnapshot,
} from '@/lib/types/tutor';

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildFallbackResumeHint(snapshot: TutorRuntimeSnapshot, notes: Partial<TutorContinuationNotes>) {
  const firstWeakness = cleanList(notes.weaknesses)[0];
  if (firstWeakness) {
    return `Resume by fixing this weak spot first: ${firstWeakness}`;
  }

  const firstNextStep = cleanList(notes.recommendedNextSteps)[0];
  if (firstNextStep) {
    return firstNextStep;
  }

  const firstOutlineItem = snapshot.lessonOutline[0]?.trim();
  if (firstOutlineItem) {
    return `Pick up from this next focus: ${firstOutlineItem}`;
  }

  return `Continue ${snapshot.lessonTopic || snapshot.prompt} from the most recent point of progress.`;
}

export function buildTutorContinuationContext(args: {
  snapshot: TutorRuntimeSnapshot;
  articleId?: string | null;
  notes?: Partial<TutorContinuationNotes> | null;
}): TutorContinuationContext {
  const { snapshot } = args;
  const notes = args.notes ?? {};

  return {
    sourceSessionId: snapshot.sessionId,
    sourceArticleId: args.articleId ?? null,
    topic: snapshot.lessonTopic || snapshot.prompt,
    learnerLevel: snapshot.learnerLevel,
    outline: [...snapshot.lessonOutline],
    turns: snapshot.turns.map((turn) => ({
      ...turn,
      canvasInteraction: turn.canvasInteraction ?? null,
    })),
    mediaAssets: snapshot.mediaAssets.map((asset) => ({ ...asset })),
    activeImageId: snapshot.activeImageId,
    canvasSummary: summarizeTutorCanvas(snapshot.canvas),
    canvas: snapshot.canvas,
    strengths: cleanList(notes.strengths),
    weaknesses: cleanList(notes.weaknesses),
    recommendedNextSteps: cleanList(notes.recommendedNextSteps),
    resumeHint:
      cleanText(notes.resumeHint) ?? buildFallbackResumeHint(snapshot, notes),
    completedAt: new Date().toISOString(),
  };
}

export function buildTutorContinuationPromptContext(
  context: TutorContinuationContext | null | undefined,
  options: {
    includeTurns?: boolean;
    maxTurns?: number;
  } = {}
) {
  if (!context) {
    return 'No continuation context.';
  }

  const turns =
    options.includeTurns && context.turns.length > 0
      ? context.turns
          .slice(
            options.maxTurns && options.maxTurns > 0
              ? Math.max(0, context.turns.length - options.maxTurns)
              : 0
          )
          .map((turn) => `${turn.actor}: ${turn.text}`)
          .join('\n')
      : 'Not included for this prompt.';

  const imageContext = context.mediaAssets.length
    ? context.mediaAssets
        .map((asset, index) => `${index}: ${asset.id} | ${asset.altText} | ${asset.description}`)
        .join('\n')
    : 'No prior lesson images.';

  return [
    `Continuation source session: ${context.sourceSessionId}`,
    `Continuation source article: ${context.sourceArticleId || 'none'}`,
    `Prior topic: ${context.topic}`,
    `Prior learner level: ${context.learnerLevel}`,
    `Prior outline:\n- ${context.outline.join('\n- ') || 'none'}`,
    `Prior strengths:\n- ${context.strengths.join('\n- ') || 'none'}`,
    `Prior weaknesses:\n- ${context.weaknesses.join('\n- ') || 'none'}`,
    `Recommended next steps:\n- ${context.recommendedNextSteps.join('\n- ') || 'none'}`,
    `Resume hint: ${context.resumeHint}`,
    `Prior active image id: ${context.activeImageId || 'none'}`,
    `Prior images:\n${imageContext}`,
    `Final canvas summary: ${context.canvasSummary}`,
    `Prior transcript:\n${turns}`,
  ].join('\n');
}
