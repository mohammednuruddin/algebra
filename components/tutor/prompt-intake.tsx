'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface PromptIntakeProps {
  onStart: (prompt: string) => Promise<unknown>;
  isPreparing?: boolean;
  error?: string | null;
}

export function PromptIntake({ onStart, isPreparing = false, error }: PromptIntakeProps) {
  const [prompt, setPrompt] = useState('');

  const canStart = prompt.trim().length > 2 && !isPreparing;

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] items-center px-6 py-10 sm:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Live tutor
              </p>
              <h1 className="max-w-4xl text-4xl tracking-[-0.06em] text-slate-950 md:text-6xl md:leading-[0.96]">
                Start with a prompt. Then let the tutor take over the board.
              </h1>
              <p className="max-w-[58ch] text-base leading-relaxed text-slate-600">
                Describe what you want to learn. The tutor will prep the first scene, speak the next move,
                and keep the canvas live while you respond by voice.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/80 p-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.25)] shadow-slate-950/10 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-slate-200/70 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  What should the tutor teach right now?
                </label>
                <textarea
                  suppressHydrationWarning
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Try: Walk me through why 3x + 7 = 19 means x = 4, and use the board while you explain it."
                  rows={5}
                  className="w-full resize-none rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-base leading-relaxed text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white"
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">Speech first. Canvas live. No setup friction.</p>
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() => void onStart(prompt.trim())}
                    disabled={!canStart}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    <span>{isPreparing ? 'Preparing tutor' : 'Start live tutor'}</span>
                  </button>
                </div>
                {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.28)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Flow</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Prompt arrives.</p>
                <p>Tutor prepares the first board.</p>
                <p>Voice loop stays live while the canvas keeps changing.</p>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200/70 bg-slate-950 p-6 text-slate-50 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.42)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Interface</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>Speech stays prominent.</p>
                <p>The canvas is the working memory.</p>
                <p>The dock handles listening, interruption, and turn handoff.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
