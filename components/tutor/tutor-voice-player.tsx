'use client';

import { useEffect, useRef } from 'react';

interface TutorVoicePlayerProps {
  text: string;
  voiceId: string;
  provider: 'inworld' | 'elevenlabs';
  modelId: string;
  enabled: boolean;
  playToken: number;
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
  onStart,
  onComplete,
  onError,
}: TutorVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const handlersRef = useRef({ onStart, onComplete, onError });
  const lastPlayKeyRef = useRef<string | null>(null);

  useEffect(() => {
    handlersRef.current = { onStart, onComplete, onError };
  }, [onComplete, onError, onStart]);

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

    const play = async () => {
      try {
        handlersRef.current.onStart?.();

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        audio.onended = () => handlersRef.current.onComplete?.();
        audio.onerror = () => handlersRef.current.onError?.(new Error('Audio playback failed'));
        await audio.play();
      } catch (error) {
        if (!cancelled) {
          handlersRef.current.onError?.(
            error instanceof Error ? error : new Error('Audio playback failed')
          );
        }
      }
    };

    void play();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
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
    };
  }, []);

  return null;
}
