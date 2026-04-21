import { NextRequest, NextResponse } from 'next/server';

import { generateTutorTurn } from '@/lib/tutor/model';
import {
  applyTutorCommands,
  applyTutorMediaCommands,
  createTutorSnapshot,
  summarizeTutorCanvas,
} from '@/lib/tutor/runtime';
import type { TutorRuntimeSnapshot, TutorTurnResponse } from '@/lib/types/tutor';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      snapshot?: TutorRuntimeSnapshot;
      transcript?: string;
    };

    const snapshot = body.snapshot;
    const transcript = body.transcript?.trim() || '';

    if (!snapshot) {
      return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }

    const canvasSummary = summarizeTutorCanvas(snapshot.canvas);
    const recentTurns = snapshot.turns
      .slice(-6)
      .map((turn) => `${turn.actor}: ${turn.text}`)
      .join('\n');

    const modelResult = await generateTutorTurn({
      topic: snapshot.lessonTopic,
      learnerLevel: snapshot.learnerLevel,
      outline: snapshot.lessonOutline,
      imageAssets: snapshot.mediaAssets,
      activeImageId: snapshot.activeImageId,
      transcript,
      canvasSummary,
      recentTurns,
    });

    const applied = applyTutorCommands(snapshot.canvas, modelResult.response.commands);
    const activeImageId = applyTutorMediaCommands({
      currentActiveImageId: snapshot.activeImageId,
      mediaAssets: snapshot.mediaAssets,
      commands: modelResult.response.commands,
    });
    const turns = [
      ...snapshot.turns,
      {
        actor: 'user' as const,
        text: transcript,
        createdAt: new Date().toISOString(),
        canvasSummary,
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
      title: modelResult.response.title || snapshot.title,
      speech: modelResult.response.speech,
      helperText: modelResult.response.helperText,
      awaitMode: modelResult.response.awaitMode,
      mediaAssets: snapshot.mediaAssets,
      activeImageId,
      canvas: applied.canvas,
      turns,
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
