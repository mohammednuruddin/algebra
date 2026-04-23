'use client';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TutorExperience } from './tutor-experience';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

const mockStartSession = vi.fn();
const mockUseTutorSession = vi.fn();
const mockGetGuestContinuationContextByArticleId = vi.fn();
const mockTutorShell = vi.fn((props: unknown) => {
  const typedProps = props as {
    onStartClick?: () => void;
    snapshot?: { speech?: string };
  };

  return (
    <div data-testid="tutor-shell">
      <span>{typedProps.snapshot?.speech}</span>
      {typedProps.onStartClick ? (
        <button type="button" onClick={typedProps.onStartClick}>
          start session
        </button>
      ) : null}
    </div>
  );
});

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

vi.mock('@/lib/hooks/use-tutor-session', () => ({
  useTutorSession: () => mockUseTutorSession(),
}));

vi.mock('@/lib/guest/guest-lesson-store', () => ({
  getGuestContinuationContextByArticleId: (...args: unknown[]) =>
    mockGetGuestContinuationContextByArticleId(...args),
}));

vi.mock('@/components/tutor/tutor-shell', () => ({
  TutorShell: (props: unknown) => mockTutorShell(props),
}));

function buildSnapshot(): TutorRuntimeSnapshot {
  return {
    sessionId: 'session-1',
    prompt: '',
    lessonTopic: '',
    learnerLevel: 'unknown',
    lessonOutline: [],
    status: 'active',
    speech: 'What would you like to learn today?',
    awaitMode: 'voice',
    speechRevision: 1,
    mediaAssets: [],
    activeImageId: null,
    canvas: {
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
      imageHotspot: null,
      timeline: null,
      continuousAxis: null,
      vennDiagram: null,
      tokenBuilder: null,
      processFlow: null,
      partWholeBuilder: null,
      mapCanvas: null,
      claimEvidenceBuilder: null,
      compareMatrix: null,
      flashcard: null,
      trueFalse: null,
    },
    turns: [],
    intake: {
      status: 'active',
      topic: null,
      learnerLevel: null,
    },
  };
}

