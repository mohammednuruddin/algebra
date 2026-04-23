import { NextRequest, NextResponse } from 'next/server';

import { queueTutorGeneratedImages } from '@/lib/media/generated-image-bootstrap';
import { searchLessonImages } from '@/lib/media/lesson-image-search';
import {
  generateInitialTutorResponse,
  generateLessonPreparation,
  generateTutorIntakeTurn,
  generateTutorTurn,
} from '@/lib/tutor/model';
import {
  buildTutorCanvasStateContext,
  buildTutorLatestLearnerTurnContext,
  buildTutorRecentTurnFrames,
  coalesceTutorCanvasInteraction,
  mergeTutorCanvasStateWithInteraction,
} from '@/lib/tutor/prompt-context';
import {
  applyTutorCommands,
  applyTutorMediaCommands,
  createEmptyTutorCanvasState,
  createTutorSnapshot,
  summarizeTutorCanvas,
} from '@/lib/tutor/runtime';
import type {
  TutorCanvasEvidence,
  TutorCanvasInteraction,
  TutorRuntimeSnapshot,
  TutorTurnResponse,
} from '@/lib/types/tutor';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      snapshot?: TutorRuntimeSnapshot;
      transcript?: string;
      canvasEvidence?: TutorCanvasEvidence | null;
      canvasInteraction?: TutorCanvasInteraction | null;
    };

    const snapshot = body.snapshot;
    const transcript = body.transcript?.trim() || '';
    const canvasEvidence = body.canvasEvidence || null;
    const canvasInteraction = coalesceTutorCanvasInteraction({
      transcript,
      canvasInteraction: body.canvasInteraction || null,
      canvasEvidence,
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }

    const effectiveCanvas = mergeTutorCanvasStateWithInteraction(
      snapshot.canvas,
      canvasInteraction
    );
    const canvasSummary = summarizeTutorCanvas(effectiveCanvas);
    const recentTurns = snapshot.turns
      .slice(-6)
      .map((turn) => `${turn.actor}: ${turn.text}`)
      .join('\n');
    const canvasStateContext = buildTutorCanvasStateContext(
      snapshot.canvas,
      canvasInteraction
    );
    const latestLearnerTurnContext = buildTutorLatestLearnerTurnContext({
      transcript,
      canvasInteraction,
      canvasEvidence,
    });
    const recentTurnFrames = buildTutorRecentTurnFrames(snapshot.turns);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[tutor:turn_request] learner input', {
        transcript,
        canvasMode: snapshot.canvas.mode,
        canvasInteraction,
        hasCanvasEvidence: Boolean(canvasEvidence?.dataUrl),
        canvasEvidenceMode: canvasEvidence?.mode ?? null,
        canvasEvidenceSummary: canvasEvidence?.summary ?? null,
      });
    }

    const intakeIsActive =
      snapshot.intake?.status === 'active' || !snapshot.lessonTopic.trim();

    if (intakeIsActive) {
      const intakeResult = await generateTutorIntakeTurn({
        stage: 'turn',
        history: snapshot.turns.map((turn) => ({
          actor: turn.actor,
          text: turn.text,
        })),
        latestUserMessage: transcript,
        topic: snapshot.intake?.topic,
        learnerLevel:
          snapshot.intake?.learnerLevel ||
          (snapshot.learnerLevel !== 'unknown' ? snapshot.learnerLevel : null),
      });

      const userTurn = {
        actor: 'user' as const,
        text: transcript,
        createdAt: new Date().toISOString(),
        canvasSummary,
        canvasInteraction,
      };

      if (intakeResult.response.readyToStartLesson && intakeResult.response.topic) {
        const nextTopic = intakeResult.response.topic;
        const nextLearnerLevel =
          intakeResult.response.learnerLevel ||
          snapshot.intake?.learnerLevel ||
          (snapshot.learnerLevel !== 'unknown' ? snapshot.learnerLevel : 'unknown');
        const preparation = await generateLessonPreparation({
          topic: nextTopic,
          learnerLevel: nextLearnerLevel,
        });
        const imageSearchResult = await searchLessonImages({
          topic: nextTopic,
          searchQuery: preparation.imageSearchQuery,
          desiredCount: preparation.desiredImageCount,
        });

        void queueTutorGeneratedImages({
          sessionId: snapshot.sessionId,
          topic: nextTopic,
          learnerLevel: nextLearnerLevel,
          outline: preparation.outline,
          imageAssets: imageSearchResult.assets,
          origin: new URL(request.url).origin,
        }).catch((queueError) => {
          console.error('[tutor:image-bootstrap] Failed to queue generated images during intake handoff', {
            sessionId: snapshot.sessionId,
            topic: nextTopic,
            error: queueError instanceof Error ? queueError.message : String(queueError),
          });
        });

        const modelResult = await generateInitialTutorResponse({
          topic: nextTopic,
          learnerLevel: nextLearnerLevel,
          outline: preparation.outline,
          imageAssets: imageSearchResult.assets,
          openingSpeech: preparation.openingSpeech,
        });

        const activeImageId = applyTutorMediaCommands({
          currentActiveImageId: null,
          mediaAssets: imageSearchResult.assets,
          commands: modelResult.response.commands,
        });
        const applied = applyTutorCommands(
          createEmptyTutorCanvasState(),
          modelResult.response.commands,
          {
            canvasAction: modelResult.response.canvasAction,
            mediaAssets: imageSearchResult.assets,
            defaultImageId: activeImageId,
          }
        );

        const nextSnapshot = createTutorSnapshot({
          sessionId: snapshot.sessionId,
          prompt: nextTopic,
          lessonTopic: nextTopic,
          learnerLevel: nextLearnerLevel,
          lessonOutline: preparation.outline,
          speech: modelResult.response.speech,
          awaitMode: modelResult.response.awaitMode,
          mediaAssets: imageSearchResult.assets,
          activeImageId,
          canvas: applied.canvas,
          turns: [
            ...snapshot.turns,
            userTurn,
            {
              actor: 'tutor' as const,
              text: modelResult.response.speech,
              createdAt: new Date().toISOString(),
            },
          ],
          intake: null,
          continuation: null,
          status:
            applied.sessionComplete || modelResult.response.sessionComplete
              ? 'completed'
              : 'active',
          speechRevision: snapshot.speechRevision + 1,
        });

        return NextResponse.json(
          {
            snapshot: nextSnapshot,
            ...(process.env.NODE_ENV === 'production' ? {} : { debug: modelResult.debug }),
          } satisfies TutorTurnResponse,
          {
            headers: {
              'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
          }
        );
      }

      const nextLearnerLevel =
        intakeResult.response.learnerLevel ||
        snapshot.intake?.learnerLevel ||
        (snapshot.learnerLevel !== 'unknown' ? snapshot.learnerLevel : null);
      const nextSnapshot = createTutorSnapshot({
        sessionId: snapshot.sessionId,
        prompt: snapshot.prompt,
        lessonTopic: '',
        learnerLevel: nextLearnerLevel || 'unknown',
        lessonOutline: [],
        speech: intakeResult.response.speech,
        awaitMode: intakeResult.response.awaitMode,
        mediaAssets: [],
        activeImageId: null,
        canvas: snapshot.canvas,
        turns: [
          ...snapshot.turns,
          userTurn,
          {
            actor: 'tutor' as const,
            text: intakeResult.response.speech,
            createdAt: new Date().toISOString(),
          },
        ],
        intake: {
          status: 'active',
          topic: intakeResult.response.topic || snapshot.intake?.topic || null,
          learnerLevel: nextLearnerLevel,
        },
        continuation: null,
        status: 'active',
        speechRevision: snapshot.speechRevision + 1,
      });

      return NextResponse.json(
        {
          snapshot: nextSnapshot,
          ...(process.env.NODE_ENV === 'production' ? {} : { debug: intakeResult.debug }),
        } satisfies TutorTurnResponse,
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    const modelResult = await generateTutorTurn({
      topic: snapshot.lessonTopic,
      learnerLevel: snapshot.learnerLevel,
      outline: snapshot.lessonOutline,
      imageAssets: snapshot.mediaAssets,
      activeImageId: snapshot.activeImageId,
      continuationContext: snapshot.continuation,
      transcript,
      canvasSummary,
      canvasStateContext,
      latestLearnerTurnContext,
      recentTurnFrames,
      recentTurns,
      canvasTaskPrompt:
        snapshot.canvas.mode === 'drawing' ? snapshot.canvas.drawing?.prompt ?? null : null,
      canvasReferenceImageUrl:
        snapshot.canvas.mode === 'drawing'
          ? snapshot.canvas.drawing?.backgroundImageUrl ?? null
          : null,
      canvasBrushColor:
        snapshot.canvas.mode === 'drawing'
          ? snapshot.canvas.drawing?.brushColor ?? null
          : null,
      canvasEvidence,
    });

    const activeImageId = applyTutorMediaCommands({
      currentActiveImageId: snapshot.activeImageId,
      mediaAssets: snapshot.mediaAssets,
      commands: modelResult.response.commands,
    });
    const applied = applyTutorCommands(snapshot.canvas, modelResult.response.commands, {
      canvasAction: modelResult.response.canvasAction,
      mediaAssets: snapshot.mediaAssets,
      defaultImageId: activeImageId,
    });
    const turns = [
      ...snapshot.turns,
      {
        actor: 'user' as const,
        text: transcript,
        createdAt: new Date().toISOString(),
        canvasSummary,
        canvasInteraction,
      },
      {
        actor: 'tutor' as const,
        text: modelResult.response.speech,
        createdAt: new Date().toISOString(),
      },
    ];

    const nextSnapshot = createTutorSnapshot({
      sessionId: snapshot.sessionId,
      prompt: snapshot.prompt,
      lessonTopic: snapshot.lessonTopic,
      learnerLevel: snapshot.learnerLevel,
      lessonOutline: snapshot.lessonOutline,
      speech: modelResult.response.speech,
      awaitMode: modelResult.response.awaitMode,
      mediaAssets: snapshot.mediaAssets,
      activeImageId,
      canvas: applied.canvas,
      turns,
      intake: snapshot.intake,
      continuation: snapshot.continuation,
      status:
        applied.sessionComplete || modelResult.response.sessionComplete ? 'completed' : 'active',
      speechRevision: snapshot.speechRevision + 1,
    });

    return NextResponse.json(
      {
        snapshot: nextSnapshot,
        ...(process.env.NODE_ENV === 'production' ? {} : { debug: modelResult.debug }),
      } satisfies TutorTurnResponse,
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process tutor turn',
      },
      { status: 500 }
    );
  }
}
