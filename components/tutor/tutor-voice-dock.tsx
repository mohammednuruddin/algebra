'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Square, Keyboard } from 'lucide-react';
import {
  ASSEMBLY_STREAM_SAMPLE_RATE,
  buildAssemblyAiStreamingQuery,
  resolveAssemblyAiCompletedTranscript,
  type AssemblyAiTurnMessage,
} from '@/lib/stt/assemblyai-streaming';
import { appendPcmChunks } from '@/lib/stt/pcm-chunker';
import { shouldAcceptBargeInTranscript, transcribeVadAudio } from '@/lib/vad/barge-in-transcription';
import { SileroMicVadController } from '@/lib/vad/silero-mic-vad';

interface TutorVoiceDockProps {
  disabled?: boolean;
  maintainConnection?: boolean;
  speechToTextEnabled?: boolean;
  runtimeStatus?: 'loading' | 'ready' | 'error';
  teacherSpeaking?: boolean;
  teacherAudioPending?: boolean;
  teacherSpeechText?: string;
  onTranscript: (text: string) => Promise<void> | void;
  onBargeInStart?: () => void;
  onBargeInCancel?: () => void;
  onBargeInCommit?: () => void;
  onTextSubmit?: (text: string) => Promise<void> | void;
}

const STREAM_QUERY = buildAssemblyAiStreamingQuery();

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
  if (inputSampleRate === ASSEMBLY_STREAM_SAMPLE_RATE) {
    const pcm = new Int16Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }

  const ratio = inputSampleRate / ASSEMBLY_STREAM_SAMPLE_RATE;
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
  maintainConnection = true,
  speechToTextEnabled = false,
  runtimeStatus = 'loading',
  teacherSpeaking = false,
  teacherAudioPending = false,
  teacherSpeechText = '',
  onTranscript,
  onBargeInStart,
  onBargeInCancel,
  onBargeInCommit,
  onTextSubmit,
}: TutorVoiceDockProps) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [streamingState, setStreamingState] = useState<'idle' | 'connecting' | 'listening' | 'processing'>('idle');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');

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
  const onBargeInStartRef = useRef(onBargeInStart);
  const onBargeInCancelRef = useRef(onBargeInCancel);
  const onBargeInCommitRef = useRef(onBargeInCommit);
  const teacherSpeakingRef = useRef(teacherSpeaking);
  const teacherSpeechTextRef = useRef(teacherSpeechText);
  const teacherAudioPendingRef = useRef(teacherAudioPending);
  const streamStartIdRef = useRef(0);
  const pendingPcmSamplesRef = useRef<number[]>([]);
  const sttSuppressedRef = useRef(false);
  const activeBargeInIdRef = useRef<number | null>(null);
  const nextBargeInIdRef = useRef(0);
  const ignoreNextCompletedTranscriptRef = useRef(false);
  const sileroVadRef = useRef<SileroMicVadController>(new SileroMicVadController());

  const canMaintainConnection =
    maintainConnection &&
    micEnabled &&
    runtimeStatus === 'ready' &&
    speechToTextEnabled &&
    inputMode === 'voice';

  useEffect(() => {
    canAutoListenRef.current = canMaintainConnection;
  }, [canMaintainConnection]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onBargeInStartRef.current = onBargeInStart;
  }, [onBargeInStart]);

  useEffect(() => {
    onBargeInCancelRef.current = onBargeInCancel;
  }, [onBargeInCancel]);

  useEffect(() => {
    onBargeInCommitRef.current = onBargeInCommit;
  }, [onBargeInCommit]);

  useEffect(() => {
    teacherSpeakingRef.current = teacherSpeaking;
  }, [teacherSpeaking]);

  useEffect(() => {
    teacherSpeechTextRef.current = teacherSpeechText;
  }, [teacherSpeechText]);

  useEffect(() => {
    teacherAudioPendingRef.current = teacherAudioPending;
  }, [teacherAudioPending]);

  useEffect(() => {
    sileroVadRef.current.setTeacherSpeaking(teacherSpeaking);
    if (teacherSpeaking) {
      sttSuppressedRef.current = true;
    } else {
      // Small delay before unsuppressing STT to avoid echo tail
      const timer = setTimeout(() => {
        sttSuppressedRef.current = false;
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [teacherSpeaking]);

  const clearConnectionTimeout = useCallback(() => {
    const timeoutId = connectionTimeoutRef.current;
    if (timeoutId) {
      clearTimeout(timeoutId);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const stopStreaming = useCallback(async (nextState: 'idle' | 'processing' = 'idle') => {
    stoppingRef.current = true;
    streamStartIdRef.current += 1;
    clearConnectionTimeout();
    activeBargeInIdRef.current = null;
    ignoreNextCompletedTranscriptRef.current = false;

    await sileroVadRef.current.pause();

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
    pendingPcmSamplesRef.current = [];

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
      setTranscript('');
    }
  }, [clearConnectionTimeout]);

  const startStreaming = useCallback(async () => {
    if (!canMaintainConnection || restartingRef.current || streamingState === 'connecting' || streamingState === 'listening') {
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

      const audioContext = new AudioContextCtor({ sampleRate: ASSEMBLY_STREAM_SAMPLE_RATE });

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

      await sileroVadRef.current.start(
        mediaStream,
        () => {
          if (!teacherSpeakingRef.current || activeBargeInIdRef.current !== null) {
            return;
          }

          const teacherSpeech = teacherSpeechTextRef.current.trim();
          if (!teacherSpeech) {
            return;
          }

          activeBargeInIdRef.current = nextBargeInIdRef.current + 1;
          nextBargeInIdRef.current = activeBargeInIdRef.current;
          sttSuppressedRef.current = false;
          if (mountedRef.current) {
            setTranscript('');
          }
          onBargeInStartRef.current?.();
        },
        async (audio) => {
          const candidateId = activeBargeInIdRef.current;
          if (candidateId === null) {
            return;
          }

          const teacherSpeech = teacherSpeechTextRef.current.trim();

          try {
            if (activeBargeInIdRef.current !== candidateId) {
              return;
            }

            if (!teacherSpeech) {
              if (activeBargeInIdRef.current === candidateId) {
                activeBargeInIdRef.current = null;
                if (teacherSpeakingRef.current) {
                  sttSuppressedRef.current = true;
                }
                onBargeInCancelRef.current?.();
              }
              return;
            }

            const transcriptText = await transcribeVadAudio(audio);
            if (activeBargeInIdRef.current !== candidateId) {
              return;
            }

            if (!shouldAcceptBargeInTranscript(transcriptText, teacherSpeech)) {
              if (activeBargeInIdRef.current === candidateId) {
                activeBargeInIdRef.current = null;
                if (teacherSpeakingRef.current) {
                  sttSuppressedRef.current = true;
                }
                onBargeInCancelRef.current?.();
              }
              return;
            }

            activeBargeInIdRef.current = null;
            sttSuppressedRef.current = false;
            ignoreNextCompletedTranscriptRef.current = true;
            onBargeInCommitRef.current?.();
            if (mountedRef.current) {
              setStreamingState('processing');
              setTranscript('');
            }
            await onTranscriptRef.current(transcriptText);
            if (mountedRef.current && canAutoListenRef.current && !stoppingRef.current) {
              setStreamingState('listening');
            }
          } catch {
            if (activeBargeInIdRef.current === candidateId) {
              activeBargeInIdRef.current = null;
              if (teacherSpeakingRef.current) {
                sttSuppressedRef.current = true;
              }
              onBargeInCancelRef.current?.();
            }
          }
        },
        () => {
          const candidateId = activeBargeInIdRef.current;
          if (candidateId === null) {
            return;
          }

          activeBargeInIdRef.current = null;
          if (teacherSpeakingRef.current) {
            sttSuppressedRef.current = true;
          }
          onBargeInCancelRef.current?.();
        }
      );
      sileroVadRef.current.setTeacherSpeaking(teacherSpeaking);

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
        const outgoingPcm =
          sttSuppressedRef.current || teacherAudioPendingRef.current
            ? new Int16Array(pcm.length)
            : pcm;
        const chunks = appendPcmChunks(pendingPcmSamplesRef.current, outgoingPcm);
        for (const chunk of chunks) {
          websocket.send(chunk.buffer);
        }
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

        // Drop transcripts while live STT is intentionally suppressed.
        if (sttSuppressedRef.current || teacherAudioPendingRef.current) {
          return;
        }

        const payload = JSON.parse(String(event.data)) as AssemblyAiTurnMessage;
        if (payload.type !== 'Turn') {
          return;
        }

        const nextTranscript = payload.transcript?.trim() || '';
        if (nextTranscript) {
          setTranscript(nextTranscript);
        }

        const completedTranscript = resolveAssemblyAiCompletedTranscript(payload);
        const activeBargeInId = activeBargeInIdRef.current;
        if (completedTranscript && activeBargeInId !== null) {
          const teacherSpeech = teacherSpeechTextRef.current.trim();

          if (!shouldAcceptBargeInTranscript(completedTranscript, teacherSpeech)) {
            if (activeBargeInIdRef.current === activeBargeInId) {
              activeBargeInIdRef.current = null;
              if (teacherSpeakingRef.current) {
                sttSuppressedRef.current = true;
              }
              setTranscript('');
              onBargeInCancelRef.current?.();
            }
            return;
          }

          if (activeBargeInIdRef.current === activeBargeInId) {
            activeBargeInIdRef.current = null;
            sttSuppressedRef.current = false;
            onBargeInCommitRef.current?.();
            setStreamingState('processing');
            setTranscript('');
            await onTranscriptRef.current(completedTranscript);
            if (mountedRef.current && canAutoListenRef.current && !stoppingRef.current) {
              setStreamingState('listening');
            }
          }
          return;
        }

        if (completedTranscript) {
          if (ignoreNextCompletedTranscriptRef.current) {
            ignoreNextCompletedTranscriptRef.current = false;
            return;
          }

          setStreamingState('processing');
          setTranscript('');
          await onTranscriptRef.current(completedTranscript);
          if (mountedRef.current && canAutoListenRef.current && !stoppingRef.current) {
            setStreamingState('listening');
          }
        }
      };

      websocket.onerror = (event) => {
        clearConnectionTimeout();
        if (!mountedRef.current) {
          return;
        }
        console.error('WebSocket error:', event);
        setError('Listening connection failed. Tap the mic to retry.');
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
  }, [canMaintainConnection, clearConnectionTimeout, stopStreaming, streamingState, teacherSpeaking]);

  useEffect(() => {
    mountedRef.current = true;
    const sileroVad = sileroVadRef.current;
    return () => {
      mountedRef.current = false;
      clearConnectionTimeout();
      void stopStreaming('idle');
      void sileroVad.destroy();
    };
  }, [clearConnectionTimeout, stopStreaming]);

  useEffect(() => {
    if (!canMaintainConnection) {
      if (streamingState !== 'idle') {
        void stopStreaming('idle');
      }
      return;
    }

    if (streamingState === 'idle') {
      void startStreaming();
    }
  }, [canMaintainConnection, startStreaming, stopStreaming, streamingState]);

  const statusText = useMemo(() => {
    if (inputMode === 'text') {
      return 'Type your response below';
    }
    if (error) {
      return error;
    }
    if (!speechToTextEnabled) {
      return 'Voice unavailable — use text input';
    }
    if (runtimeStatus === 'loading') {
      return 'Checking voice services...';
    }
    if (teacherAudioPending) {
      return 'Tutor voice starting...';
    }
    if (teacherSpeaking) {
      return 'Tutor speaking — say something to interrupt';
    }
    if (!micEnabled) {
      return 'Mic paused';
    }
    if (streamingState === 'connecting') {
      return 'Connecting...';
    }
    if (streamingState === 'processing') {
      return transcript || 'Sending...';
    }
    if (transcript.trim()) {
      return transcript;
    }
    return 'Listening...';
  }, [error, inputMode, micEnabled, runtimeStatus, speechToTextEnabled, streamingState, teacherAudioPending, teacherSpeaking, transcript]);

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

  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    if (onTextSubmit) {
      await onTextSubmit(text);
    } else {
      await onTranscriptRef.current(text);
    }
  }, [textInput, onTextSubmit]);

  if (inputMode === 'text') {
    return (
      <div className="pointer-events-auto w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInputMode('voice')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
            aria-label="Switch to voice"
          >
            <Mic className="h-4 w-4" />
          </button>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleTextSubmit();
                }
              }}
              placeholder="Type your answer..."
              disabled={disabled}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleTextSubmit()}
              disabled={disabled || !textInput.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {streamingState === 'connecting' || streamingState === 'processing' ? (
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                aria-label="Switch to text input"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
                {listening ? 'Live' : teacherSpeaking ? 'Tutor' : streamingState === 'processing' ? 'Send' : 'Ready'}
              </span>
            </div>
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
