'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { LessonPreparationStage } from '@/lib/types/lesson';

interface LessonStartProps {
  onStartLesson: (topic: string) => Promise<void>;
  preparationStages?: LessonPreparationStage[];
}

export function LessonStart({
  onStartLesson,
  preparationStages = [],
}: LessonStartProps) {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onStartLesson(topic.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start lesson');
      setIsLoading(false);
    }
  };

  const orderedStages = [
    'session',
    'planning',
    'media_search',
    'media_analysis',
    'initializing',
    'ready',
  ] as const;

  const displayedStages =
    preparationStages.length > 0
      ? orderedStages
          .map((id) => preparationStages.find((stage) => stage.id === id))
          .filter((stage): stage is LessonPreparationStage => Boolean(stage))
      : [
          {
            id: 'session',
            label: 'Ready to Plan',
            detail: 'Start a session to begin planning your lesson.',
            status: 'pending' as const,
          },
        ];

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.12)]">
      <div className="grid lg:grid-cols-5">
        <div className="lg:col-span-3 p-8 md:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">
              New Session
            </span>
          </div>

          <h2 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">
            Start a New Lesson
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Enter any topic, from quantum physics to simple fractions.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="relative group">
              <label
                htmlFor="topic"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                What would you like to learn?
              </label>
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Photosynthesis, Fractions, World War 1..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-lg font-medium outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-slate-950 px-8 py-5 text-lg font-bold text-white transition-all hover:bg-slate-800 disabled:bg-slate-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Creating your lesson...</span>
                </>
              ) : (
                <>
                  <span>Start Lesson</span>
                  <CheckCircle2 className="h-5 w-5 opacity-0 transition-all group-hover:opacity-100 translate-x-2 group-hover:translate-x-0" />
                </>
              )}
            </button>

            {isLoading && preparationStages.length === 0 && (
              <p className="text-sm text-slate-500">Starting preparation...</p>
            )}
          </form>
        </div>

        <div className="lg:col-span-2 border-t border-slate-100 bg-slate-50/50 p-8 md:p-12 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Preparation Log
          </p>
          
          <div className="mt-8 space-y-4">
            {displayedStages.map((stage) => (
              <div
                key={stage.id}
                className={`flex items-start gap-4 rounded-2xl border p-4 transition-all ${
                  stage.status === 'active'
                    ? 'border-cyan-200 bg-white shadow-sm shadow-cyan-500/5'
                    : 'border-slate-100 bg-white/50'
                }`}
              >
                <div className="mt-1 shrink-0">
                  <StageIcon status={stage.status} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${
                    stage.status === 'active' ? 'text-slate-900' : 'text-slate-500'
                  }`}>
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {stage.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-cyan-600 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.15em] opacity-80">
              Guest Mode Active
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-90">
              Your session is local. Start immediately without an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: LessonPreparationStage['status'] }) {
  if (status === 'completed') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />;
  }

  if (status === 'active') {
    return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-cyan-600" />;
  }

  if (status === 'error') {
    return <div className="mt-1 h-2.5 w-2.5 rounded-full bg-rose-500" />;
  }

  return <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300" />;
}
