import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from './route';
import type { TutorCanvasState, TutorRuntimeSnapshot } from '@/lib/types/tutor';

const {
  mockGenerateTutorIntakeTurn,
  mockGenerateLessonPreparation,
  mockGenerateInitialTutorResponse,
  mockSearchLessonImages,
  mockQueueTutorGeneratedImages,
  mockCreateEmptyTutorCanvasState,
  mockApplyTutorCommands,
  mockApplyTutorMediaCommands,
  mockCreateTutorSnapshot,
} = vi.hoisted(() => ({
  mockGenerateTutorIntakeTurn: vi.fn(),
  mockGenerateLessonPreparation: vi.fn(),
  mockGenerateInitialTutorResponse: vi.fn(),
  mockSearchLessonImages: vi.fn(),
  mockQueueTutorGeneratedImages: vi.fn(),
  mockCreateEmptyTutorCanvasState: vi.fn(),
  mockApplyTutorCommands: vi.fn(),
  mockApplyTutorMediaCommands: vi.fn(),
  mockCreateTutorSnapshot: vi.fn(),
}));

vi.mock('@/lib/tutor/model', () => ({
  generateTutorIntakeTurn: mockGenerateTutorIntakeTurn,
  generateLessonPreparation: mockGenerateLessonPreparation,
  generateInitialTutorResponse: mockGenerateInitialTutorResponse,
}));

vi.mock('@/lib/media/lesson-image-search', () => ({
  searchLessonImages: mockSearchLessonImages,
}));

vi.mock('@/lib/media/generated-image-bootstrap', () => ({
  queueTutorGeneratedImages: mockQueueTutorGeneratedImages,
}));

vi.mock('@/lib/tutor/runtime', () => ({
  createEmptyTutorCanvasState: mockCreateEmptyTutorCanvasState,
  applyTutorCommands: mockApplyTutorCommands,
  applyTutorMediaCommands: mockApplyTutorMediaCommands,
  createTutorSnapshot: mockCreateTutorSnapshot,
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
    continuation: input.continuation ?? null,
  };
}

describe('POST /api/tutor/session/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueTutorGeneratedImages.mockResolvedValue([]);
    mockCreateEmptyTutorCanvasState.mockReturnValue(emptyCanvas);
    mockCreateTutorSnapshot.mockImplementation(buildSnapshot);
    mockApplyTutorCommands.mockReturnValue({ canvas: emptyCanvas, sessionComplete: false });
    mockApplyTutorMediaCommands.mockReturnValue(null);
  });

  it('creates a model-authored intake session when no topic is provided', async () => {
    mockGenerateTutorIntakeTurn.mockResolvedValue({
      response: {
        speech: 'What would you like to learn today?',
        awaitMode: 'voice',
        readyToStartLesson: false,
        topic: null,
        learnerLevel: null,
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

    const request = new NextRequest('http://localhost:3000/api/tutor/session/create', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorIntakeTurn).toHaveBeenCalledTimes(1);
    expect(mockGenerateLessonPreparation).not.toHaveBeenCalled();
    expect(data.snapshot.speech).toBe('What would you like to learn today?');
    expect(data.snapshot.intake).toEqual({
      status: 'active',
      topic: null,
      learnerLevel: null,
      nextReplyAction: 'continue_intake',
    });
    expect(data.snapshot.lessonTopic).toBe('');
  });

  it('skips intake and seeds a resumed session when continuation context is provided', async () => {
    mockGenerateLessonPreparation.mockResolvedValue({
      openingSpeech: 'We are picking up where you left off.',
      outline: ['Resume with flower-part labeling.'],
      imageSearchQuery: 'pollination flower diagram',
      desiredImageCount: 1,
    });
    mockGenerateInitialTutorResponse.mockResolvedValue({
      response: {
        speech: 'Last time you nailed the big idea, so now we will fix the flower-part labels.',
        awaitMode: 'voice_or_canvas',
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
        commands: [],
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

    const request = new NextRequest('http://localhost:3000/api/tutor/session/create', {
      method: 'POST',
      body: JSON.stringify({
        continuationContext: {
          sourceSessionId: 'session-old',
          sourceArticleId: 'article-1',
          topic: 'pollination',
          learnerLevel: 'beginner',
          outline: ['Review the flower parts.'],
          turns: [],
          mediaAssets: [
            {
              id: 'img-old',
              url: 'https://example.com/flower.png',
              altText: 'Flower diagram',
              description: 'Flower diagram',
            },
          ],
          activeImageId: 'img-old',
          canvasSummary: 'No board task remained active.',
          canvas: emptyCanvas,
          strengths: ['Can explain pollination in words.'],
          weaknesses: ['Still mixes up anther and stigma.'],
          recommendedNextSteps: ['Resume with a labeling drill.'],
          resumeHint: 'Continue from flower-part labeling.',
          completedAt: '2026-04-22T10:05:00.000Z',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorIntakeTurn).not.toHaveBeenCalled();
    expect(mockGenerateLessonPreparation).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'pollination',
        continuationContext: expect.objectContaining({
          sourceArticleId: 'article-1',
          weaknesses: ['Still mixes up anther and stigma.'],
        }),
      })
    );
    expect(mockGenerateInitialTutorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationContext: expect.objectContaining({
          resumeHint: 'Continue from flower-part labeling.',
        }),
      })
    );
    expect(data.snapshot.continuation).toEqual(
      expect.objectContaining({
        sourceSessionId: 'session-old',
        sourceArticleId: 'article-1',
      })
    );
  });

  it('starts background generated-image queueing without waiting for it to finish', async () => {
    const timeout = Symbol('timeout');
    mockGenerateLessonPreparation.mockResolvedValue({
      openingSpeech: 'I am preparing pollination now.',
      outline: ['Start with flower parts.'],
      imageSearchQuery: 'pollination flower diagram',
      desiredImageCount: 1,
    });
    mockSearchLessonImages.mockResolvedValue({
      assets: [
        {
          id: 'img-1',
          url: 'https://example.com/flower.png',
          altText: 'Flower diagram',
          description: 'Flower diagram',
        },
      ],
    });
    mockGenerateInitialTutorResponse.mockResolvedValue({
      response: {
        speech: 'Take a look at the flower diagram.',
        awaitMode: 'voice_or_canvas',
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
        commands: [],
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
    mockQueueTutorGeneratedImages.mockReturnValue(new Promise(() => undefined));

    const request = new NextRequest('http://localhost:3000/api/tutor/session/create', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'pollination',
        learnerLevel: 'beginner',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const raced = await Promise.race([
      POST(request),
      new Promise<typeof timeout>((resolve) => {
        setTimeout(() => resolve(timeout), 25);
      }),
    ]);

    expect(raced).not.toBe(timeout);
    expect(mockQueueTutorGeneratedImages).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^tutor_/),
        topic: 'pollination',
        learnerLevel: 'beginner',
        outline: ['Start with flower parts.'],
        imageAssets: [
          expect.objectContaining({
            id: 'img-1',
          }),
        ],
        origin: 'http://localhost:3000',
      })
    );
  });
});
