'use client';

import { useState, useCallback } from 'react';
import { InputMode } from '../types/lesson';

export type LessonView = 'start' | 'board' | 'summary';

export function useLessonState() {
  const [currentView, setCurrentView] = useState<LessonView>('start');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isProcessing, setIsProcessing] = useState(false);

  const setView = useCallback((view: LessonView) => {
    setCurrentView(view);
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  return {
    currentView,
    inputMode,
    isProcessing,
    setView,
    setInputMode,
    setProcessing,
  };
}
