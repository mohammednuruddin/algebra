'use client';

import { useEffect, useRef } from 'react';

const TTS_REQUEST_TIMEOUT_MS = 15000;

interface TutorVoicePlayerProps {
  text: string;
  voiceId: string;
  provider: 'inworld' | 'elevenlabs';
  modelId: string;
  enabled: boolean;
  playToken: number;
  paused?: boolean;
  stopSignal?: number;
  onRequestStart?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function TutorVoicePlayer({
  text,
  voiceId,
  provider,
  modelId,
  enabled,
  playToken,
  paused = false,
  stopSignal,
  onRequestStart,
  onStart,
  onComplete,
  onError,
}: TutorVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const handlersRef = useRef({ onRequestStart, onStart, onComplete, onError });
  const lastPlayKeyRef = useRef<string | null>(null);
  const pausedByParentRef = useRef(false);

  useEffect(() => {
    handlersRef.current = { onRequestStart, onStart, onComplete, onError };
  }, [onComplete, onError, onRequestStart, onStart]);

  useEffect(() => {
    if (!enabled || !text.trim()) {
      return;
    }

    const playKey = `${playToken}:${provider}:${modelId}:${voiceId}:${text}`;
    if (lastPlayKeyRef.current === playKey) {
      return;
    }
    lastPlayKeyRef.current = playKey;

    let cancelled = false;
    let settled = false;
    let requestTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();

    const clearRequestTimeout = () => {
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        requestTimeoutId = null;
      }
    };

    const settlePlayback = (outcome: 'complete' | 'error', error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearRequestTimeout();

      if (outcome === 'complete') {
        pausedByParentRef.current = false;
        handlersRef.current.onComplete?.();
        return;
      }

      pausedByParentRef.current = false;
      handlersRef.current.onError?.(error || new Error('Audio playback failed'));
    };

    const play = async () => {
      try {
        handlersRef.current.onRequestStart?.();
        requestTimeoutId = setTimeout(() => {
          abortController.abort(new Error('Tutor audio request timed out'));
        }, TTS_REQUEST_TIMEOUT_MS);

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            text,
            provider,
            voiceId,
            modelId,
            voiceSettings: {
              stability: 0.45,
              similarityBoost: 0.8,
              style: 0,
              useSpeakerBoost: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate tutor audio');
        }

        const blob = await response.blob();
        if (cancelled) {
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        if (audioRef.current) {
          audioRef.current.pause();
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.preload = 'auto';
        audio.onended = () => {
          audioRef.current = null;
          pausedByParentRef.current = false;
          settlePlayback('complete');
        };
        audio.onerror = () => {
          audioRef.current = null;
          pausedByParentRef.current = false;
          settlePlayback('error', new Error('Audio playback failed'));
        };
        await audio.play();
        if (cancelled) {
          audio.pause();
          audioRef.current = null;
          settlePlayback('complete');
          return;
        }

        handlersRef.current.onStart?.();
      } catch (error) {
        if (!cancelled) {
          settlePlayback(
            'error',
            error instanceof Error ? error : new Error('Audio playback failed')
          );
        }
      }
    };

    void play();

    return () => {
      cancelled = true;
      abortController.abort();
      clearRequestTimeout();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      pausedByParentRef.current = false;
      settlePlayback('complete');
    };
  }, [enabled, modelId, playToken, provider, text, voiceId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      pausedByParentRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
    pausedByParentRef.current = false;
    handlersRef.current.onComplete?.();
  }, [stopSignal]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (paused) {
      if (!pausedByParentRef.current) {
        audio.pause();
        pausedByParentRef.current = true;
      }
      return;
    }

    if (!pausedByParentRef.current) {
      return;
    }

    pausedByParentRef.current = false;
    void audio.play().catch((error) => {
      handlersRef.current.onError?.(
        error instanceof Error ? error : new Error('Audio playback failed')
      );
    });
  }, [paused]);

  return null;
}
