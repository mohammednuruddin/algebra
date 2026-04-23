'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play } from 'lucide-react';

interface VoiceOutputProps {
  text: string;
  voiceId?: string;
  autoPlay?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  stopSignal?: number;
}

/**
 * Voice output component using ElevenLabs TTS API
 * Converts text to speech with natural voice output and optimized buffering
 */
export function VoiceOutput({ 
  text, 
  voiceId = 'hpp4J3VqNfWAUOO0d1Us',
  autoPlay = false,
  onStart,
  onComplete,
  onError,
  stopSignal,
}: VoiceOutputProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(isMuted);
  const handlersRef = useRef({ onStart, onComplete, onError });
  const currentAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    handlersRef.current = { onStart, onComplete, onError };
  }, [onStart, onComplete, onError]);

  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.volume = mutedRef.current ? 0 : 1;
    
    audio.onplay = () => {
      setIsPlaying(true);
      handlersRef.current.onStart?.();
    };
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => {
      setIsPlaying(false);
      handlersRef.current.onComplete?.();
    };
    audio.onerror = () => {
      setIsPlaying(false);
      const err = new Error('Audio playback error');
      setError(err.message);
      handlersRef.current.onError?.(err);
    };

    audioRef.current = audio;
    
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      setError('Failed to play audio');
    });
  }, []);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      try {
        const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          audioContextRef.current = new AudioContextCtor();
        }
      } catch (e) {
        // AudioContext not available (e.g., in tests)
        console.warn('AudioContext not available:', e);
      }
    }
    
    return () => {
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close().catch((error) => {
          console.warn('AudioContext close skipped:', error);
        });
      }
    };
  }, []);

  // Generate audio when text changes
  useEffect(() => {
    if (!text) return;

    const generateAudio = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        const response = await fetch('/api/elevenlabs/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voiceId,
            modelId: 'eleven_flash_v2_5',
            voiceSettings: {
              stability: 0.5,
              similarityBoost: 0.75,
              style: 0.0,
              useSpeakerBoost: true,
            },
            optimizeStreamingLatency: 3, // Optimize for low latency
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        if (currentAudioUrlRef.current && currentAudioUrlRef.current !== url) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
        }
        currentAudioUrlRef.current = url;
        setAudioUrl(url);

        // Preload audio buffer for faster playback
        const arrayBuffer = await audioBlob.arrayBuffer();
        if (audioContextRef.current) {
          await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
        }

        setIsLoading(false);

        // Auto-play if enabled
        if (autoPlay) {
          playAudio(url);
        }
        } catch (err) {
          console.error('Error generating audio:', err);
          const errorObj = err instanceof Error ? err : new Error('Failed to generate audio');
          setError(errorObj.message);
          setIsLoading(false);
          handlersRef.current.onError?.(errorObj);
        }
      };

    generateAudio();
  }, [text, voiceId, autoPlay, playAudio]);

  const togglePlayback = useCallback(() => {
    if (!audioUrl || isLoading) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    } else if (audioUrl) {
      playAudio(audioUrl);
    }
  }, [audioUrl, isPlaying, isLoading, playAudio]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : 1;
    }
    setIsMuted(nextMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    setIsPlaying(false);
  }, [stopSignal]);

  useEffect(() => {
    return () => {
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    };
  }, []);

  if (!text) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlayback}
        disabled={!audioUrl || !!error || isLoading}
        className={`
          p-2 rounded-full transition-all
          ${isPlaying ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600'}
          ${!audioUrl || error || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          text-white
        `}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      <button
        onClick={toggleMute}
        disabled={!audioUrl || !!error || isLoading}
        className={`
          p-2 rounded-full transition-all
          bg-gray-500 hover:bg-gray-600
          ${!audioUrl || error || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          text-white
        `}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>

      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </div>
  );
}
