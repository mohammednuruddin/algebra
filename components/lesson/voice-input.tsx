'use client';

import { useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useMicVAD } from '@ricky0123/vad-react';
import { utils as vadUtils } from '@ricky0123/vad-web';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({
  onTranscript,
  onPartialTranscript,
  disabled = false,
}: VoiceInputProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const vad = useMicVAD({
    startOnLoad: false,
    onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/',
    baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/',
    model: 'v5',
    onSpeechStart: () => {
      setError(null);
      onPartialTranscript?.('Listening...');
    },
    onSpeechEnd: async (audio) => {
      try {
        setIsTranscribing(true);
        onPartialTranscript?.('Transcribing...');

        const wav = vadUtils.encodeWAV(audio, 1, 16000, 1, 16);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', blob, 'learner-turn.wav');

        const response = await fetch('/api/elevenlabs/transcribe', {
          method: 'POST',
          body: formData,
        });

        const payload = (await response.json()) as {
          transcript?: string;
          error?: string;
        };

        if (!response.ok || !payload.transcript) {
          throw new Error(payload.error || 'Transcription failed');
        }

        setTranscript(payload.transcript);
        onPartialTranscript?.('');
        onTranscript(payload.transcript);
      } catch (transcriptionError) {
        const message =
          transcriptionError instanceof Error
            ? transcriptionError.message
            : 'Transcription failed';
        setError(message);
        onPartialTranscript?.('');
      } finally {
        setIsTranscribing(false);
      }
    },
  });

  const handleToggle = async () => {
    if (disabled || vad.loading || isTranscribing) {
      return;
    }

    try {
      setError(null);
      if (vad.listening) {
        await vad.pause();
        onPartialTranscript?.('');
      } else {
        await vad.start();
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Microphone failed');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleToggle}
        disabled={disabled || vad.loading || isTranscribing}
        className={`
          p-4 rounded-full transition-all
          ${vad.listening ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-slate-950 hover:bg-slate-800'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          text-white shadow-lg
        `}
        aria-label={vad.listening ? 'Pause microphone' : 'Start microphone'}
      >
        {vad.loading || isTranscribing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : vad.listening ? (
          <Mic className="w-6 h-6" />
        ) : (
          <MicOff className="w-6 h-6" />
        )}
      </button>

      <div className="text-sm text-gray-600">
        Status: {error ? 'error' : isTranscribing ? 'transcribing' : vad.listening ? 'listening' : 'idle'}
      </div>

      {transcript && (
        <div className="text-sm text-gray-700 text-center max-w-sm">{transcript}</div>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  );
}
