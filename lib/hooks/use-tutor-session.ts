'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { saveGuestTutorSnapshot } from '@/lib/guest/guest-tutor-store';
import {
  saveGuestLesson,
  createGuestLesson,
  type GuestLessonRecord,
} from '@/lib/guest/guest-lesson-store';
import {
  summarizeTutorCanvas,
  updateTutorCanvasTokenZone,
  updateTutorEquationChoice,
} from '@/lib/tutor/runtime';
import { formatTutorDebugMessages, formatTutorDebugValue } from '@/lib/tutor/debug-log';
import { retryAsync } from '@/lib/utils/retry';
import type {
  TutorCanvasEvidence,
  TutorCanvasInteraction,
  TutorLlmDebugTrace,
  TutorRuntimeSnapshot,
  TutorSessionCreateResponse,
  TutorTurnResponse,
} from '@/lib/types/tutor';

type TutorTurnSubmitOptions = {
  canvasEvidence?: TutorCanvasEvidence | null;
  canvasInteraction?: TutorCanvasInteraction | null;
};

type QueuedTutorTurn = {
  transcript: string;
  canvasEvidence?: TutorCanvasEvidence | null;
  canvasInteraction?: TutorCanvasInteraction | null;
};
import type { LessonArticleRecord } from '@/lib/types/database';

function logTutorDebug(stage: 'session_create' | 'turn', debug?: TutorLlmDebugTrace) {
  if (process.env.NODE_ENV === 'production' || !debug) {
    return;
  }

  console.groupCollapsed(`[tutor:${stage}] llm trace`);
  console.log(
    'system prompt + history\n' +
      JSON.stringify(formatTutorDebugMessages(debug.messages), null, 2)
  );
  console.log('raw response text', formatTutorDebugValue(debug.rawResponseText));
  console.log('raw model content', formatTutorDebugValue(debug.rawModelContent));
  console.log('parsed response', formatTutorDebugValue(debug.parsedResponse));
  console.log('fallback', {
    usedFallback: debug.usedFallback,
    fallbackReason: debug.fallbackReason,
  });
  console.groupEnd();
}

function isRetryableGuestLessonWriteError(error: unknown) {
  return (
    error instanceof Error &&
    /compaction|write batch|already active/i.test(error.message)
  );
}

