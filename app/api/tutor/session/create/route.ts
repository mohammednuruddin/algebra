import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { searchLessonImages } from '@/lib/media/lesson-image-search';
import {
  generateInitialTutorResponse,
  generateLessonPreparation,
  generateTutorIntakeTurn,
} from '@/lib/tutor/model';
import {
  applyTutorCommands,
  applyTutorMediaCommands,
  createEmptyTutorCanvasState,
  createTutorSnapshot,
} from '@/lib/tutor/runtime';
import type {
  TutorContinuationContext,
  TutorSessionCreateResponse,
} from '@/lib/types/tutor';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      learnerLevel?: string;
      prompt?: string;
      continuationContext?: TutorContinuationContext | null;
    };
    const continuationContext = body.continuationContext ?? null;
    const topic =
      body.topic?.trim() ||
      body.prompt?.trim() ||
      continuationContext?.topic?.trim() ||
      '';
    const learnerLevel =
      body.learnerLevel?.trim() ||
      continuationContext?.learnerLevel?.trim() ||
      'unknown';
    const sessionId = `tutor_${randomUUID()}`;

    if (!topic && !continuationContext) {
      const intakeResult = await generateTutorIntakeTurn({
        stage: 'session_create',
        history: [],
        latestUserMessage: null,
        topic: null,
        learnerLevel: null,
      });

      const snapshot = createTutorSnapshot({
        sessionId,
        prompt: '',
        lessonTopic: '',
        learnerLevel: intakeResult.response.learnerLevel || 'unknown',
        speech: intakeResult.response.speech,
        awaitMode: intakeResult.response.awaitMode,
        mediaAssets: [],
        activeImageId: null,
        canvas: createEmptyTutorCanvasState(),
        turns: [
          {
            actor: 'tutor',
            text: intakeResult.response.speech,
            createdAt: new Date().toISOString(),
          },
        ],
        intake: {
          status: 'active',
          topic: intakeResult.response.topic,
          learnerLevel: intakeResult.response.learnerLevel,
        },
        continuation: null,
        status: 'active',
        speechRevision: 1,
      });

      return NextResponse.json(
        {
          snapshot,
          ...(process.env.NODE_ENV === 'production' ? {} : { debug: intakeResult.debug }),
        } satisfies TutorSessionCreateResponse,
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    const preparation = await generateLessonPreparation({
      topic,
      learnerLevel,
      continuationContext,
    });
    const imageAssets =
      continuationContext?.mediaAssets && continuationContext.mediaAssets.length > 0
        ? continuationContext.mediaAssets
        : (
            await searchLessonImages({
              topic,
              searchQuery: preparation.imageSearchQuery,
              desiredCount: preparation.desiredImageCount,
            })
          ).assets;
    const modelResult = await generateInitialTutorResponse({
      topic,
      learnerLevel,
      outline: preparation.outline,
      imageAssets,
      openingSpeech: preparation.openingSpeech,
      continuationContext,
    });
    const activeImageId = applyTutorMediaCommands({
      currentActiveImageId: continuationContext?.activeImageId ?? null,
      mediaAssets: imageAssets,
      commands: modelResult.response.commands,
    });
    const canvasResult = applyTutorCommands(
      createEmptyTutorCanvasState(),
      modelResult.response.commands,
      {
        canvasAction: modelResult.response.canvasAction,
        mediaAssets: imageAssets,
        defaultImageId: activeImageId,
      }
    );

    const snapshot = createTutorSnapshot({
      sessionId,
      prompt: topic,
      lessonTopic: topic,
      learnerLevel,
      lessonOutline: preparation.outline,
      speech: modelResult.response.speech,
      awaitMode: modelResult.response.awaitMode,
      mediaAssets: imageAssets,
      activeImageId,
      canvas: canvasResult.canvas,
      turns: [
        {
          actor: 'tutor',
          text: modelResult.response.speech,
          createdAt: new Date().toISOString(),
        },
      ],
      intake: null,
      continuation: continuationContext,
      status: canvasResult.sessionComplete ? 'completed' : modelResult.response.status,
      speechRevision: 1,
    });

    return NextResponse.json(
      {
        snapshot,
        ...(process.env.NODE_ENV === 'production' ? {} : { debug: modelResult.debug }),
      } satisfies TutorSessionCreateResponse,
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create tutor session',
      },
      { status: 500 }
    );
  }
}
