import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from './route';
import type { TutorCanvasState, TutorRuntimeSnapshot } from '@/lib/types/tutor';

const {
  mockGenerateTutorIntakeTurn,
  mockGenerateLessonPreparation,
  mockGenerateInitialTutorResponse,
  mockGenerateTutorTurn,
  mockSearchLessonImages,
  mockApplyTutorCommands,
  mockApplyTutorMediaCommands,
  mockCreateEmptyTutorCanvasState,
  mockCreateTutorSnapshot,
  mockSummarizeTutorCanvas,
} = vi.hoisted(() => ({
  mockGenerateTutorIntakeTurn: vi.fn(),
  mockGenerateLessonPreparation: vi.fn(),
  mockGenerateInitialTutorResponse: vi.fn(),
  mockGenerateTutorTurn: vi.fn(),
  mockSearchLessonImages: vi.fn(),
  mockApplyTutorCommands: vi.fn(),
  mockApplyTutorMediaCommands: vi.fn(),
  mockCreateEmptyTutorCanvasState: vi.fn(),
  mockCreateTutorSnapshot: vi.fn(),
  mockSummarizeTutorCanvas: vi.fn(),
}));

vi.mock('@/lib/tutor/model', () => ({
  generateTutorIntakeTurn: mockGenerateTutorIntakeTurn,
  generateLessonPreparation: mockGenerateLessonPreparation,
  generateInitialTutorResponse: mockGenerateInitialTutorResponse,
  generateTutorTurn: mockGenerateTutorTurn,
}));

vi.mock('@/lib/media/lesson-image-search', () => ({
  searchLessonImages: mockSearchLessonImages,
}));

vi.mock('@/lib/tutor/runtime', () => ({
  applyTutorCommands: mockApplyTutorCommands,
  applyTutorMediaCommands: mockApplyTutorMediaCommands,
  createEmptyTutorCanvasState: mockCreateEmptyTutorCanvasState,
  createTutorSnapshot: mockCreateTutorSnapshot,
  summarizeTutorCanvas: mockSummarizeTutorCanvas,
}));

const emptyCanvas: TutorCanvasState = {
  mode: 'distribution',
  headline: 'Tutor workspace',
  instruction: 'Listen and respond.',
  tokens: [],
  zones: [],
  equation: null,
  fillBlank: null,
  codeBlock: null,
  multipleChoice: null,
  numberLine: null,
  tableGrid: null,
  graphPlot: null,
  matchingPairs: null,
  ordering: null,
  textResponse: null,
  drawing: null,
};

function buildSnapshot(
  input: Partial<TutorRuntimeSnapshot> &
    Pick<TutorRuntimeSnapshot, 'sessionId' | 'prompt' | 'speech' | 'canvas'>
): TutorRuntimeSnapshot {
  return {
    sessionId: input.sessionId,
    prompt: input.prompt,
    lessonTopic: input.lessonTopic ?? input.prompt,
    learnerLevel: input.learnerLevel ?? 'unknown',
    lessonOutline: input.lessonOutline ?? [],
    status: input.status ?? 'active',
    speech: input.speech,
    awaitMode: input.awaitMode ?? 'voice',
    speechRevision: input.speechRevision ?? 1,
    mediaAssets: input.mediaAssets ?? [],
    activeImageId: input.activeImageId ?? null,
    canvas: input.canvas,
    turns: input.turns ?? [],
    intake: input.intake ?? null,
  };
}

describe('POST /api/tutor/turn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEmptyTutorCanvasState.mockReturnValue(emptyCanvas);
    mockCreateTutorSnapshot.mockImplementation(buildSnapshot);
    mockApplyTutorCommands.mockReturnValue({ canvas: emptyCanvas, sessionComplete: false });
    mockApplyTutorMediaCommands.mockReturnValue(null);
    mockSummarizeTutorCanvas.mockReturnValue('Empty canvas.');
  });

  it('can finish intake and start the real lesson from the same turn pipeline', async () => {
    mockGenerateTutorIntakeTurn.mockResolvedValue({
      response: {
        speech: 'Great, let us get started.',
        awaitMode: 'voice',
        readyToStartLesson: true,
        topic: 'linear equations',
        learnerLevel: 'needs the basics',
      },
      debug: {
        stage: 'turn',
        messages: [],
        rawResponseText: null,
        rawModelContent: null,
        parsedResponse: null,
        usedFallback: false,
        fallbackReason: null,
      },
    });
    mockGenerateLessonPreparation.mockResolvedValue({
      openingSpeech: 'I am preparing linear equations now.',
      outline: ['Start with one-step equations.'],
      imageSearchQuery: 'linear equations teaching diagram',
      desiredImageCount: 1,
    });
    mockSearchLessonImages.mockResolvedValue({ assets: [] });
    mockGenerateInitialTutorResponse.mockResolvedValue({
      response: {
        speech: 'Let us start with one-step linear equations.',
        awaitMode: 'voice_or_canvas',
        commands: [],
        sessionComplete: false,
        status: 'active',
      },
      debug: {
        stage: 'session_create',
        messages: [],
        rawResponseText: null,
        rawModelContent: null,
        parsedResponse: null,
        usedFallback: false,
        fallbackReason: null,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_1',
          prompt: '',
          lessonTopic: '',
          learnerLevel: 'unknown',
          speech: 'What would you like to learn today?',
          canvas: emptyCanvas,
          turns: [
            {
              actor: 'tutor',
              text: 'What would you like to learn today?',
              createdAt: '2026-04-21T00:00:00.000Z',
            },
          ],
          intake: {
            status: 'active',
            topic: null,
            learnerLevel: null,
          },
        }),
        transcript: 'I want to learn linear equations.',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorIntakeTurn).toHaveBeenCalledTimes(1);
    expect(mockGenerateLessonPreparation).toHaveBeenCalledWith({
      topic: 'linear equations',
      learnerLevel: 'needs the basics',
    });
    expect(mockGenerateInitialTutorResponse).toHaveBeenCalledTimes(1);
    expect(data.snapshot.lessonTopic).toBe('linear equations');
    expect(data.snapshot.intake).toBeNull();
    expect(data.snapshot.speech).toBe('Let us start with one-step linear equations.');
  });

  it('ignores filler-only intake fragments instead of sending them to the model', async () => {
    const snapshot = buildSnapshot({
      sessionId: 'tutor_2',
      prompt: '',
      lessonTopic: '',
      learnerLevel: 'unknown',
      speech: 'What would you like to learn today?',
      canvas: emptyCanvas,
      turns: [
        {
          actor: 'tutor',
          text: 'What would you like to learn today?',
          createdAt: '2026-04-21T00:00:00.000Z',
        },
      ],
      intake: {
        status: 'active',
        topic: null,
        learnerLevel: null,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot,
        transcript: 'Um,',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorIntakeTurn).not.toHaveBeenCalled();
    expect(data.snapshot.turns).toEqual(snapshot.turns);
    expect(data.snapshot.speech).toBe(snapshot.speech);
  });
});
