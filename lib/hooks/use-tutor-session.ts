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
import type {
  TutorLlmDebugTrace,
  TutorRuntimeSnapshot,
  TutorSessionCreateResponse,
  TutorTurnResponse,
} from '@/lib/types/tutor';
import type { LessonArticleRecord } from '@/lib/types/database';

function logTutorDebug(stage: 'session_create' | 'turn', debug?: TutorLlmDebugTrace) {
  if (process.env.NODE_ENV === 'production' || !debug) {
    return;
  }

  console.groupCollapsed(`[tutor:${stage}] llm trace`);
  console.log('system prompt + history', debug.messages);
  console.log('raw response text', debug.rawResponseText);
  console.log('raw model content', debug.rawModelContent);
  console.log('parsed response', debug.parsedResponse);
  console.log('fallback', {
    usedFallback: debug.usedFallback,
    fallbackReason: debug.fallbackReason,
  });
  console.groupEnd();
}

export function useTutorSession() {
  const [snapshot, setSnapshot] = useState<TutorRuntimeSnapshot | null>(null);
  const [phase, setPhase] = useState<'intake' | 'preparing' | 'live' | 'error'>('intake');
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [article, setArticle] = useState<LessonArticleRecord | null>(null);

  const articleGenRef = useRef(false);

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
            saveGuestLesson(lessonRecord);
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

  const submitTranscript = useCallback(
    async (transcript: string) => {
      const activeSnapshot = snapshot;
      if (!activeSnapshot || !transcript.trim() || isSubmittingTurn) {
        return false;
      }

      setIsSubmittingTurn(true);
      setError(null);

      try {
        const response = await fetch('/api/tutor/turn', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snapshot: activeSnapshot,
            transcript,
          }),
        });

        const payload = (await response.json()) as TutorTurnResponse & { error?: string };

        if (!response.ok || !payload.snapshot) {
          throw new Error(payload.error || 'Failed to continue the tutor session');
        }

        logTutorDebug('turn', payload.debug);

        setSnapshot(payload.snapshot);
        return true;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to continue the tutor session');
        throw nextError;
      } finally {
        setIsSubmittingTurn(false);
      }
    },
    [isSubmittingTurn, snapshot]
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
