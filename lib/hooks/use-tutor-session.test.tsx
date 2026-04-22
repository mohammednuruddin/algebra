'use client';

import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/guest/guest-lesson-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/guest/guest-lesson-store')>(
    '@/lib/guest/guest-lesson-store'
  );

  return {
    ...actual,
    saveGuestLesson: vi.fn(actual.saveGuestLesson),
  };
});

import { useTutorSession } from './use-tutor-session';
import { saveGuestLesson } from '@/lib/guest/guest-lesson-store';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

function buildSnapshot(
  overrides: Partial<TutorRuntimeSnapshot> = {}
): TutorRuntimeSnapshot {
  return {
    sessionId: 'session-1',
    prompt: 'Python programming',
    lessonTopic: 'Python programming',
    learnerLevel: 'beginner',
    lessonOutline: ['Start from what the learner already knows.'],
    status: 'active',
    speech: 'What do you want to learn?',
    awaitMode: 'voice_or_canvas',
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
    intake: null,
    ...overrides,
  };
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

let latestSession: ReturnType<typeof useTutorSession> | null = null;

function Harness() {
  const session = useTutorSession();

  useEffect(() => {
    latestSession = session;
  }, [session]);

  return null;
}

describe('useTutorSession', () => {
  beforeEach(() => {
    latestSession = null;
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('queues a learner transcript that arrives while another turn is still submitting', async () => {
    const initialSnapshot = buildSnapshot();
    const firstTurnSnapshot = buildSnapshot({
      speech: 'First tutor reply',
      speechRevision: 2,
      turns: [
        {
          actor: 'user',
          text: 'first learner message',
          createdAt: '2026-04-22T10:00:00.000Z',
        },
        {
          actor: 'tutor',
          text: 'First tutor reply',
          createdAt: '2026-04-22T10:00:01.000Z',
        },
      ],
    });
    const secondTurnSnapshot = buildSnapshot({
      speech: 'Second tutor reply',
      speechRevision: 3,
      turns: [
        ...firstTurnSnapshot.turns,
        {
          actor: 'user',
          text: 'second learner message',
          createdAt: '2026-04-22T10:00:02.000Z',
        },
        {
          actor: 'tutor',
          text: 'Second tutor reply',
          createdAt: '2026-04-22T10:00:03.000Z',
        },
      ],
    });
    const firstTurnDeferred = createDeferred<Response>();

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/tutor/session/create') {
        return Promise.resolve(jsonResponse({ snapshot: initialSnapshot }));
      }

      if (url === '/api/tutor/turn') {
        const body = JSON.parse(String(init?.body)) as {
          snapshot: TutorRuntimeSnapshot;
          transcript: string;
        };

        if (body.transcript === 'first learner message') {
          return firstTurnDeferred.promise;
        }

        if (body.transcript === 'second learner message') {
          expect(body.snapshot.speechRevision).toBe(2);
          expect(body.snapshot.speech).toBe('First tutor reply');
          return Promise.resolve(jsonResponse({ snapshot: secondTurnSnapshot }));
        }
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<Harness />);

    await waitFor(() => {
      expect(latestSession).not.toBeNull();
    });

    await act(async () => {
      await latestSession!.startSession();
    });

    let firstSubmitPromise: Promise<boolean> | null = null;

    await act(async () => {
      firstSubmitPromise = latestSession!.submitTranscript('first learner message');
      await Promise.resolve();
    });

    await act(async () => {
      const queued = await latestSession!.submitTranscript('second learner message');
      expect(queued).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstTurnDeferred.resolve(jsonResponse({ snapshot: firstTurnSnapshot }));
      await firstSubmitPromise;
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const lastTurnRequest = fetchMock.mock.calls[2];
    const lastTurnBody = JSON.parse(String(lastTurnRequest?.[1]?.body)) as {
      transcript: string;
    };

    expect(lastTurnBody.transcript).toBe('second learner message');
  });

  it('retries article persistence when the guest store throws a transient write error', async () => {
    const initialSnapshot = buildSnapshot();
    const completedSnapshot = buildSnapshot({
      status: 'completed',
      speechRevision: 2,
      turns: [
        {
          actor: 'user',
          text: 'Teach me Python basics',
          createdAt: '2026-04-22T10:00:00.000Z',
        },
        {
          actor: 'tutor',
          text: 'Let us recap the lesson.',
          createdAt: '2026-04-22T10:00:01.000Z',
        },
      ],
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/tutor/session/create') {
        return Promise.resolve(jsonResponse({ snapshot: initialSnapshot }));
      }

      if (url === '/api/tutor/turn') {
        return Promise.resolve(jsonResponse({ snapshot: completedSnapshot }));
      }

      if (url === '/api/tutor/article') {
        return Promise.resolve(
          jsonResponse({
            article: {
              id: 'article-1',
              session_id: completedSnapshot.sessionId,
              user_id: 'guest',
              title: 'Python Basics',
              article_markdown: '# Python Basics\n\n## Overview\n\nStudy notes.',
              article_storage_path: '',
              metadata_json: {},
              created_at: '2026-04-22T10:00:02.000Z',
              updated_at: '2026-04-22T10:00:02.000Z',
            },
          })
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const saveGuestLessonMock = vi.mocked(saveGuestLesson);
    saveGuestLessonMock
      .mockImplementationOnce(() => {
        throw new Error(
          'Compaction failed: Another write batch or compaction is already active'
        );
      })
      .mockImplementationOnce(() => {
        throw new Error(
          'Compaction failed: Another write batch or compaction is already active'
        );
      })
      .mockImplementation(() => undefined);

    render(<Harness />);

    await waitFor(() => {
      expect(latestSession).not.toBeNull();
    });

    await act(async () => {
      await latestSession!.startSession();
    });

    await act(async () => {
      await latestSession!.submitTranscript('Teach me Python basics');
    });

    await waitFor(() => {
      expect(latestSession?.article?.title).toBe('Python Basics');
    });

    expect(saveGuestLessonMock).toHaveBeenCalledTimes(3);
  });
});
