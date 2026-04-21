import { Suspense } from 'react';
import { LessonHistoryClient } from './client';
import { BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Lesson History - AI Teaching Platform',
  description: 'View your completed lessons and learning history',
};

export interface LessonHistoryItem {
  id: string;
  title: string;
  created_at: string;
  metadata_json: {
    topic?: string;
    duration?: number;
    milestones_covered?: number;
    total_milestones?: number;
    completion_percentage?: number;
    difficulty?: string;
    first_image_url?: string;
  } | null;
}

export default async function LessonHistoryPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shadow-lg shadow-zinc-200 dark:shadow-none">
              <BookOpen className="w-5 h-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Lesson History
              </h1>
              <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                This browser&apos;s learning archive
              </p>
            </div>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Guest Mode
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-8 text-sm text-zinc-500">Loading history…</div>}>
        <LessonHistoryClient />
      </Suspense>
    </div>
  );
}
