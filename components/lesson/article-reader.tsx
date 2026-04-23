'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Pause, Play, SkipForward, SkipBack } from 'lucide-react';

interface ArticleReaderProps {
  markdown: string;
  title: string;
}

type ReaderState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// Strip markdown formatting to get plain text for TTS
function stripMarkdown(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Split text into manageable chunks (ElevenLabs has limits)
function splitIntoChunks(text: string, maxChunkSize = 2500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function ArticleReader({ markdown, title }: ArticleReaderProps) {
  const [state, setState] = useState<ReaderState>('idle');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if voice is enabled
  useEffect(() => {
    fetch('/api/runtime/config')
      .then((res) => res.json())
      .then((config) => {
        setVoiceEnabled(config.voiceEnabled && config.speechToTextEnabled);
      })
      .catch(() => {
        setVoiceEnabled(false);
      });
  }, []);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const playChunk = useCallback(async (chunkIndex: number) => {
    if (chunkIndex >= chunksRef.current.length) {
      setState('idle');
      setCurrentChunk(0);
      return;
    }

    setState('loading');
    setCurrentChunk(chunkIndex);

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunksRef.current[chunkIndex],
          voiceId: 'hpp4J3VqNfWAUOO0d1Us', // Default teacher voice
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        // Auto-play next chunk
        playChunk(chunkIndex + 1);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setState('error');
      };

      await audio.play();
      setState('playing');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error playing audio:', error);
      setState('error');
    }
  }, []);

  const handleStart = useCallback(() => {
    const plainText = stripMarkdown(markdown);
    const chunks = splitIntoChunks(plainText);
    chunksRef.current = chunks;
    setTotalChunks(chunks.length);
    setCurrentChunk(0);
    playChunk(0);
  }, [markdown, playChunk]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState('paused');
    }
  }, []);

  const handleResume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setState('playing');
    }
  }, []);

  const handleStop = useCallback(() => {
    cleanup();
    setState('idle');
    setCurrentChunk(0);
  }, [cleanup]);

  const handleNext = useCallback(() => {
    if (currentChunk < totalChunks - 1) {
      cleanup();
      playChunk(currentChunk + 1);
    }
  }, [currentChunk, totalChunks, cleanup, playChunk]);

  const handlePrevious = useCallback(() => {
    if (currentChunk > 0) {
      cleanup();
      playChunk(currentChunk - 1);
    }
  }, [currentChunk, cleanup, playChunk]);

  if (voiceEnabled === null) {
    return null; // Loading
  }

  if (!voiceEnabled) {
    return null; // Voice not available
  }

  if (state === 'idle') {
    return (
      <button
        onClick={handleStart}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors"
        title="Read article aloud"
      >
        <Volume2 className="w-4 h-4" />
        Read Aloud
      </button>
    );
  }

  if (state === 'error') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-full">
        <VolumeX className="w-4 h-4" />
        Audio error
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm">
      {/* Previous */}
      <button
        onClick={handlePrevious}
        disabled={currentChunk === 0 || state === 'loading'}
        className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Previous section"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      {/* Play/Pause */}
      {state === 'playing' ? (
        <button
          onClick={handlePause}
          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
          title="Pause"
        >
          <Pause className="w-4 h-4" />
        </button>
      ) : state === 'paused' ? (
        <button
          onClick={handleResume}
          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
          title="Resume"
        >
          <Play className="w-4 h-4" />
        </button>
      ) : (
        <div className="p-1.5">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={currentChunk >= totalChunks - 1 || state === 'loading'}
        className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Next section"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Progress */}
      <div className="px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-l border-zinc-200 dark:border-zinc-700">
        {currentChunk + 1} / {totalChunks}
      </div>

      {/* Stop */}
      <button
        onClick={handleStop}
        className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 transition-colors border-l border-zinc-200 dark:border-zinc-700"
        title="Stop reading"
      >
        <VolumeX className="w-4 h-4" />
      </button>
    </div>
  );
}
