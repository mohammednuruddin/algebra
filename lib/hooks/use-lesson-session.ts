'use client';

import { useState, useCallback } from 'react';
import { 
  LessonPreparationStage,
  MediaAsset,
  LessonPlan,
  TeacherResponse, 
  LearnerInput, 
  SessionSummary 
} from '../types/lesson';
import { 
  createSession, 
  submitTurn, 
  endSession 
} from '../api/lesson-api';
import { getGuestLesson } from '@/lib/guest/guest-lesson-store';

interface SessionState {
  sessionId: string | null;
  lastResponse: TeacherResponse | null;
  summary: SessionSummary | null;
  isComplete: boolean;
  lessonPlan: LessonPlan | null;
  mediaAssets: MediaAsset[];
  activeImageId: string | null;
}

export function useLessonSession() {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    lastResponse: null,
    summary: null,
    isComplete: false,
    lessonPlan: null,
    mediaAssets: [],
    activeImageId: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparationStages, setPreparationStages] = useState<LessonPreparationStage[]>([]);

  const startLesson = useCallback(async (topic: string) => {
    setLoading(true);
    setError(null);
    setPreparationStages([]);
    try {
      const data = await createSession(topic, (stage) => {
        setPreparationStages((previous) => {
          const next = previous.filter((item) => item.id !== stage.id);
          return [...next, stage];
        });
      });
      const guestLesson = getGuestLesson(data.sessionId);
      setState({
        sessionId: data.sessionId,
        lastResponse: data.initialResponse,
        summary: null,
        isComplete: false,
        lessonPlan: guestLesson?.lessonPlan || null,
        mediaAssets: guestLesson?.mediaAssets || [],
        activeImageId: guestLesson?.activeImageId || null,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start lesson';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitResponse = useCallback(async (input: LearnerInput) => {
    if (!state.sessionId) {
      setError('No active session');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await submitTurn(state.sessionId, input);
      const guestLesson = getGuestLesson(state.sessionId);
      setState(prev => ({
        ...prev,
        lastResponse: data.response,
        isComplete: data.isSessionComplete,
        summary: data.summary || prev.summary,
        lessonPlan: guestLesson?.lessonPlan || prev.lessonPlan,
        mediaAssets: guestLesson?.mediaAssets || prev.mediaAssets,
        activeImageId: guestLesson?.activeImageId || prev.activeImageId,
      }));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit response';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.sessionId]);

  const endLesson = useCallback(async () => {
    if (!state.sessionId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await endSession(state.sessionId);
      const guestLesson = getGuestLesson(state.sessionId);
      setState(prev => ({
        ...prev,
        summary: data.summary,
        isComplete: true,
        lessonPlan: guestLesson?.lessonPlan || prev.lessonPlan,
        mediaAssets: guestLesson?.mediaAssets || prev.mediaAssets,
        activeImageId: guestLesson?.activeImageId || prev.activeImageId,
      }));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end lesson';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.sessionId]);

  return {
    ...state,
    loading,
    error,
    preparationStages,
    startLesson,
    submitResponse,
    endLesson,
  };
}
