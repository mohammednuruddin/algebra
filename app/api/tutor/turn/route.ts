import { NextRequest, NextResponse } from 'next/server';

import { searchLessonImages } from '@/lib/media/lesson-image-search';
import { isMeaningfulTutorTranscript } from '@/lib/tutor/intake-heuristics';
import {
  generateInitialTutorResponse,
  generateLessonPreparation,
  generateTutorIntakeTurn,
  generateTutorTurn,
} from '@/lib/tutor/model';
import {
  applyTutorCommands,
  applyTutorMediaCommands,
  createEmptyTutorCanvasState,
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

    const intakeIsActive =
      snapshot.intake?.status === 'active' || !snapshot.lessonTopic.trim();

    if (intakeIsActive) {
      if (!isMeaningfulTutorTranscript(transcript)) {
        return NextResponse.json(
          { snapshot } satisfies TutorTurnResponse,
          {
            headers: {
              'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
          }
        );
      }

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
        const modelResult = await generateInitialTutorResponse({
          topic: nextTopic,
          learnerLevel: nextLearnerLevel,
          outline: preparation.outline,
          imageAssets: imageSearchResult.assets,
          openingSpeech: preparation.openingSpeech,
        });

        const applied = applyTutorCommands(
          createEmptyTutorCanvasState(),
          modelResult.response.commands
        );
        const activeImageId = applyTutorMediaCommands({
          currentActiveImageId: null,
          mediaAssets: imageSearchResult.assets,
          commands: modelResult.response.commands,
        });

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
      speech: modelResult.response.speech,
      awaitMode: modelResult.response.awaitMode,
      mediaAssets: snapshot.mediaAssets,
      activeImageId,
      canvas: applied.canvas,
      turns,
      intake: snapshot.intake,
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
