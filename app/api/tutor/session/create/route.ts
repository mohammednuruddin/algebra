import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { searchLessonImages } from '@/lib/media/lesson-image-search';
import { generateInitialTutorResponse, generateLessonPreparation } from '@/lib/tutor/model';
import {
  applyTutorCommands,
  applyTutorMediaCommands,
  createEmptyTutorCanvasState,
  createTutorSnapshot,
} from '@/lib/tutor/runtime';
import type { TutorSessionCreateResponse } from '@/lib/types/tutor';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { topic?: string; learnerLevel?: string; prompt?: string };
    const topic = body.topic?.trim() || body.prompt?.trim() || '';
    const learnerLevel = body.learnerLevel?.trim() || 'starting from scratch';

    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    const sessionId = `tutor_${randomUUID()}`;
    const preparation = await generateLessonPreparation({
      topic,
      learnerLevel,
    });
    const imageSearchResult = await searchLessonImages({
      topic,
      searchQuery: preparation.imageSearchQuery,
      desiredCount: preparation.desiredImageCount,
    });
    const modelResult = await generateInitialTutorResponse({
      topic,
      learnerLevel,
      outline: preparation.outline,
      imageAssets: imageSearchResult.assets,
      openingSpeech: preparation.openingSpeech,
    });
    const canvasResult = applyTutorCommands(
      createEmptyTutorCanvasState(),
      modelResult.response.commands
    );
    const activeImageId = applyTutorMediaCommands({
      currentActiveImageId: null,
      mediaAssets: imageSearchResult.assets,
      commands: modelResult.response.commands,
    });

    const snapshot = createTutorSnapshot({
      sessionId,
      prompt: topic,
      lessonTopic: topic,
      learnerLevel,
      lessonOutline: preparation.outline,
      title: modelResult.response.title,
      speech: modelResult.response.speech,
      helperText: modelResult.response.helperText,
      awaitMode: modelResult.response.awaitMode,
      mediaAssets: imageSearchResult.assets,
      activeImageId,
      canvas: canvasResult.canvas,
      turns: [
        {
          actor: 'tutor',
          text: modelResult.response.speech,
          createdAt: new Date().toISOString(),
        },
      ],
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
