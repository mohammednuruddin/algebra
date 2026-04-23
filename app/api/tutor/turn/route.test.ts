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
  mockQueueTutorGeneratedImages,
  mockCreateAdminClient,
  mockIsAdminClientConfigured,
  mockListCompletedTutorImageAssets,
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
  mockQueueTutorGeneratedImages: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockIsAdminClientConfigured: vi.fn(),
  mockListCompletedTutorImageAssets: vi.fn(),
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

vi.mock('@/lib/media/generated-image-bootstrap', () => ({
  queueTutorGeneratedImages: mockQueueTutorGeneratedImages,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
  isAdminClientConfigured: mockIsAdminClientConfigured,
}));

vi.mock('@/lib/media/generated-image-jobs', () => ({
  listCompletedTutorImageAssets: mockListCompletedTutorImageAssets,
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
    mockQueueTutorGeneratedImages.mockResolvedValue([]);
    mockCreateAdminClient.mockReturnValue({});
    mockIsAdminClientConfigured.mockReturnValue(true);
    mockListCompletedTutorImageAssets.mockResolvedValue([]);
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

  it('queues generated images in the background when intake hands off into a real lesson', async () => {
    const timeout = Symbol('timeout');
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
    mockSearchLessonImages.mockResolvedValue({
      assets: [
        {
          id: 'img-1',
          url: 'https://example.com/equation.png',
          altText: 'Equation diagram',
          description: 'Equation diagram',
        },
      ],
    });
    mockGenerateInitialTutorResponse.mockResolvedValue({
      response: {
        speech: 'Let us start with one-step linear equations.',
        awaitMode: 'voice_or_canvas',
        commands: [],
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
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

    const raced = await Promise.race([
      POST(request),
      new Promise<typeof timeout>((resolve) => {
        setTimeout(() => resolve(timeout), 25);
      }),
    ]);

    expect(raced).not.toBe(timeout);
    expect(mockQueueTutorGeneratedImages).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'tutor_1',
        topic: 'linear equations',
        learnerLevel: 'needs the basics',
        outline: ['Start with one-step equations.'],
        origin: 'http://localhost:3000',
      })
    );
  });

  it('forwards short or filler-like intake speech instead of swallowing it in the route', async () => {
    mockGenerateTutorIntakeTurn.mockResolvedValue({
      response: {
        speech: 'Tell me the topic you want.',
        awaitMode: 'voice',
        readyToStartLesson: false,
        topic: null,
        learnerLevel: null,
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
    expect(mockGenerateTutorIntakeTurn).toHaveBeenCalledTimes(1);
    expect(data.snapshot.turns).toHaveLength(3);
    expect(data.snapshot.speech).toBe('Tell me the topic you want.');
    expect(data.snapshot.intake).toEqual({
      status: 'active',
      topic: null,
      learnerLevel: null,
      nextReplyAction: 'continue_intake',
    });
  });

  it('marks the next intake reply as lesson-preparing once the topic is already known', async () => {
    mockGenerateTutorIntakeTurn.mockResolvedValue({
      response: {
        speech: 'Nice. How familiar are you with fractions?',
        awaitMode: 'voice',
        readyToStartLesson: false,
        topic: 'fractions',
        learnerLevel: null,
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_2b',
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
        transcript: 'Fractions.',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(data.snapshot.intake).toEqual({
      status: 'active',
      topic: 'fractions',
      learnerLevel: null,
      nextReplyAction: 'prepare_lesson',
    });
  });

  it('marks the lesson completed when the model ends the live session', async () => {
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Nice work. We can stop here for today.',
        awaitMode: 'voice',
        commands: [{ type: 'complete_session' }],
        sessionComplete: true,
        status: 'completed',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_3',
          prompt: 'Python programming',
          lessonTopic: 'Python programming',
          learnerLevel: 'beginner',
          lessonOutline: ['Use one concrete example.'],
          speech: 'Want one more example?',
          awaitMode: 'voice',
          canvas: emptyCanvas,
          turns: [
            {
              actor: 'user',
              text: 'I want to stop now.',
              createdAt: '2026-04-22T00:00:00.000Z',
            },
          ],
          intake: null,
        }),
        transcript: 'Let us end the lesson.',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorTurn).toHaveBeenCalledTimes(1);
    expect(data.snapshot.status).toBe('completed');
    expect(data.snapshot.speech).toBe('Nice work. We can stop here for today.');
  });

  it('hydrates completed generated assets into live turns before calling the tutor model', async () => {
    mockListCompletedTutorImageAssets.mockResolvedValue([
      {
        id: 'generated_job_1',
        url: 'https://example.com/generated.webp',
        altText: 'Plant cell quiz variant',
        description: 'Same diagram with one label removed.',
        metadata: {
          assetKind: 'generated',
          generationKind: 'edit',
          variantKind: 'quiz_unlabeled',
        },
      },
    ]);
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Take a look at the quiz variant now.',
        awaitMode: 'voice_or_canvas',
        commands: [],
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_4',
          prompt: 'pollination',
          lessonTopic: 'pollination',
          learnerLevel: 'beginner',
          lessonOutline: ['Use one image.'],
          speech: 'Look at the flower diagram.',
          canvas: emptyCanvas,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/flower.png',
              altText: 'Flower diagram',
              description: 'Flower diagram',
            },
          ],
          intake: null,
        }),
        transcript: 'Okay.',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockListCompletedTutorImageAssets).toHaveBeenCalledWith({}, 'tutor_4');
    expect(mockGenerateTutorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAssets: expect.arrayContaining([
          expect.objectContaining({ id: 'img-1' }),
          expect.objectContaining({ id: 'generated_job_1' }),
        ]),
      })
    );
    expect(mockApplyTutorMediaCommands).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaAssets: expect.arrayContaining([
          expect.objectContaining({ id: 'img-1' }),
          expect.objectContaining({ id: 'generated_job_1' }),
        ]),
      })
    );
    expect(mockApplyTutorCommands).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        mediaAssets: expect.arrayContaining([
          expect.objectContaining({ id: 'img-1' }),
          expect.objectContaining({ id: 'generated_job_1' }),
        ]),
      })
    );
    expect(data.snapshot.mediaAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'img-1' }),
        expect.objectContaining({ id: 'generated_job_1' }),
      ])
    );
  });

  it('continues the live lesson when generated-image hydration is unavailable', async () => {
    mockIsAdminClientConfigured.mockReturnValue(false);
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    });
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Alright, let us keep going with the skeletal system.',
        awaitMode: 'voice',
        commands: [],
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_5',
          prompt: 'skeletal system',
          lessonTopic: 'skeletal system',
          learnerLevel: 'beginner',
          lessonOutline: ['Explain what bones do.'],
          speech: 'Ready to begin?',
          canvas: emptyCanvas,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/skeleton.png',
              altText: 'Skeleton diagram',
              description: 'Skeleton diagram',
            },
          ],
          intake: null,
        }),
        transcript: "Let's get started already.",
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockListCompletedTutorImageAssets).not.toHaveBeenCalled();
    expect(mockGenerateTutorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAssets: [
          expect.objectContaining({
            id: 'img-1',
            url: 'https://example.com/skeleton.png',
          }),
        ],
      })
    );
    expect(data.snapshot.speech).toBe('Alright, let us keep going with the skeletal system.');
  });

  it('continues the live lesson when generated-image hydration lookup fails', async () => {
    mockCreateAdminClient.mockReturnValue({});
    mockListCompletedTutorImageAssets.mockRejectedValue({
      code: '42P01',
      message: 'relation "tutor_image_generation_jobs" does not exist',
    });
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Nice, let us keep going.',
        awaitMode: 'voice',
        commands: [],
        sessionComplete: false,
        status: 'active',
        canvasAction: 'keep',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_6',
          prompt: 'skeletal system',
          lessonTopic: 'skeletal system',
          learnerLevel: 'beginner',
          lessonOutline: ['Explain what bones do.'],
          speech: 'Ready to begin?',
          canvas: emptyCanvas,
          mediaAssets: [
            {
              id: 'img-1',
              url: 'https://example.com/skeleton.png',
              altText: 'Skeleton diagram',
              description: 'Skeleton diagram',
            },
          ],
          intake: null,
        }),
        transcript: 'Oh nice.',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockListCompletedTutorImageAssets).toHaveBeenCalledWith({}, 'tutor_6');
    expect(mockGenerateTutorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAssets: [
          expect.objectContaining({
            id: 'img-1',
            url: 'https://example.com/skeleton.png',
          }),
        ],
      })
    );
    expect(data.snapshot.speech).toBe('Nice, let us keep going.');
  });

  it('forwards canvas evidence and logs the learner transcript on live turns', async () => {
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Thanks, I can see your markings.',
        awaitMode: 'voice',
        commands: [],
        sessionComplete: false,
        status: 'active',
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

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_4',
          prompt: 'pollination',
          lessonTopic: 'pollination',
          learnerLevel: 'beginner',
          speech: 'Point to the anther.',
          canvas: {
            ...emptyCanvas,
            mode: 'drawing',
            drawing: {
              prompt: 'Point to the anther.',
              backgroundImageUrl: 'https://example.com/flower.png',
              canvasWidth: 800,
              canvasHeight: 600,
              brushColor: '#FF3B30',
              brushSize: 4,
              submitted: false,
            },
          },
          intake: null,
        }),
        transcript: 'I marked it here.',
        canvasEvidence: {
          mode: 'drawing',
          summary: 'Learner submitted a marked flower diagram.',
          dataUrl: 'data:image/png;base64,marked',
          overlayDataUrl: 'data:image/png;base64,overlay',
          strokeColors: ['#FF3B30'],
          strokeCount: 1,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateTutorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'I marked it here.',
        canvasTaskPrompt: 'Point to the anther.',
        canvasReferenceImageUrl: 'https://example.com/flower.png',
        canvasBrushColor: '#FF3B30',
        canvasEvidence: {
          mode: 'drawing',
          summary: 'Learner submitted a marked flower diagram.',
          dataUrl: 'data:image/png;base64,marked',
          overlayDataUrl: 'data:image/png;base64,overlay',
          strokeColors: ['#FF3B30'],
          strokeCount: 1,
        },
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[tutor:turn_request] learner input',
      expect.objectContaining({
        transcript: 'I marked it here.',
        canvasInteraction: expect.objectContaining({
          mode: 'drawing',
        }),
        hasCanvasEvidence: true,
        canvasEvidenceMode: 'drawing',
      })
    );
  });

  it('builds structured tutor context from a submitted text response instead of the stale empty canvas state', async () => {
    mockSummarizeTutorCanvas.mockImplementation((canvas: TutorCanvasState) =>
      canvas.textResponse
        ? `Text response: ${canvas.textResponse.prompt}. Answer: ${canvas.textResponse.userText || '(empty)'}. Submitted: ${canvas.textResponse.submitted}.`
        : 'Empty canvas.'
    );
    mockGenerateTutorTurn.mockResolvedValue({
      response: {
        speech: 'Pollen moves down the style toward the ovary.',
        awaitMode: 'voice_or_canvas',
        commands: [],
        sessionComplete: false,
        status: 'active',
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

    const request = new NextRequest('http://localhost:3000/api/tutor/turn', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: buildSnapshot({
          sessionId: 'tutor_5',
          prompt: 'pollination',
          lessonTopic: 'pollination',
          learnerLevel: 'beginner',
          speech: 'Type what happens to the pollen as it moves down the style.',
          canvas: {
            ...emptyCanvas,
            mode: 'text_response',
            textResponse: {
              prompt: 'What happens to the pollen as it moves down the style toward the ovary?',
              placeholder: 'Type your answer',
              userText: '',
              maxLength: 200,
              submitted: false,
            },
          },
          turns: [
            {
              actor: 'tutor',
              text: 'Type what happens to the pollen as it moves down the style.',
              createdAt: '2026-04-22T10:00:00.000Z',
            },
          ],
          intake: null,
        }),
        transcript: '[Canvas interaction: text_response] {"text":"i dont know"}',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as { snapshot: TutorRuntimeSnapshot };

    expect(response.status).toBe(200);
    expect(mockGenerateTutorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasSummary: expect.stringContaining('Answer: i dont know. Submitted: true.'),
        canvasStateContext: expect.stringContaining('"learnerText": "i dont know"'),
        latestLearnerTurnContext: expect.stringContaining('"mode": "text_response"'),
        recentTurnFrames: expect.stringContaining('"actor": "tutor"'),
      })
    );
    expect(data.snapshot.turns.at(-2)).toEqual(
      expect.objectContaining({
        actor: 'user',
        text: '[Canvas interaction: text_response] {"text":"i dont know"}',
        canvasSummary: expect.stringContaining('Answer: i dont know. Submitted: true.'),
        canvasInteraction: {
          mode: 'text_response',
          text: 'i dont know',
        },
      })
    );
  });
});
