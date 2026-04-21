import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonContainer } from './lesson-container';
import * as lessonApi from '../../lib/api/lesson-api';
import * as guestStore from '../../lib/guest/guest-lesson-store';
import type {
  LearnerInput,
  LessonPlan,
  MediaAsset,
  SessionSummary,
  TeacherResponse,
} from '../../lib/types/lesson';
import type { GuestLessonRecord } from '../../lib/guest/guest-lesson-store';

vi.mock('../../lib/api/lesson-api');
vi.mock('../../lib/guest/guest-lesson-store', async () => {
  const actual = await vi.importActual<typeof import('../../lib/guest/guest-lesson-store')>(
    '../../lib/guest/guest-lesson-store'
  );

  return {
    ...actual,
    getGuestLesson: vi.fn(),
  };
});

vi.mock('./index', () => ({
  LessonStart: ({
    onStartLesson,
  }: {
    onStartLesson: (topic: string) => void;
  }) => (
    <div data-testid="lesson-start">
      <button onClick={() => onStartLesson('Photosynthesis')}>
        Start Tutor
      </button>
    </div>
  ),
  LessonSummary: ({
    summary,
    onStartNew,
  }: {
    summary: {
      topic: string;
      milestonesCompleted: number;
      totalMilestones: number;
      insights: string[];
      duration: number;
    };
    onStartNew: () => void;
  }) => (
    <div data-testid="lesson-summary">
      <p>{summary.topic}</p>
      <p>
        {summary.milestonesCompleted}/{summary.totalMilestones}
      </p>
      <button onClick={onStartNew}>Start New Lesson</button>
    </div>
  ),
  MilestoneProgress: ({
    milestones,
    currentMilestoneId,
  }: {
    milestones: Array<{ id: string; title: string; status: string }>;
    currentMilestoneId: string | null;
  }) => (
    <div data-testid="milestone-progress">
      <span>count:{milestones.length}</span>
      <span>current:{currentMilestoneId ?? 'none'}</span>
      <span>
        statuses:
        {milestones.map((milestone) => `${milestone.id}:${milestone.status}`).join(',')}
      </span>
    </div>
  ),
}));

