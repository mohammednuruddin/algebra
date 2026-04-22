'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { TutorSpeech } from '@/components/tutor/tutor-speech';
import { TutorVoiceDock } from '@/components/tutor/tutor-voice-dock';
import { TutorVoicePlayer } from '@/components/tutor/tutor-voice-player';

type IntakeStage = 'welcome' | 'topic' | 'level';

interface OnboardingIntakeProps {
  onStart: (input: { topic: string; learnerLevel: string }) => Promise<unknown>;
  isPreparing?: boolean;
  error?: string | null;
  speechToTextEnabled?: boolean;
  runtimeStatus: 'loading' | 'ready' | 'error';
  voiceEnabled?: boolean;
  ttsProvider: 'inworld' | 'elevenlabs';
  ttsModelId: string;
  teacherVoiceId: string;
}

const learnerLevelOptions = [
  {
    id: 'starting-from-scratch',
    label: 'Starting from scratch',
    description: 'Treat me like this is brand new.',
  },
  {
    id: 'basic-familiarity',
    label: 'A little familiar',
    description: 'I know the words, but not much more.',
  },
  {
    id: 'some-practice',
    label: 'Some practice',
    description: 'I have seen this before and want a tighter explanation.',
  },
  {
    id: 'go-deeper',
    label: 'Go deeper',
    description: 'Move fast and challenge me.',
  },
];

function stageSpeech(stage: IntakeStage, topic: string) {
  switch (stage) {
    case 'welcome':
      return 'Press start and I will ask what you want to learn.';
    case 'topic':
      return 'What do you want to learn? You can say it or type it.';
    case 'level':
      return topic.trim()
        ? `Before I prepare ${topic.trim()}, tell me your current level with it.`
        : 'Tell me how comfortable you are with this topic.';
    default:
      return '';
  }
}

