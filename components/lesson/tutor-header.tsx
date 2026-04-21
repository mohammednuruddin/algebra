'use client';

type TutorHeaderProps = {
  title: string;
  progressPercent: number;
  sessionComplete: boolean;
  onEndLesson: () => void;
  ending: boolean;
};

export function TutorHeader({
  title,
  progressPercent,
  sessionComplete,
  onEndLesson,
  ending,
}: TutorHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-1 pb-3 pt-1">
      <button
        type="button"
        onClick={onEndLesson}
        disabled={ending}
        className="rounded-full px-3 py-1 text-sm font-medium text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
      >
        {ending ? 'Ending...' : 'End Lesson'}
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </p>
      </div>

      <div className="min-w-[3rem] text-right text-sm font-medium text-slate-400">
        {sessionComplete ? 'Done' : `${Math.round(progressPercent)}%`}
      </div>
    </div>
  );
}
