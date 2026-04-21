'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioWaveform, Loader2, Mic, Square } from 'lucide-react';

interface VoiceDockProps {
  disabled?: boolean;
  voiceEnabled?: boolean;
  speechToTextEnabled?: boolean;
  runtimeStatus?: 'loading' | 'ready' | 'error';
  teacherSpeaking?: boolean;
  idleHint?: string;
  onTranscript: (text: string) => void;
  onSpeechStart?: () => void;
}

type TurnMessage = {
  type?: string;
  transcript?: string;
  turn_is_formatted?: boolean;
};

const STREAM_SAMPLE_RATE = 16000;
const STREAM_QUERY = new URLSearchParams({
  sample_rate: String(STREAM_SAMPLE_RATE),
  speech_model: 'u3-rt-pro',
  format_turns: 'true',
  end_of_turn_confidence_threshold: '0.4',
  min_end_of_turn_silence_when_confident: '100',
  max_turn_silence: '1000',
  vad_threshold: '0.4',
  speaker_labels: 'false',
  language_detection: 'false',
});

function downsampleToInt16(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate = STREAM_SAMPLE_RATE
) {
  if (inputSampleRate === outputSampleRate) {
    const pcm = new Int16Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(samples.length / ratio);
  const pcm = new Int16Array(outputLength);
  let sourceIndex = 0;

  for (let index = 0; index < outputLength; index += 1) {
    const nextSourceIndex = Math.round((index + 1) * ratio);
    let sum = 0;
    let count = 0;

    for (; sourceIndex < nextSourceIndex && sourceIndex < samples.length; sourceIndex += 1) {
      sum += samples[sourceIndex] ?? 0;
      count += 1;
    }

    const averaged = count > 0 ? sum / count : 0;
    const clamped = Math.max(-1, Math.min(1, averaged));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return pcm;
}

function computeLevel(samples: Float32Array) {
  let total = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    total += sample * sample;
  }

  return Math.sqrt(total / Math.max(samples.length, 1));
}

export function VoiceDock({
  disabled = false,
  voiceEnabled = false,
  speechToTextEnabled = false,
  runtimeStatus = 'loading',
  teacherSpeaking = false,
  idleHint,
  onTranscript,
  onSpeechStart,
}: VoiceDockProps) {
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [streamingState, setStreamingState] = useState<
    'idle' | 'connecting' | 'listening' | 'transcribing'
  >('idle');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [userSpeaking, setUserSpeaking] = useState(false);

  const websocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mountedRef = useRef(true);
  const stoppingRef = useRef(false);

  const stopStreaming = useCallback(async (reason: 'idle' | 'transcribing' = 'idle') => {
    stoppingRef.current = true;

    const processorNode = processorNodeRef.current;
    if (processorNode) {
      processorNode.onaudioprocess = null;
      try {
        processorNode.disconnect();
      } catch {
        // noop
      }
    }
    processorNodeRef.current = null;

    const sourceNode = sourceNodeRef.current;
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch {
        // noop
      }
    }
    sourceNodeRef.current = null;

    const mediaStream = mediaStreamRef.current;
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    mediaStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch {
        // noop
      }
    }

    const websocket = websocketRef.current;
    websocketRef.current = null;
    if (websocket) {
      try {
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: 'Terminate' }));
        }
        websocket.close();
      } catch {
        // noop
      }
    }

    if (mountedRef.current) {
      setStreamingState(reason);
      setVoiceLevel(0);
      setUserSpeaking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      void stopStreaming('idle');
    };
  }, [stopStreaming]);

  const startStreaming = useCallback(async () => {
    if (
      disabled ||
      runtimeStatus !== 'ready' ||
      !speechToTextEnabled ||
      streamingState === 'connecting' ||
      streamingState === 'listening' ||
      streamingState === 'transcribing'
    ) {
      return;
    }

    setError(null);
    setTranscript('');
    setStreamingState('connecting');
    stoppingRef.current = false;

    try {
      const tokenResponse = await fetch('/api/assemblyai/token', {
        cache: 'no-store',
      });
      const tokenPayload = (await tokenResponse.json()) as {
        token?: string;
        error?: string;
      };

      if (!tokenResponse.ok || !tokenPayload.token) {
        throw new Error(tokenPayload.error || 'Failed to create streaming token');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error('AudioContext is not available in this browser');
      }

      const audioContext = new AudioContextCtor();
      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      processorNode.connect(audioContext.destination);
      sourceNode.connect(processorNode);

      const websocket = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${STREAM_QUERY.toString()}&token=${encodeURIComponent(tokenPayload.token)}`
      );
      websocket.binaryType = 'arraybuffer';

      mediaStreamRef.current = mediaStream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      processorNodeRef.current = processorNode;
      websocketRef.current = websocket;

      websocket.onopen = () => {
        if (!mountedRef.current || stoppingRef.current) {
          return;
        }

        setStreamingState('listening');
        onSpeechStart?.();
      };

      websocket.onmessage = async (event) => {
        if (!mountedRef.current) {
          return;
        }

        const payload = JSON.parse(String(event.data)) as TurnMessage;

        if (payload.type === 'Turn') {
          const nextTranscript = payload.transcript?.trim() || '';
          if (nextTranscript) {
            setTranscript(nextTranscript);
          }

          if (payload.turn_is_formatted && nextTranscript) {
            setStreamingState('transcribing');
            await stopStreaming('idle');
            onTranscript(nextTranscript);
          }
        }
      };

      websocket.onerror = () => {
        if (!mountedRef.current) {
          return;
        }

        setError('Streaming connection failed');
        void stopStreaming('idle');
      };

      websocket.onclose = () => {
        if (!mountedRef.current || stoppingRef.current) {
          return;
        }

        void stopStreaming('idle');
      };

      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const level = computeLevel(input);

        if (mountedRef.current) {
          setVoiceLevel(level);
          setUserSpeaking(level > 0.015);
        }

        if (websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        const pcm = downsampleToInt16(input, audioContext.sampleRate);
        websocket.send(pcm.buffer);
      };
    } catch (streamError) {
      if (mountedRef.current) {
        setError(
          streamError instanceof Error ? streamError.message : 'Streaming failed'
        );
      }
      await stopStreaming('idle');
    }
  }, [
    disabled,
    onSpeechStart,
    onTranscript,
    runtimeStatus,
    speechToTextEnabled,
    stopStreaming,
    streamingState,
  ]);

  const handleToggle = useCallback(async () => {
    if (streamingState === 'listening' || streamingState === 'transcribing') {
      await stopStreaming('idle');
      return;
    }

    await startStreaming();
  }, [startStreaming, stopStreaming, streamingState]);

  const statusText = useMemo(() => {
    if (error) {
      return error;
    }

    if (runtimeStatus === 'loading') {
      return 'Checking microphone and speech services...';
    }

    if (runtimeStatus === 'error') {
      return 'Voice config failed to load';
    }

    if (!speechToTextEnabled) {
      return 'Learner voice is unavailable';
    }

    if (teacherSpeaking) {
      return 'Teacher speaking. Tap to interrupt with a new turn.';
    }

    if (streamingState === 'connecting') {
      return 'Connecting live transcript...';
    }

    if (streamingState === 'transcribing') {
      return transcript || 'Finalizing your turn...';
    }

    if (transcript.trim()) {
      return transcript.trim();
    }

    if (streamingState === 'listening') {
      return userSpeaking
        ? 'Listening live...'
        : idleHint?.trim() || 'Streaming and waiting for your voice';
    }

    return idleHint?.trim() || 'Tap to start a live voice turn';
  }, [
    error,
    idleHint,
    runtimeStatus,
    speechToTextEnabled,
    teacherSpeaking,
    transcript,
    streamingState,
    userSpeaking,
  ]);

  const bars = [18, 30, 42, 30, 18];
  const live = streamingState === 'listening';

  return (
    <div className="pointer-events-auto w-full rounded-3xl border border-slate-800 bg-slate-950/96 p-4 text-white shadow-[0_30px_90px_-32px_rgba(2,6,23,0.82)] backdrop-blur-xl">
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || runtimeStatus !== 'ready' || !speechToTextEnabled}
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-all ${
            live
              ? 'bg-cyan-500 text-white shadow-[0_16px_40px_-18px_rgba(34,211,238,0.9)] ring-4 ring-cyan-400/15'
              : 'bg-slate-900 text-white ring-1 ring-slate-700'
          } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:opacity-45`}
          aria-label={live ? 'Stop microphone' : 'Start microphone'}
        >
          {streamingState === 'connecting' || streamingState === 'transcribing' ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : live ? (
            <Square className="h-5 w-5" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`truncate text-sm font-bold tracking-tight ${
              error ? 'text-rose-300' : 'text-white'
            }`}>
              {statusText}
            </p>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] ${
              runtimeStatus === 'loading'
                ? 'border-slate-700 bg-slate-900 text-slate-300'
                : live
                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}>
              {runtimeStatus === 'loading'
                ? 'Checking'
                : live
                ? 'Live'
                : streamingState === 'connecting'
                ? 'Linking'
                : 'Ready'}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <span>Learner voice dock</span>
            <span className="text-slate-600">•</span>
            <span>Assembly streaming</span>
            <span className="text-slate-600">•</span>
            <span>{voiceEnabled ? 'teacher voice on' : 'teacher text only'}</span>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex flex-1 items-end gap-1">
              {bars.map((bar, index) => (
                <div
                  key={index}
                  className={`block w-1 rounded-full transition-all duration-150 ${
                    live || userSpeaking || teacherSpeaking
                      ? 'bg-cyan-400'
                      : 'bg-slate-700'
                  }`}
                  style={{
                    height:
                      live || userSpeaking || teacherSpeaking
                        ? `${Math.max(8, bar * Math.max(0.3, Math.min(1, voiceLevel * 18)))}px`
                        : `${Math.max(6, bar * 0.2)}px`,
                  }}
                />
              ))}
            </div>
            <AudioWaveform className={`h-4 w-4 transition-colors ${
              live || userSpeaking || teacherSpeaking ? 'text-cyan-400' : 'text-slate-600'
            }`} />
          </div>
        </div>
      </div>
    </div>
  );
}