export function OnboardingIntake({
  onStart,
  isPreparing = false,
  error,
  speechToTextEnabled = false,
  runtimeStatus,
  voiceEnabled = false,
  ttsProvider,
  ttsModelId,
  teacherVoiceId,
}: OnboardingIntakeProps) {
  const [stage, setStage] = useState<IntakeStage>('welcome');
  const [topic, setTopic] = useState('');
  const [learnerLevel, setLearnerLevel] = useState('');
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);
  const [teacherSpeechSuspended, setTeacherSpeechSuspended] = useState(false);
  const [teacherStopSignal, setTeacherStopSignal] = useState(0);
  
  const promptText = useMemo(() => stageSpeech(stage, topic), [stage, topic]);
  const playToken = useMemo(() => {
    if (isPreparing) return 4;
    return stage === 'welcome' ? 1 : stage === 'topic' ? 2 : 3;
  }, [isPreparing, stage]);

  const canSubmitTopic = topic.trim().length > 1 && !isPreparing;
  const canSubmitLevel = learnerLevel.trim().length > 1 && !isPreparing;

  const handleTranscript = async (transcript: string) => {
    if (stage === 'topic') {
      setTopic(transcript.trim());
      setStage('level');
      return;
    }

    if (stage === 'level') {
      const normalized = transcript.trim();
      setLearnerLevel(normalized);
      await onStart({ topic: topic.trim(), learnerLevel: normalized });
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
      {voiceEnabled ? (
        <TutorVoicePlayer
          enabled={voiceEnabled}
          text={isPreparing ? 'Hold on while I prepare this lesson for you.' : promptText}
          provider={ttsProvider}
          modelId={ttsModelId}
          voiceId={teacherVoiceId}
          playToken={playToken}
          paused={teacherSpeechSuspended}
          stopSignal={teacherStopSignal}
          onStart={() => {
            setTeacherSpeechSuspended(false);
            setTeacherSpeaking(true);
          }}
          onComplete={() => {
            setTeacherSpeechSuspended(false);
            setTeacherSpeaking(false);
          }}
          onError={() => {
            setTeacherSpeechSuspended(false);
            setTeacherSpeaking(false);
          }}
        />
      ) : null}

      {/* LEFT PANE - EDITORIAL / PRESENTATION */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-zinc-950 p-16 xl:p-24 text-zinc-50 border-r border-zinc-800">
        <div className="space-y-12">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
              Interactive Guide
            </p>
            <h1 className="text-5xl xl:text-6xl font-light tracking-tight leading-[1.1]">
              A classic approach <br /> to understanding.
            </h1>
          </div>
          <p className="text-lg leading-relaxed text-zinc-400 max-w-md font-light">
            We begin with a simple conversation. I will ask you what you want to learn and assess your current familiarity. Then, we will enter a highly focused, speech-first tutoring session.
          </p>
        </div>

        <div className="flex items-center gap-6 pb-4">
           <div className="h-[1px] w-12 bg-zinc-700"></div>
           <p className="text-[10px] tracking-widest uppercase text-zinc-500">Minimal Distraction</p>
        </div>
      </div>

      {/* RIGHT PANE - INTERACTION */}
      <div className="flex w-full lg:w-[55%] flex-col px-6 py-12 md:p-16 lg:p-24 relative overflow-y-auto">
        <div className="mx-auto w-full max-w-xl flex-1 flex flex-col justify-center space-y-16">
          
          <div className="border-l-2 border-zinc-200 pl-6 py-2">
             <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-6 font-semibold">Tutor Audio</p>
             <TutorSpeech speech={isPreparing ? 'Preparing your focused lesson…' : promptText} thinking={false} />
          </div>

          <div className="min-h-[16rem]">
            {stage === 'welcome' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <p className="text-zinc-500 text-lg font-light leading-relaxed">
                  Press start below. I will ask for the topic you wish to dive into, followed by your level of experience.
                </p>
                <button
                  type="button"
                  onClick={() => setStage('topic')}
                  className="group flex items-center justify-center gap-3 bg-zinc-950 px-8 py-4 text-xs font-semibold tracking-[0.1em] uppercase text-white transition-all hover:bg-zinc-800"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Begin Session</span>
                </button>
              </div>
            )}

            {stage === 'topic' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                  <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-zinc-400 mb-6">
                    What shall we study?
                  </label>
                  <textarea
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="e.g. Fractions, balancing equations, photosynthesis..."
                    rows={3}
                    className="w-full resize-none border-b border-zinc-200 bg-transparent py-4 text-3xl font-light leading-tight text-zinc-900 outline-none transition-colors focus:border-zinc-900 placeholder:text-zinc-200"
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-zinc-400 font-light">You can also answer by using the microphone below.</p>
                  <button
                    type="button"
                    onClick={() => setStage('level')}
                    disabled={!canSubmitTopic}
                    className="group flex items-center justify-center gap-3 bg-zinc-950 px-8 py-4 text-xs font-semibold tracking-[0.1em] uppercase text-white transition-all hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            )}

            {stage === 'level' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                  <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-zinc-400 mb-8">
                    Your current familiarity with {topic.trim() || 'this'}
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {learnerLevelOptions.map((option) => {
                      const selected = learnerLevel === option.label;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setLearnerLevel(option.label)}
                          className={`border px-6 py-6 text-left transition-colors duration-200 ${
                            selected
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-transparent text-zinc-900 hover:border-zinc-400'
                          }`}
                        >
                          <p className="text-sm font-semibold tracking-wide">{option.label}</p>
                          <p className={`mt-2 text-xs leading-relaxed ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-zinc-400 font-light">This adjusts the depth and pacing.</p>
                  <button
                    type="button"
                    onClick={() => void onStart({ topic: topic.trim(), learnerLevel: learnerLevel.trim() })}
                    disabled={!canSubmitLevel}
                    className="group flex items-center justify-center gap-3 bg-zinc-950 px-8 py-4 text-xs font-semibold tracking-[0.1em] uppercase text-white transition-all hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950"
                  >
                    {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span>{isPreparing ? 'Preparing...' : 'Set up lesson'}</span>
                  </button>
                </div>
              </div>
            )}
            
            {error ? (
              <div className="mt-8 border-l-2 border-rose-500 pl-4 py-2 text-sm text-rose-600 bg-rose-50 pr-4">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {stage !== 'welcome' && (
          <div className="sticky bottom-0 mt-12 w-full pt-8 bg-white">
            <div className="border-t border-zinc-100 pt-6">
              <TutorVoiceDock
                disabled={isPreparing}
                maintainConnection
                runtimeStatus={runtimeStatus}
                speechToTextEnabled={speechToTextEnabled}
                teacherSpeaking={teacherSpeaking}
                teacherSpeechText={isPreparing ? 'Hold on while I prepare this lesson for you.' : promptText}
                onBargeInStart={() => {
                  setTeacherSpeechSuspended(true);
                }}
                onBargeInCancel={() => {
                  setTeacherSpeechSuspended(false);
                }}
                onBargeInCommit={() => {
                  setTeacherSpeechSuspended(false);
                  setTeacherSpeaking(false);
                  setTeacherStopSignal((value) => value + 1);
                }}
                onTranscript={handleTranscript}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
