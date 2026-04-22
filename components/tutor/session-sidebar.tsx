'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { listGuestHistoryItems } from '@/lib/guest/guest-lesson-store';
import type { LessonArticleRecord } from '@/lib/types/database';

interface SessionSidebarProps {
  currentSessionId?: string;
  isGeneratingArticle?: boolean;
  article?: LessonArticleRecord | null;
  onNewSession?: () => void;
}

export function SessionSidebar({
  currentSessionId,
  isGeneratingArticle = false,
  article,
  onNewSession,
}: SessionSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sortedItems = useMemo(() => {
    const items = listGuestHistoryItems();
    return [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  if (collapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-4 bg-zinc-950 border-r border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <BookOpen className="h-4 w-4 text-zinc-600" />
          <span className="text-[9px] text-zinc-600 font-bold tracking-widest [writing-mode:vertical-lr] rotate-180">
            HISTORY
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full flex flex-col bg-zinc-950 border-r border-zinc-800 shrink-0">
      <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Lessons
        </p>
        <div className="flex items-center gap-1">
          {onNewSession && (
            <button
              type="button"
              onClick={onNewSession}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="New session"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {isGeneratingArticle && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-zinc-900 border border-zinc-800">
            <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin shrink-0" />
            <span className="text-xs text-zinc-400 truncate">Generating article...</span>
          </div>
        )}

        {article && (
          <Link
            href={`/lessons/article/${article.id}`}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors group"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">
                {article.title}
              </p>
              <p className="text-[10px] text-emerald-500 mt-0.5">Just generated</p>
            </div>
          </Link>
        )}

        {sortedItems.map((item) => {
          const isCurrent = item.id === currentSessionId;
          return (
            <Link
              key={item.id}
              href={`/lessons/article/${item.id}`}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md transition-colors group ${
                isCurrent
                  ? 'bg-zinc-800 border border-zinc-700'
                  : 'hover:bg-zinc-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5 group-hover:text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-zinc-200">
                  {item.title}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          );
        })}

        {sortedItems.length === 0 && !article && !isGeneratingArticle && (
          <div className="px-3 py-8 text-center">
            <BookOpen className="h-6 w-6 text-zinc-700 mx-auto mb-3" />
            <p className="text-xs text-zinc-600">
              Completed lessons will appear here
            </p>
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-zinc-800">
        <Link
          href="/lessons/history"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          View all history
        </Link>
      </div>
    </div>
  );
}