vi.mock('./text-input', () => ({
  TextInput: ({
    onSubmit,
    disabled,
  }: {
    onSubmit: (text: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="text-input">
      <button onClick={() => onSubmit('typed learner reply')} disabled={disabled}>
        Send Text
      </button>
    </div>
  ),
}));

vi.mock('./tutor-stage', () => ({
  TutorStage: ({
    activeImage,
    onCanvasSnapshot,
    disabled,
  }: {
    activeImage: MediaAsset | null;
    onCanvasSnapshot: (url: string, interpretation: unknown) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="tutor-stage">
      <span>{activeImage?.altText ?? 'No image'}</span>
      <button
        onClick={() =>
          onCanvasSnapshot('blob:canvas-snapshot', {
            markings: [{ type: 'circle', target: 'leaf', confidence: 0.91 }],
          })
        }
        disabled={disabled}
      >
        Submit Canvas
      </button>
    </div>
  ),
}));

vi.mock('./voice-dock', () => ({
  VoiceDock: ({
    onTranscript,
    onSpeechStart,
    disabled,
  }: {
    onTranscript: (text: string) => void;
    onSpeechStart?: () => void;
    disabled?: boolean;
  }) => (
    <div data-testid="voice-dock">
      <button
        onClick={() => {
          onSpeechStart?.();
          onTranscript('spoken learner reply');
        }}
        disabled={disabled}
      >
        Send Voice
      </button>
    </div>
  ),
}));

vi.mock('./voice-output', () => ({
  VoiceOutput: ({
    text,
    stopSignal,
  }: {
    text: string;
    stopSignal?: number;
  }) => (
    <div data-testid="voice-output">
      <span>{text}</span>
      <span>stop:{stopSignal ?? 0}</span>
    </div>
  ),
}));

describe('LessonContainer', () => {
  const mockCreateSession = vi.mocked(lessonApi.createSession);
  const mockSubmitTurn = vi.mocked(lessonApi.submitTurn);
  const mockEndSession = vi.mocked(lessonApi.endSession);
  const mockGetGuestLesson = vi.mocked(guestStore.getGuestLesson);

  const lessonPlan: LessonPlan = {
    topic: 'Photosynthesis',
    normalizedTopic: 'photosynthesis',
    objective: 'Understand inputs, outputs, and where photosynthesis happens.',
    milestones: [
      {
        id: 'm1',
        title: 'Identify the inputs',
        description: 'Sunlight, water, carbon dioxide.',
        required: true,
        successCriteria: ['Learner can name the inputs'],
      },
      {
        id: 'm2',
        title: 'Locate the process',
        description: 'Leaves and chloroplasts.',
        required: true,
        successCriteria: ['Learner can point to where it happens'],
      },
    ],
    concepts: [],
    estimatedDuration: 12,
    difficulty: 'beginner',
    visualsNeeded: true,
    interactiveMoments: [],
  };

  const mediaAssets: MediaAsset[] = [
    {
      id: 'img-1',
      type: 'diagram',
      url: 'https://example.com/plant-diagram.png',
      storagePath: 'guest/plant-diagram.png',
      description: 'A simple plant diagram.',
      altText: 'Plant diagram with sunlight and leaves',
      relatedMilestones: ['m1', 'm2'],
    },
  ];

  const initialResponse: TeacherResponse = {
    speech: 'Welcome. Let us study photosynthesis step by step.',
    displayText: 'We will start with the inputs.',
    actions: [],
    awaitedInputMode: 'voice',
    currentMilestoneId: 'm1',
  };

  const followUpResponse: TeacherResponse = {
    speech: 'Good. Now show me where the process happens.',
    displayText: 'Point to the leaf area.',
    actions: [],
    awaitedInputMode: 'canvas_draw',
    currentMilestoneId: 'm2',
  };

  const summary: SessionSummary = {
    topic: 'Photosynthesis',
    duration: 12,
    milestonesCompleted: 2,
    milestonesTotal: 2,
    accuracy: 100,
    strengths: ['Clear explanations'],
    areasForImprovement: [],
    nextSteps: ['Try respiration next'],
    keyTakeaways: ['Plants use sunlight to make food'],
  };

  let guestLesson: GuestLessonRecord;

  function makeGuestLesson(overrides: Partial<GuestLessonRecord> = {}): GuestLessonRecord {
    return {
      id: 'session-123',
      guestId: 'guest-1',
      topicPrompt: 'Photosynthesis',
      title: 'Photosynthesis',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
      status: 'active',
      lessonPlan,
      mediaAssets,
      activeImageId: 'img-1',
      currentMilestoneId: 'm1',
      lastResponse: initialResponse,
      turns: [],
      summary: null,
      article: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    guestLesson = makeGuestLesson();

    mockGetGuestLesson.mockImplementation(() => guestLesson);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        teacherVoiceId: 'hpp4J3VqNfWAUOO0d1Us',
        speechToTextEnabled: true,
        imageSearchEnabled: true,
      }),
    }) as typeof global.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a lesson and renders the new tutor shell', async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: 'session-123',
      status: 'ready',
      initialResponse,
    });

    render(<LessonContainer />);

    expect(screen.getByTestId('lesson-start')).toBeTruthy();

    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        'Photosynthesis',
        expect.any(Function)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Interactive Tutor Runtime')).toBeTruthy();
      expect(screen.getByText('Photosynthesis')).toBeTruthy();
      expect(screen.getByTestId('tutor-stage')).toBeTruthy();
      expect(screen.getByTestId('voice-dock')).toBeTruthy();
      expect(screen.getByTestId('milestone-progress')).toBeTruthy();
      expect(screen.getByText('Plant diagram with sunlight and leaves')).toBeTruthy();
    });
  });

  it('bundles the latest canvas snapshot into the next text turn', async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: 'session-123',
      status: 'ready',
      initialResponse,
    });

    mockSubmitTurn
      .mockResolvedValueOnce({
        response: {
          ...initialResponse,
          speech: 'I see the circle on the leaf.',
          awaitedInputMode: 'text',
        },
        status: 'active',
        isSessionComplete: false,
      })
      .mockResolvedValueOnce({
        response: followUpResponse,
        status: 'active',
        isSessionComplete: false,
      });

    render(<LessonContainer />);
    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(screen.getByTestId('tutor-stage')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Submit Canvas'));

    await waitFor(() => {
      expect(mockSubmitTurn).toHaveBeenNthCalledWith(
        1,
        'session-123',
        expect.objectContaining({
          mode: 'canvas_draw',
          raw: { canvasSnapshotUrl: 'blob:canvas-snapshot' },
          interpreted: {
            markings: [{ type: 'circle', target: 'leaf', confidence: 0.91 }],
          },
        })
      );
    });

    fireEvent.click(screen.getByText('Send Text'));

    await waitFor(() => {
      expect(mockSubmitTurn).toHaveBeenNthCalledWith(
        2,
        'session-123',
        expect.objectContaining({
          mode: 'text',
          raw: {
            text: 'typed learner reply',
            canvasSnapshotUrl: 'blob:canvas-snapshot',
          },
          interpreted: {
            text: 'typed learner reply',
            markings: [{ type: 'circle', target: 'leaf', confidence: 0.91 }],
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('voice-output').textContent).toContain(
        'Good. Now show me where the process happens.'
      );
      expect(screen.getByText('current:m2')).toBeTruthy();
    });
  });

  it('submits a voice turn and interrupts teacher playback when learner speaks', async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: 'session-123',
      status: 'ready',
      initialResponse,
    });

    mockSubmitTurn.mockImplementation(
      async (_sessionId: string, input: LearnerInput) => ({
        response: {
          ...followUpResponse,
          speech: `Heard: ${input.raw.text}`,
          awaitedInputMode: 'voice',
        },
        status: 'active',
        isSessionComplete: false,
      })
    );

    render(<LessonContainer />);
    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(screen.getByTestId('voice-output')).toBeTruthy();
      expect(screen.getByText('stop:0')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Send Voice'));

    await waitFor(() => {
      expect(mockSubmitTurn).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          mode: 'voice',
          raw: { text: 'spoken learner reply' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('voice-output').textContent).toContain(
        'Heard: spoken learner reply'
      );
      expect(screen.getByTestId('voice-output').textContent).toContain('stop:1');
    });
  });

  it('shows the summary when the session completes from a learner turn', async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: 'session-123',
      status: 'ready',
      initialResponse,
    });

    mockSubmitTurn.mockResolvedValue({
      response: followUpResponse,
      status: 'completed',
      isSessionComplete: true,
      summary,
    });

    render(<LessonContainer />);
    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(screen.getByTestId('text-input')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Send Text'));

    await waitFor(() => {
      expect(screen.getByTestId('lesson-summary')).toBeTruthy();
      expect(screen.getByText('Photosynthesis')).toBeTruthy();
      expect(screen.getByText('2/2')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Start New Lesson'));

    await waitFor(() => {
      expect(screen.getByTestId('lesson-start')).toBeTruthy();
    });
  });

  it('shows errors for start, turn submission, and lesson ending failures', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('Start failed'));

    render(<LessonContainer />);
    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(screen.getByText('Start failed')).toBeTruthy();
      expect(screen.getByTestId('lesson-start')).toBeTruthy();
    });

    mockCreateSession.mockResolvedValueOnce({
      sessionId: 'session-123',
      status: 'ready',
      initialResponse,
    });

    fireEvent.click(screen.getByText('Start Tutor'));

    await waitFor(() => {
      expect(screen.getByText('End Lesson')).toBeTruthy();
    });

    mockSubmitTurn.mockRejectedValueOnce(new Error('Turn failed'));
    fireEvent.click(screen.getByText('Send Text'));

    await waitFor(() => {
      expect(screen.getByText('Turn failed')).toBeTruthy();
    });

    mockEndSession.mockRejectedValueOnce(new Error('End failed'));
    fireEvent.click(screen.getByText('End Lesson'));

    await waitFor(() => {
      expect(screen.getByText('End failed')).toBeTruthy();
      expect(screen.getByText('Interactive Tutor Runtime')).toBeTruthy();
    });
  });
});