describe('TutorExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    );

    mockUseTutorSession.mockReturnValue({
      snapshot: null,
      phase: 'intake',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript: vi.fn(),
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    });
  });

  it('auto-starts a resumed tutor session when a continuation article id is provided', async () => {
    mockGetGuestContinuationContextByArticleId.mockReturnValue({
      sourceSessionId: 'session-old',
      sourceArticleId: 'article-1',
      topic: 'pollination',
      learnerLevel: 'beginner',
      outline: ['Start with flower-part labeling.'],
      turns: [],
      mediaAssets: [],
      activeImageId: null,
      canvasSummary: 'No board task remained active.',
      canvas: buildSnapshot().canvas,
      strengths: ['Can explain the main idea verbally.'],
      weaknesses: ['Still confuses flower-part labels.'],
      recommendedNextSteps: ['Resume with one diagram labeling rep.'],
      resumeHint: 'Restart from the confusing labels, not from the very beginning.',
      completedAt: '2026-04-22T10:05:00.000Z',
    });

    render(<TutorExperience initialContinuationArticleId="article-1" />);

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith(
        expect.objectContaining({
          continuationContext: expect.objectContaining({
            sourceArticleId: 'article-1',
            resumeHint:
              'Restart from the confusing labels, not from the very beginning.',
          }),
        })
      );
    });
  });

  it('waits for the learner to click Start before creating the model-owned intake session', () => {
    render(<TutorExperience />);

    expect(mockStartSession).not.toHaveBeenCalled();
    expect(mockTutorShell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isPendingStart: true,
      })
    );

    expect(
      screen.queryByText(/Start\. Answer two quick questions\. Then the lesson goes live\./i)
    ).not.toBeInTheDocument();
  });

  it('starts the intake session when the learner clicks Start', async () => {
    mockStartSession.mockResolvedValue(buildSnapshot());

    render(<TutorExperience />);

    fireEvent.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith({});
    });
  });

  it('keeps the shell mounted with an in-shell loading message while the first intake turn is loading', async () => {
    const deferred = createDeferredPromise<TutorRuntimeSnapshot>();
    mockStartSession.mockReturnValue(deferred.promise);

    render(<TutorExperience />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    });

    expect(screen.getByTestId('tutor-shell')).toBeInTheDocument();
    expect(screen.getByText(/starting your live tutor/i)).toBeInTheDocument();
    expect(mockTutorShell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isPendingStart: false,
        isStartingSession: true,
      })
    );

    deferred.resolve(buildSnapshot());
  });

  it('renders a fresh tutor snapshot with teacher audio already marked pending', async () => {
    const sessionState: {
      snapshot: TutorRuntimeSnapshot | null;
      phase: 'intake' | 'live';
      error: string | null;
      isSubmittingTurn: boolean;
      startSession: typeof mockStartSession;
      submitTranscript: ReturnType<typeof vi.fn>;
      moveToken: ReturnType<typeof vi.fn>;
      chooseEquationAnswer: ReturnType<typeof vi.fn>;
    } = {
      snapshot: null as TutorRuntimeSnapshot | null,
      phase: 'intake',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript: vi.fn(),
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    };

    mockUseTutorSession.mockImplementation(() => sessionState);
    mockStartSession.mockResolvedValue(buildSnapshot());

    const { rerender } = render(<TutorExperience />);

    fireEvent.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith({});
    });

    sessionState.snapshot = buildSnapshot();
    sessionState.phase = 'live';
    rerender(<TutorExperience />);

    expect(mockTutorShell).toHaveBeenLastCalledWith(
      expect.objectContaining({ teacherAudioPending: true })
    );
  });

  it('forwards drawing submissions as multimodal canvas evidence', async () => {
    const submitTranscript = vi.fn();

    mockUseTutorSession.mockReturnValue({
      snapshot: buildSnapshot(),
      phase: 'live',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript,
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    });

    render(<TutorExperience />);

    const props = mockTutorShell.mock.calls.at(-1)?.[0] as {
      onCanvasSubmit?: (mode: string, data: unknown) => void;
    };

    props.onCanvasSubmit?.('drawing', { dataUrl: 'data:image/png;base64,mark' });

    expect(submitTranscript).toHaveBeenCalledWith(
      '[Canvas interaction: drawing] {"summary":"Learner submitted a marked image for review."}',
      expect.objectContaining({
        canvasInteraction: {
          mode: 'drawing',
          summary: 'Learner submitted a marked image for review.',
          strokeColors: undefined,
          strokeCount: undefined,
        },
        canvasEvidence: {
          mode: 'drawing',
          summary: 'Learner submitted a marked image for review.',
          dataUrl: 'data:image/png;base64,mark',
        },
      })
    );
  });

  it('forwards structured text-response submissions instead of flattening them into prose only', async () => {
    const submitTranscript = vi.fn();

    mockUseTutorSession.mockReturnValue({
      snapshot: buildSnapshot(),
      phase: 'live',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript,
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    });

    render(<TutorExperience />);

    const props = mockTutorShell.mock.calls.at(-1)?.[0] as {
      onCanvasSubmit?: (mode: string, data: unknown) => void;
    };

    props.onCanvasSubmit?.('text_response', { text: 'i dont know' });

    expect(submitTranscript).toHaveBeenCalledWith(
      '[Canvas interaction: text_response] {"text":"i dont know"}',
      expect.objectContaining({
        canvasInteraction: {
          mode: 'text_response',
          text: 'i dont know',
        },
      })
    );
  });

  it('forwards structured timeline submissions instead of flattening them to prose only', () => {
    const submitTranscript = vi.fn();

    mockUseTutorSession.mockReturnValue({
      snapshot: buildSnapshot(),
      phase: 'live',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript,
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    });

    render(<TutorExperience />);

    const props = mockTutorShell.mock.calls.at(-1)?.[0] as {
      onCanvasSubmit?: (mode: string, data: unknown) => void;
    };

    props.onCanvasSubmit?.('timeline', { userOrder: ['event-2', 'event-1'] });

    expect(submitTranscript).toHaveBeenCalledWith(
      '[Canvas interaction: timeline] {"userOrder":["event-2","event-1"]}',
      expect.objectContaining({
        canvasInteraction: {
          mode: 'timeline',
          userOrder: ['event-2', 'event-1'],
        },
      })
    );
  });

  it('forwards code execution results so the tutor sees success or runtime errors', async () => {
    const submitTranscript = vi.fn();

    mockUseTutorSession.mockReturnValue({
      snapshot: buildSnapshot(),
      phase: 'live',
      error: null,
      isSubmittingTurn: false,
      startSession: mockStartSession,
      submitTranscript,
      moveToken: vi.fn(),
      chooseEquationAnswer: vi.fn(),
    });

    render(<TutorExperience />);

    const props = mockTutorShell.mock.calls.at(-1)?.[0] as {
      onCodeSubmit?: (
        code: string,
        result: { status: 'success' | 'error'; stdout: string; stderr: string }
      ) => void;
    };

    props.onCodeSubmit?.('print(x)', {
      status: 'error',
      stdout: '',
      stderr: 'NameError: name x is not defined',
    });

    expect(submitTranscript).toHaveBeenCalledWith(
      '[Canvas interaction: code_block] {"code":"print(x)","execution":{"status":"error","stdout":"","stderr":"NameError: name x is not defined"}}',
      expect.objectContaining({
        canvasInteraction: {
          mode: 'code_block',
          code: 'print(x)',
          execution: {
            status: 'error',
            stdout: '',
            stderr: 'NameError: name x is not defined',
          },
        },
      })
    );
  });
});