export function useTutorSession() {
  const [snapshot, setSnapshot] = useState<TutorRuntimeSnapshot | null>(null);
  const [phase, setPhase] = useState<'intake' | 'preparing' | 'live' | 'error'>('intake');
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [article, setArticle] = useState<LessonArticleRecord | null>(null);

  const articleGenRef = useRef(false);
  const snapshotRef = useRef<TutorRuntimeSnapshot | null>(null);
  const isSubmittingTurnRef = useRef(false);
  const queuedTranscriptsRef = useRef<QueuedTutorTurn[]>([]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    saveGuestTutorSnapshot(snapshot);

    if (snapshot.status === 'completed' && !article && !articleGenRef.current) {
      articleGenRef.current = true;
      setIsGeneratingArticle(true);
      fetch('/api/tutor/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as { article?: LessonArticleRecord };
          if (payload.article) {
            setArticle(payload.article);
            const lessonRecord: GuestLessonRecord = {
              ...createGuestLesson(snapshot.lessonTopic),
              id: snapshot.sessionId,
              status: 'complete',
              article: payload.article,
            };
            await retryAsync(
              async () => {
                saveGuestLesson(lessonRecord);
              },
              {
                attempts: 3,
                shouldRetry: isRetryableGuestLessonWriteError,
              }
            );
          }
        })
        .catch((err) => console.error('Article generation failed:', err))
        .finally(() => setIsGeneratingArticle(false));
    }
  }, [snapshot, article]);

  const startSession = useCallback(
    async (
      input: {
        topic?: string;
        learnerLevel?: string;
        prompt?: string;
      } = {}
    ) => {
      setPhase('preparing');
      setError(null);

      try {
        const response = await fetch('/api/tutor/session/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const payload = (await response.json()) as TutorSessionCreateResponse & { error?: string };

        if (!response.ok || !payload.snapshot) {
          throw new Error(payload.error || 'Failed to prepare the tutor session');
        }

        logTutorDebug('session_create', payload.debug);

        snapshotRef.current = payload.snapshot;
        setSnapshot(payload.snapshot);
        setPhase('live');
        return payload.snapshot;
      } catch (nextError) {
        setPhase('error');
        setError(nextError instanceof Error ? nextError.message : 'Failed to prepare the tutor session');
        throw nextError;
      }
    },
    []
  );

  const performTurnSubmission = useCallback(
    async (
      activeSnapshot: TutorRuntimeSnapshot,
      transcript: string,
      options?: TutorTurnSubmitOptions
    ) => {
      const response = await fetch('/api/tutor/turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snapshot: activeSnapshot,
          transcript,
          canvasEvidence: options?.canvasEvidence ?? null,
          canvasInteraction: options?.canvasInteraction ?? null,
        }),
      });

      const payload = (await response.json()) as TutorTurnResponse & { error?: string };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || 'Failed to continue the tutor session');
      }

      logTutorDebug('turn', payload.debug);

      snapshotRef.current = payload.snapshot;
      setSnapshot(payload.snapshot);
      return true;
    },
    []
  );

  const flushQueuedTranscripts = useCallback(async () => {
    if (isSubmittingTurnRef.current) {
      return;
    }

    const activeSnapshot = snapshotRef.current;
    const nextTurn = queuedTranscriptsRef.current.shift();

    if (!activeSnapshot || !nextTurn) {
      return;
    }

    isSubmittingTurnRef.current = true;
    setIsSubmittingTurn(true);
    setError(null);

    try {
      await performTurnSubmission(activeSnapshot, nextTurn.transcript, {
        canvasEvidence: nextTurn.canvasEvidence,
        canvasInteraction: nextTurn.canvasInteraction,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Failed to continue the tutor session'
      );
      throw nextError;
    } finally {
      isSubmittingTurnRef.current = false;
      setIsSubmittingTurn(false);

      if (queuedTranscriptsRef.current.length > 0) {
        queueMicrotask(() => {
          void flushQueuedTranscripts();
        });
      }
    }
  }, [performTurnSubmission]);

  const submitTranscript = useCallback(
    async (transcript: string, options?: TutorTurnSubmitOptions) => {
      const trimmedTranscript = transcript.trim();
      const activeSnapshot = snapshotRef.current;

      if (!activeSnapshot || !trimmedTranscript) {
        return false;
      }

      if (isSubmittingTurnRef.current) {
        queuedTranscriptsRef.current.push({
          transcript: trimmedTranscript,
          canvasEvidence: options?.canvasEvidence ?? null,
          canvasInteraction: options?.canvasInteraction ?? null,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.info('[tutor:turn_queue] queued learner transcript while a turn was submitting', {
            transcript: trimmedTranscript,
            queuedCount: queuedTranscriptsRef.current.length,
            hasCanvasEvidence: Boolean(options?.canvasEvidence?.dataUrl),
            hasCanvasInteraction: Boolean(options?.canvasInteraction),
          });
        }

        return true;
      }

      isSubmittingTurnRef.current = true;
      setIsSubmittingTurn(true);
      setError(null);

      try {
        return await performTurnSubmission(activeSnapshot, trimmedTranscript, options);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to continue the tutor session');
        throw nextError;
      } finally {
        isSubmittingTurnRef.current = false;
        setIsSubmittingTurn(false);

        if (queuedTranscriptsRef.current.length > 0) {
          queueMicrotask(() => {
            void flushQueuedTranscripts();
          });
        }
      }
    },
    [flushQueuedTranscripts, performTurnSubmission]
  );

  const moveToken = useCallback((tokenId: string, zoneId: string | null) => {
    setSnapshot((current) =>
      current
        ? {
            ...current,
            canvas: updateTutorCanvasTokenZone(current.canvas, tokenId, zoneId),
          }
        : current
    );
  }, []);

  const chooseEquationAnswer = useCallback((choiceId: string) => {
    setSnapshot((current) =>
      current
        ? {
            ...current,
            canvas: updateTutorEquationChoice(current.canvas, choiceId),
          }
        : current
    );
  }, []);

  return {
    snapshot,
    phase,
    error,
    isSubmittingTurn,
    isGeneratingArticle,
    article,
    startSession,
    submitTranscript,
    moveToken,
    chooseEquationAnswer,
    canvasSummary: snapshot ? summarizeTutorCanvas(snapshot.canvas) : '',
  };
}
