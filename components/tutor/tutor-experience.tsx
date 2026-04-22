'use client';

import { useCallback, useEffect, useState } from 'react';

import { TutorShell } from '@/components/tutor/tutor-shell';
import { useTutorSession } from '@/lib/hooks/use-tutor-session';
import type {
  TutorCanvasEvidence,
  TutorCanvasInteraction,
  TutorCodeExecutionResult,
} from '@/lib/types/tutor';


type RuntimeConfig = {
  voiceEnabled: boolean;
  teacherVoiceId: string;
  ttsProvider: 'inworld' | 'elevenlabs';
  ttsModelId: string;
  speechToTextEnabled: boolean;
};

const defaultRuntimeConfig: RuntimeConfig = {
  voiceEnabled: false,
  teacherVoiceId: 'Ashley',
  ttsProvider: 'inworld',
  ttsModelId: 'inworld-tts-1.5-mini',
  speechToTextEnabled: false,
};

export function TutorExperience() {
  const {
    snapshot,
    phase,
    error,
    isSubmittingTurn,
    isGeneratingArticle,
    article,
    startSession: startTutorSession,
    submitTranscript: submitTutorTranscript,
    moveToken,
    chooseEquationAnswer,
  } = useTutorSession();
  const [runtimeStatus, setRuntimeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);
  const [teacherAudioPending, setTeacherAudioPending] = useState(false);
  const [teacherStopSignal, setTeacherStopSignal] = useState(0);

  const submitTranscript = useCallback(
    async (
      transcript: string,
      options?: {
        canvasEvidence?: TutorCanvasEvidence | null;
        canvasInteraction?: TutorCanvasInteraction | null;
      }
    ) => {
      if (!transcript.trim()) {
        return;
      }

      setTeacherSpeaking(false);
      setTeacherAudioPending(true);

      try {
        const submitted = await submitTutorTranscript(transcript, options);
        if (!submitted) {
          setTeacherAudioPending(false);
        }
      } catch (nextError) {
        setTeacherAudioPending(false);
        throw nextError;
      }
    },
    [submitTutorTranscript]
  );

  const startSession = useCallback(
    async (
      input: {
        topic?: string;
        learnerLevel?: string;
        prompt?: string;
      } = {}
    ) => {
      setTeacherSpeaking(false);
      setTeacherAudioPending(true);

      try {
        return await startTutorSession(input);
      } catch (nextError) {
        setTeacherAudioPending(false);
        throw nextError;
      }
    },
    [startTutorSession]
  );

  const handleFillBlankSubmit = useCallback(
    (answers: Record<string, string>) => {
      const canvasInteraction: TutorCanvasInteraction = {
        mode: 'fill_blank',
        answers,
      };
      void submitTranscript(
        `[Canvas interaction: fill_blank] ${JSON.stringify({ answers })}`,
        { canvasInteraction }
      );
    },
    [submitTranscript]
  );

  const handleCodeSubmit = useCallback(
    (code: string, result: TutorCodeExecutionResult) => {
      const canvasInteraction: TutorCanvasInteraction = {
        mode: 'code_block',
        code,
        execution: result,
      };
      void submitTranscript(
        `[Canvas interaction: code_block] ${JSON.stringify({
          code,
          execution: result,
        })}`,
        { canvasInteraction }
      );
    },
    [submitTranscript]
  );

  const handleCanvasSubmit = useCallback(
    (mode: string, data: unknown) => {
      if (
        mode === 'drawing' &&
        data &&
        typeof data === 'object' &&
        typeof (data as { dataUrl?: unknown }).dataUrl === 'string'
      ) {
        const canvasInteraction: TutorCanvasInteraction = {
          mode: 'drawing',
          summary: 'Learner submitted a marked image for review.',
          strokeColors: Array.isArray((data as { strokeColors?: unknown }).strokeColors)
            ? ((data as { strokeColors: string[] }).strokeColors)
            : undefined,
          strokeCount:
            typeof (data as { strokeCount?: unknown }).strokeCount === 'number'
              ? (data as { strokeCount: number }).strokeCount
              : undefined,
        };
        void submitTranscript(
          `[Canvas interaction: drawing] ${JSON.stringify({
            summary: canvasInteraction.summary,
            strokeColors: canvasInteraction.strokeColors,
            strokeCount: canvasInteraction.strokeCount,
          })}`,
          {
            canvasInteraction,
            canvasEvidence: {
              mode: 'drawing',
              summary: 'Learner submitted a marked image for review.',
              dataUrl: (data as { dataUrl: string }).dataUrl,
              overlayDataUrl:
                typeof (data as { overlayDataUrl?: unknown }).overlayDataUrl === 'string'
                  ? (data as { overlayDataUrl: string }).overlayDataUrl
                  : undefined,
              strokeColors: Array.isArray((data as { strokeColors?: unknown }).strokeColors)
                ? ((data as { strokeColors: string[] }).strokeColors)
                : undefined,
              strokeCount:
                typeof (data as { strokeCount?: unknown }).strokeCount === 'number'
                  ? (data as { strokeCount: number }).strokeCount
                  : undefined,
              canvasWidth:
                typeof (data as { canvasWidth?: unknown }).canvasWidth === 'number'
                  ? (data as { canvasWidth: number }).canvasWidth
                  : undefined,
              canvasHeight:
                typeof (data as { canvasHeight?: unknown }).canvasHeight === 'number'
                  ? (data as { canvasHeight: number }).canvasHeight
                  : undefined,
            },
          }
        );
        return;
      }

      let canvasInteraction: TutorCanvasInteraction | null = null;

      if (data && typeof data === 'object') {
        const payload = data as Record<string, unknown>;

        switch (mode) {
          case 'multiple_choice':
            canvasInteraction = {
              mode: 'multiple_choice',
              selectedIds: Array.isArray(payload.selectedIds)
                ? payload.selectedIds.filter(
                    (value): value is string => typeof value === 'string'
                  )
                : [],
            };
            break;
          case 'number_line':
            canvasInteraction = {
              mode: 'number_line',
              value:
                typeof payload.value === 'number' || payload.value === null
                  ? (payload.value as number | null)
                  : null,
            };
            break;
          case 'table_grid':
            canvasInteraction = {
              mode: 'table_grid',
              cells:
                payload.cells && typeof payload.cells === 'object'
                  ? (payload.cells as Record<string, string>)
                  : {},
            };
            break;
          case 'graph_plot':
            canvasInteraction = {
              mode: 'graph_plot',
              points: Array.isArray(payload.userPoints)
                ? payload.userPoints
                    .filter(
                      (point): point is { x: number; y: number } =>
                        Boolean(point) &&
                        typeof point === 'object' &&
                        typeof (point as { x?: unknown }).x === 'number' &&
                        typeof (point as { y?: unknown }).y === 'number'
                    )
                    .map((point) => ({ x: point.x, y: point.y }))
                : [],
            };
            break;
          case 'matching_pairs':
            canvasInteraction = {
              mode: 'matching_pairs',
              userPairs: Array.isArray(payload.pairs)
                ? payload.pairs
                    .filter(
                      (pair): pair is { leftId: string; rightId: string } =>
                        Boolean(pair) &&
                        typeof pair === 'object' &&
                        typeof (pair as { leftId?: unknown }).leftId === 'string' &&
                        typeof (pair as { rightId?: unknown }).rightId === 'string'
                    )
                    .map((pair) => ({ leftId: pair.leftId, rightId: pair.rightId }))
                : [],
            };
            break;
          case 'ordering':
            canvasInteraction = {
              mode: 'ordering',
              userOrder: Array.isArray(payload.order)
                ? payload.order.filter(
                    (value): value is string => typeof value === 'string'
                  )
                : [],
            };
            break;
          case 'text_response':
            canvasInteraction =
              typeof payload.text === 'string'
                ? {
                    mode: 'text_response',
                    text: payload.text,
                  }
                : null;
            break;
          default:
            break;
        }
      }

      void submitTranscript(`[Canvas interaction: ${mode}] ${JSON.stringify(data)}`, {
        canvasInteraction,
      });
    },
    [submitTranscript]
  );

  useEffect(() => {
    let active = true;

    fetch('/api/runtime/config', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Runtime config failed with status ${response.status}`);
        }
        return (await response.json()) as Partial<RuntimeConfig>;
      })
      .then((config) => {
        if (!active) {
          return;
        }
        setRuntimeConfig({
          voiceEnabled: Boolean(config.voiceEnabled),
          teacherVoiceId:
            config.teacherVoiceId || defaultRuntimeConfig.teacherVoiceId,
          ttsProvider:
            config.ttsProvider === 'elevenlabs' ? 'elevenlabs' : 'inworld',
          ttsModelId: config.ttsModelId || defaultRuntimeConfig.ttsModelId,
          speechToTextEnabled: Boolean(config.speechToTextEnabled),
        });
        setRuntimeStatus('ready');
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setRuntimeConfig(defaultRuntimeConfig);
        setRuntimeStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!snapshot && phase === 'intake') {
      queueMicrotask(() => {
        void startSession();
      });
    }
  }, [phase, snapshot, startSession]);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 text-zinc-900">
        <div className="w-full max-w-2xl border border-zinc-200 bg-white p-10 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Live tutor
          </p>
          {phase === 'error' ? (
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-light tracking-tight text-zinc-950">
                Tutor unavailable right now.
              </h1>
              <p className="text-base leading-relaxed text-zinc-600">
                {error || 'The tutor could not start. Try again.'}
              </p>
              <button
                type="button"
                onClick={() => void startSession()}
                className="inline-flex items-center justify-center bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-light tracking-tight text-zinc-950">
                Preparing the tutor conversation...
              </h1>
              <p className="text-base leading-relaxed text-zinc-600">
                Starting a live, model-owned intake so the tutor can ask the first question.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TutorShell
      snapshot={snapshot}
      isSubmittingTurn={isSubmittingTurn}
      speechToTextEnabled={runtimeConfig.speechToTextEnabled}
      voiceEnabled={runtimeConfig.voiceEnabled}
      teacherAudioPending={teacherAudioPending}
      teacherStopSignal={teacherStopSignal}
      ttsProvider={runtimeConfig.ttsProvider}
      ttsModelId={runtimeConfig.ttsModelId}
      teacherVoiceId={runtimeConfig.teacherVoiceId}
      runtimeStatus={runtimeStatus}
      onTranscript={submitTranscript}
      onMoveToken={moveToken}
      onChooseEquationAnswer={chooseEquationAnswer}
      onFillBlankSubmit={handleFillBlankSubmit}
      onCodeSubmit={handleCodeSubmit}
      onCanvasSubmit={handleCanvasSubmit}
      isGeneratingArticle={isGeneratingArticle}
      article={article}
      teacherSpeaking={teacherSpeaking}
      onTeacherSpeakingChange={setTeacherSpeaking}
      onTeacherAudioPendingChange={setTeacherAudioPending}
      onTeacherInterrupt={() => {
        setTeacherStopSignal((value) => value + 1);
      }}
    />
  );
}
