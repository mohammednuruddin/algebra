import { Suspense } from 'react';
import { LessonHistoryClient } from './client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/50 transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 hidden sm:block" />
            <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-900 dark:text-zinc-50 hidden sm:block">
              Lesson Library
            </h1>
          </div>
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
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
