'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LessonStart, LessonSummary, MilestoneProgress } from './index';
import { TextInput } from './text-input';
import { TutorStage } from './tutor-stage';
import { VoiceDock } from './voice-dock';
import { VoiceOutput } from './voice-output';
import { SpeechDisplay } from './speech-display';
import { TutorHeader } from './tutor-header';
import { useLessonSession } from '../../lib/hooks/use-lesson-session';
import { useLessonState } from '../../lib/hooks/use-lesson-state';
import type { InterpretedMarking, LearnerInput, TeachingAction } from '../../lib/types/lesson';

type RuntimeConfig = {
  voiceEnabled: boolean;
  teacherVoiceId: string;
  speechToTextEnabled: boolean;
  imageSearchEnabled: boolean;
};

const defaultRuntimeConfig: RuntimeConfig = {
  voiceEnabled: false,
  teacherVoiceId: 'hpp4J3VqNfWAUOO0d1Us',
  speechToTextEnabled: false,
  imageSearchEnabled: false,
};

export const LessonContainer: React.FC = () => {
  const {
    sessionId,
    lastResponse,
    summary,
    isComplete,
    lessonPlan,
    mediaAssets,
    activeImageId,
    preparationStages,
    loading: sessionLoading,
    error: sessionError,
    startLesson,
    submitResponse,
    endLesson,
  } = useLessonSession();

  const { currentView, isProcessing, setView, setProcessing } = useLessonState();
  const [runtimeStatus, setRuntimeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [teacherStopSignal, setTeacherStopSignal] = useState(0);
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);
  const [hasCanvasContext, setHasCanvasContext] = useState(false);
  const latestCanvasContextRef = useRef<{
    url: string;
    interpreted?: { markings?: InterpretedMarking[] };
  } | null>(null);

  useEffect(() => {
    if (isComplete && summary) {
      setView('summary');
    }
  }, [isComplete, summary, setView]);

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
          teacherVoiceId: config.teacherVoiceId || defaultRuntimeConfig.teacherVoiceId,
          speechToTextEnabled: Boolean(config.speechToTextEnabled),
          imageSearchEnabled: Boolean(config.imageSearchEnabled),
        });
        setRuntimeStatus('ready');
      })
      .catch((error) => {
        if (active) {
          console.error('Failed to load runtime config:', error);
          setRuntimeConfig(defaultRuntimeConfig);
          setRuntimeStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleStart = async (topic: string) => {
    try {
      setProcessing(true);
      await startLesson(topic);
      setView('board');
    } catch (error) {
      console.error('Failed to start lesson:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitInput = async (input: LearnerInput) => {
    try {
      setProcessing(true);
      const result = await submitResponse(input);
      if (result?.isSessionComplete && result.summary) {
        setView('summary');
      }
    } catch (error) {
      console.error('Failed to submit input:', error);
    } finally {
      setProcessing(false);
    }
  };

  const submitSpeechTurn = (text: string, mode: LearnerInput['mode']) => {
    const canvasContext = latestCanvasContextRef.current;
    latestCanvasContextRef.current = null;
    setHasCanvasContext(false);

    return handleSubmitInput({
      mode,
      timestamp: new Date(),
      raw: {
        text,
        ...(canvasContext ? { canvasSnapshotUrl: canvasContext.url } : {}),
      },
      interpreted: canvasContext?.interpreted
        ? {
            text,
            markings: canvasContext.interpreted.markings,
          }
        : undefined,
    });
  };

  const handleEndLesson = async () => {
    try {
      setProcessing(true);
      const result = await endLesson();
      if (result?.summary) {
        setView('summary');
      }
    } catch (error) {
      console.error('Failed to end lesson:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCanvasSnapshot = (url: string, interpretation: unknown) => {
    const interpreted =
      typeof interpretation === 'object' &&
      interpretation !== null &&
      Array.isArray((interpretation as { markings?: unknown }).markings)
        ? {
            markings: (interpretation as { markings: InterpretedMarking[] }).markings,
          }
        : undefined;

    latestCanvasContextRef.current = {
      url,
      interpreted,
    };
    setHasCanvasContext(true);

    return handleSubmitInput({
      mode: 'canvas_draw',
      timestamp: new Date(),
      raw: { canvasSnapshotUrl: url },
      interpreted,
    });
  };

  const activeImage =
    mediaAssets.find((asset) => asset.id === activeImageId) || mediaAssets[0] || null;

  const isLoading = sessionLoading || isProcessing;

  if (currentView === 'start') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {sessionError && (
          <div className="mb-6 max-w-2xl w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {sessionError}
          </div>
        )}
        <LessonStart
          onStartLesson={handleStart}
          preparationStages={preparationStages}
        />
      </div>
    );
  }

  if (currentView === 'summary' && summary) {
    return (
      <LessonSummary
        summary={{
          topic: summary.topic,
          milestonesCompleted: summary.milestonesCompleted,
          totalMilestones: summary.milestonesTotal,
          insights: summary.keyTakeaways,
          duration: summary.duration,
        }}
        onStartNew={() => setView('start')}
      />
    );
  }

  const learnerVoiceStatus =
    runtimeStatus === 'loading'
      ? 'Checking'
      : runtimeStatus === 'error'
      ? 'Config error'
      : runtimeConfig.speechToTextEnabled
      ? 'Ready'
      : 'Unavailable';
  const teacherVoiceStatus =
    runtimeStatus === 'loading'
      ? 'Checking'
      : runtimeStatus === 'error'
      ? 'Config error'
      : runtimeConfig.voiceEnabled
      ? 'Ready'
      : 'Unavailable';
  const currentMilestoneIndex = lessonPlan
    ? Math.max(
        0,
        lessonPlan.milestones.findIndex(
          (milestone) => milestone.id === lastResponse?.currentMilestoneId
        )
      )
    : 0;
  const progressPercent = lessonPlan
    ? ((isComplete ? lessonPlan.milestones.length : currentMilestoneIndex) /
        Math.max(lessonPlan.milestones.length, 1)) *
      100
    : 0;
  const milestoneItems = lessonPlan
    ? lessonPlan.milestones.map((milestone, index) => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        status: isComplete
          ? ('completed' as const)
          : index < currentMilestoneIndex
          ? ('completed' as const)
          : milestone.id === lastResponse?.currentMilestoneId
          ? ('in_progress' as const)
          : ('not_started' as const),
      }))
    : [];
  const primaryAction = [...(lastResponse?.actions || [])]
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
    .find((action) => action.type !== 'speak');
  const helperText = deriveHelperText({
    action: primaryAction || null,
    awaitedInputMode: lastResponse?.awaitedInputMode || null,
    learnerVoiceStatus,
    teacherVoiceStatus,
    hasCanvasContext,
  });

  return (
    <div className="flex-1 bg-slate-50">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[980px] flex-col px-4 pb-28 pt-4 sm:px-6">
        <TutorHeader
          title={lessonPlan?.topic || 'Current Lesson'}
          progressPercent={progressPercent}
          sessionComplete={isComplete}
          onEndLesson={handleEndLesson}
          ending={isLoading || !sessionId}
        />
        <div className="sr-only">Interactive Tutor Runtime</div>

        {sessionError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {sessionError}
          </div>
        )}

        <SpeechDisplay
          text={lastResponse?.speech || ''}
          helperText={helperText}
          isLoading={isProcessing}
        />

        <div className="mb-4">
          <VoiceOutput
            text={lastResponse?.speech || ''}
            autoPlay={Boolean(lastResponse?.speech)}
            voiceId={runtimeConfig.teacherVoiceId}
            stopSignal={teacherStopSignal}
            onStart={() => setTeacherSpeaking(true)}
            onComplete={() => setTeacherSpeaking(false)}
            onError={() => setTeacherSpeaking(false)}
          />
        </div>

        <div className="flex-1">
          <TutorStage
            sessionId={sessionId || 'guest-session'}
            activeImage={activeImage}
            mediaAssets={mediaAssets}
            disabled={isLoading}
            onCanvasSnapshot={handleCanvasSnapshot}
          />
        </div>

        <div className="sr-only">
          <TextInput
            onSubmit={(text) => submitSpeechTurn(text, 'text')}
            disabled={isLoading}
            placeholder="Type your explanation, question, or correction..."
          />
          <MilestoneProgress
            milestones={milestoneItems}
            currentMilestoneId={lastResponse?.currentMilestoneId || null}
          />
        </div>

        {/* Voice Dock Overlay */}
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <div className="w-full max-w-3xl">
            <VoiceDock
              disabled={isLoading || !sessionId}
              speechToTextEnabled={runtimeConfig.speechToTextEnabled}
              voiceEnabled={runtimeConfig.voiceEnabled}
              runtimeStatus={runtimeStatus}
              teacherSpeaking={teacherSpeaking}
              idleHint="Speak naturally. Your latest canvas work stays in context."
              onSpeechStart={() => {
                setTeacherStopSignal((value) => value + 1);
                setTeacherSpeaking(false);
              }}
              onTranscript={(text) => submitSpeechTurn(text, 'voice')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function deriveHelperText({
  action,
  awaitedInputMode,
  learnerVoiceStatus,
  teacherVoiceStatus,
  hasCanvasContext,
}: {
  action: TeachingAction | null;
  awaitedInputMode: string | null;
  learnerVoiceStatus: string;
  teacherVoiceStatus: string;
  hasCanvasContext: boolean;
}) {
  if (typeof action?.params?.text === 'string') {
    return action.params.text;
  }

  if (typeof action?.params?.message === 'string') {
    return action.params.message;
  }

  if (typeof action?.params?.concept === 'string') {
    return action.params.concept;
  }

  if (awaitedInputMode === 'canvas_draw' || awaitedInputMode === 'canvas_mark') {
    return hasCanvasContext
      ? 'Canvas context captured. Speak when you are ready.'
      : 'Use the canvas, then speak. The tutor will keep both in context.';
  }

  if (awaitedInputMode === 'voice') {
    return `Learner voice ${learnerVoiceStatus.toLowerCase()}. Teacher voice ${teacherVoiceStatus.toLowerCase()}.`;
  }

  return null;
}

export default LessonContainer;
