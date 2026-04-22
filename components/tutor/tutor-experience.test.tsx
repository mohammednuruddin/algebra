'use client';

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TutorExperience } from './tutor-experience';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

const mockStartSession = vi.fn();
const mockUseTutorSession = vi.fn();
const mockTutorShell = vi.fn((props: unknown) => {
  void props;
  return <div data-testid="tutor-shell" />;
});

vi.mock('@/lib/hooks/use-tutor-session', () => ({
  useTutorSession: () => mockUseTutorSession(),
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

  it('starts a model-owned intake session automatically instead of rendering the scripted onboarding wizard', async () => {
    render(<TutorExperience />);

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith({});
    });

    expect(
      screen.queryByText(/Start\. Answer two quick questions\. Then the lesson goes live\./i)
    ).not.toBeInTheDocument();
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
});
