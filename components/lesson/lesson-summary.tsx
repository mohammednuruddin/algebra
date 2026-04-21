'use client';

import React from 'react';
import { Trophy, Clock, Target, Lightbulb, ChevronRight, RefreshCw } from 'lucide-react';

interface LessonSummaryProps {
  summary: {
    topic: string;
    milestonesCompleted: number;
    totalMilestones: number;
    insights: string[];
    duration: number; // in minutes
  };
  onStartNew?: () => void;
}

export function LessonSummary({ summary, onStartNew }: LessonSummaryProps) {
  const completionRate = Math.round((summary.milestonesCompleted / summary.totalMilestones) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-8 bg-white rounded-2xl border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-2">
          <Trophy className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Lesson Complete!</h2>
        <p className="text-slate-500">You&apos;ve successfully covered: <span className="font-semibold text-slate-700">{summary.topic}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
          <Target className="w-5 h-5 text-blue-500 mb-2" />
          <span className="text-2xl font-bold text-slate-900">{completionRate}%</span>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Completion</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
          <CheckCircle2Icon className="w-5 h-5 text-emerald-500 mb-2" />
          <span className="text-2xl font-bold text-slate-900">{summary.milestonesCompleted}/{summary.totalMilestones}</span>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Milestones</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <span className="text-2xl font-bold text-slate-900">{summary.duration}m</span>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Duration</span>
        </div>
      </div>

      {summary.insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3>Key Insights</h3>
          </div>
          <ul className="space-y-2">
            {summary.insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg text-sm text-slate-700 border border-blue-100/50">
                <ChevronRight className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onStartNew && (
        <button
          onClick={onStartNew}
          className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-200"
        >
          <RefreshCw className="w-5 h-5" />
          Start New Lesson
        </button>
      )}
    </div>
  );
}

function CheckCircle2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
