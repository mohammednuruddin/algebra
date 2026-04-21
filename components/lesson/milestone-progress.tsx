'use client';

import React from 'react';
import { CheckCircle2, Circle, CircleDashed } from 'lucide-react';

export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
}

interface MilestoneProgressProps {
  milestones: Milestone[];
  currentMilestoneId: string | null;
}

export function MilestoneProgress({ milestones, currentMilestoneId }: MilestoneProgressProps) {
  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const progressPercentage = milestones.length
    ? (completedCount / milestones.length) * 100
    : 0;

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        {milestones.map((milestone) => {
          const isCurrent = milestone.id === currentMilestoneId;
          const isCompleted = milestone.status === 'completed';
          const isInProgress = milestone.status === 'in_progress' || isCurrent;

          return (
            <div
              key={milestone.id}
              className={`flex items-start gap-4 transition-all ${
                isCurrent ? 'scale-[1.02]' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                ) : isInProgress ? (
                  <div className="relative flex h-5 w-5 items-center justify-center">
                    <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-20" />
                    <Circle className="relative h-4 w-4 fill-cyan-500 text-cyan-500" />
                  </div>
                ) : (
                  <CircleDashed className="h-4 w-4 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold uppercase tracking-tight ${
                    isCompleted ? "text-slate-400" : isCurrent ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {milestone.title}
                </p>
                {isCurrent && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
                    {milestone.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Completion
          </span>
          <span className="text-xs font-bold text-slate-900">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-600 transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
