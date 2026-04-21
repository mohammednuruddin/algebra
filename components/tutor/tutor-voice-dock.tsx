'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Square } from 'lucide-react';

interface TutorVoiceDockProps {
  disabled?: boolean;
  speechToTextEnabled?: boolean;
  runtimeStatus?: 'loading' | 'ready' | 'error';
  teacherSpeaking?: boolean;
  onTranscript: (text: string) => Promise<void> | void;
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
  min_end_of_turn_silence_when_confident: '120',
  max_turn_silence: '1000',
  vad_threshold: '0.4',
  speaker_labels: 'false',
  language_detection: 'false',
});

const AUDIO_WORKLET_NAME = 'pcm-capture-processor';
const AUDIO_WORKLET_SOURCE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor('${AUDIO_WORKLET_NAME}', PCMProcessor);
`;

let audioWorkletModuleUrl: string | null = null;

function getAudioWorkletModuleUrl() {
  if (!audioWorkletModuleUrl) {
    const blob = new Blob([AUDIO_WORKLET_SOURCE], { type: 'application/javascript' });
    audioWorkletModuleUrl = URL.createObjectURL(blob);
  }

  return audioWorkletModuleUrl;
}

function downsampleToInt16(samples: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === STREAM_SAMPLE_RATE) {
    const pcm = new Int16Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }

  const ratio = inputSampleRate / STREAM_SAMPLE_RATE;
  const outputLength = Math.round(samples.length / ratio);
  const pcm = new Int16Array(outputLength);
  let sourceIndex = 0;

  for (let index = 0; index < outputLength; index += 1) {
    const nextSourceIndex = Math.round((index + 1) * ratio);
    let total = 0;
    let count = 0;

    for (; sourceIndex < nextSourceIndex && sourceIndex < samples.length; sourceIndex += 1) {
      total += samples[sourceIndex] ?? 0;
      count += 1;
    }

    const averaged = count > 0 ? total / count : 0;
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

export function TutorVoiceDock({
  disabled = false,
  speechToTextEnabled = false,
  runtimeStatus = 'loading',
  teacherSpeaking = false,
  onTranscript,
}: TutorVoiceDockProps) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [streamingState, setStreamingState] = useState<'idle' | 'connecting' | 'listening' | 'thinking'>('idle');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workletGainRef = useRef<GainNode | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const stoppingRef = useRef(false);
  const restartingRef = useRef(false);
  const canAutoListenRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const streamStartIdRef = useRef(0);

  const canAutoListen = micEnabled && !disabled && runtimeStatus === 'ready' && speechToTextEnabled && !teacherSpeaking;

  useEffect(() => {
    canAutoListenRef.current = canAutoListen;
  }, [canAutoListen]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const clearConnectionTimeout = useCallback(() => {
    const timeoutId = connectionTimeoutRef.current;
    if (timeoutId) {
      clearTimeout(timeoutId);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const stopStreaming = useCallback(async (nextState: 'idle' | 'thinking' = 'idle') => {
    stoppingRef.current = true;
    streamStartIdRef.current += 1;
    clearConnectionTimeout();

    const workletNode = workletNodeRef.current;
    if (workletNode) {
      workletNode.port.onmessage = null;
      try {
        workletNode.disconnect();
      } catch {
        // noop
      }
    }
    workletNodeRef.current = null;

    const workletGain = workletGainRef.current;
    if (workletGain) {
      try {
        workletGain.disconnect();
      } catch {
        // noop
      }
    }
    workletGainRef.current = null;

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
          websocket.close();
        } else if (websocket.readyState === WebSocket.CONNECTING) {
          websocket.onopen = () => {
            try {
              websocket.close();
            } catch {
              // noop
            }
          };
          websocket.onerror = null;
          websocket.onmessage = null;
          websocket.onclose = null;
        } else if (websocket.readyState !== WebSocket.CLOSED) {
          websocket.close();
        }
      } catch {
        // noop
      }
    }

    if (mountedRef.current) {
      setStreamingState(nextState);
      setVoiceLevel(0);
    }
  }, [clearConnectionTimeout]);

  const startStreaming = useCallback(async () => {
    if (!canAutoListen || restartingRef.current || streamingState === 'connecting' || streamingState === 'listening') {
      return;
    }

    restartingRef.current = true;
    const startId = streamStartIdRef.current + 1;
    streamStartIdRef.current = startId;
    setError(null);
    setTranscript('');
    setStreamingState('connecting');
    stoppingRef.current = false;

    try {
      const tokenResponse = await fetch('/api/assemblyai/token', { cache: 'no-store' });
      const tokenPayload = (await tokenResponse.json()) as { token?: string; error?: string };

      if (!tokenResponse.ok || !tokenPayload.token) {
        throw new Error(tokenPayload.error || 'Failed to create streaming token');
      }

      if (!mountedRef.current || !canAutoListenRef.current || startId !== streamStartIdRef.current) {
        return;
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

      const audioContext = new AudioContextCtor({ sampleRate: STREAM_SAMPLE_RATE });

      if (!mountedRef.current || !canAutoListenRef.current || startId !== streamStartIdRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        await audioContext.close();
        return;
      }

      await audioContext.audioWorklet.addModule(getAudioWorkletModuleUrl());

      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(audioContext, AUDIO_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      sourceNode.connect(workletNode);
      workletNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const websocket = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${STREAM_QUERY.toString()}&token=${encodeURIComponent(tokenPayload.token)}`
      );
      websocket.binaryType = 'arraybuffer';

      clearConnectionTimeout();
      connectionTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current || streamStartIdRef.current !== startId) {
          return;
        }

        setError('Microphone connection timed out. Tap the mic to retry.');
        setMicEnabled(false);
        void stopStreaming('idle');
      }, 8000);

      mediaStreamRef.current = mediaStream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      workletNodeRef.current = workletNode;
      workletGainRef.current = gainNode;
      websocketRef.current = websocket;

      workletNode.port.onmessage = (event) => {
        const floatSamples = event.data instanceof Float32Array
          ? event.data
          : new Float32Array(event.data as ArrayLike<number>);
        const level = computeLevel(floatSamples);
        if (mountedRef.current) {
          setVoiceLevel(level);
        }

        if (websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        const pcm = downsampleToInt16(floatSamples, audioContext.sampleRate);
        websocket.send(pcm.buffer);
      };

      websocket.onopen = () => {
        clearConnectionTimeout();
        if (!mountedRef.current || stoppingRef.current) {
          try {
            websocket.close();
          } catch {
            // noop
          }
          return;
        }
        setStreamingState('listening');
      };

      websocket.onmessage = async (event) => {
        if (!mountedRef.current) {
          return;
        }

        const payload = JSON.parse(String(event.data)) as TurnMessage;
        if (payload.type !== 'Turn') {
          return;
        }

        const nextTranscript = payload.transcript?.trim() || '';
        if (nextTranscript) {
          setTranscript(nextTranscript);
        }

        if (payload.turn_is_formatted && nextTranscript) {
          setStreamingState('thinking');
          await stopStreaming('thinking');
          await onTranscriptRef.current(nextTranscript);
        }
      };

      websocket.onerror = (event) => {
        clearConnectionTimeout();
        if (!mountedRef.current) {
          return;
        }
        console.error('WebSocket error:', event);
        setError('Listening connection failed');
        setMicEnabled(false);
        void stopStreaming('idle');
      };

      websocket.onclose = (event) => {
        clearConnectionTimeout();
        if (!mountedRef.current || stoppingRef.current) {
          return;
        }
        console.error('WebSocket closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setError((current) => current || `Microphone connection closed (${event.code}). Tap the mic to retry.`);
        setMicEnabled(false);
        void stopStreaming('idle');
      };
    } catch (streamError) {
      clearConnectionTimeout();
      if (mountedRef.current) {
        setError(streamError instanceof Error ? streamError.message : 'Listening failed');
        setMicEnabled(false);
      }
      await stopStreaming('idle');
    } finally {
      restartingRef.current = false;
    }
  }, [canAutoListen, clearConnectionTimeout, stopStreaming, streamingState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearConnectionTimeout();
      void stopStreaming('idle');
    };
  }, [clearConnectionTimeout, stopStreaming]);

  useEffect(() => {
    if (!canAutoListen) {
      void stopStreaming('idle');
      return;
    }

    if (streamingState === 'idle') {
      void startStreaming();
    }
  }, [canAutoListen, startStreaming, stopStreaming, streamingState]);

  const statusText = useMemo(() => {
    if (error) {
      return error;
    }
    if (!speechToTextEnabled) {
      return 'Learner voice is unavailable';
    }
    if (runtimeStatus === 'loading') {
      return 'Checking voice services...';
    }
    if (teacherSpeaking) {
      return 'Tutor speaking...';
    }
    if (!micEnabled) {
      return 'Mic paused';
    }
    if (streamingState === 'connecting') {
      return 'Connecting live transcript...';
    }
    if (streamingState === 'thinking') {
      return transcript || 'Sending your turn...';
    }
    if (transcript.trim()) {
      return transcript;
    }
    return 'Listening live...';
  }, [error, micEnabled, runtimeStatus, speechToTextEnabled, streamingState, teacherSpeaking, transcript]);

  const bars = [12, 22, 30, 22, 12];
  const listening = streamingState === 'listening';

  const handleMicToggle = useCallback(() => {
    setError(null);
    setTranscript('');
    setMicEnabled((current) => {
      const next = !current;
      if (!next) {
        void stopStreaming('idle');
      }
      return next;
    });
  }, [stopStreaming]);

  return (
    <div className="pointer-events-auto w-full">
      <div className="flex items-center gap-4">
        <button
            type="button"
            onClick={handleMicToggle}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
              micEnabled 
                ? 'bg-zinc-900 text-white hover:bg-zinc-800' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
            aria-label={micEnabled ? 'Pause microphone' : 'Resume microphone'}
          >
            {streamingState === 'connecting' || streamingState === 'thinking' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : !micEnabled ? (
              <MicOff className="h-5 w-5" />
            ) : listening ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-4">
            <p className={`truncate text-sm font-medium ${error ? 'text-rose-600' : 'text-zinc-900'}`}>
              {statusText}
            </p>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
              {listening ? 'Live' : teacherSpeaking ? 'Tutor' : streamingState === 'thinking' ? 'Send' : 'Ready'}
            </span>
          </div>
          <div className="mt-2 flex items-end gap-[3px] h-[30px]">
            {bars.map((bar, index) => (
              <span
                key={index}
                className={`block w-[3px] rounded-full transition-all duration-150 ${
                  listening || teacherSpeaking ? 'bg-zinc-900' : 'bg-zinc-200'
                }`}
                style={{
                  height: `${Math.max(4, bar * Math.max(0.25, Math.min(1, voiceLevel * 18)))}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
