'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { LessonHistoryItem } from './page';
import { listGuestHistoryItems } from '@/lib/guest/guest-lesson-store';

interface LessonHistoryClientProps {
  lessons?: LessonHistoryItem[];
}

function resolveImageSrc(src?: string) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const prefix = '/storage/v1/object/public/';
    if (src.includes(prefix) && !src.includes(`${prefix}media-assets/`)) {
      return src.replace(prefix, `${prefix}media-assets/`);
    }
    return src;
  }
  if (src.startsWith('/')) return src;

  const cleanPath = src.startsWith('media-assets/')
    ? src.replace('media-assets/', '')
    : src;
  return `/storage/v1/object/public/media-assets/${cleanPath}`;
}

export function LessonHistoryClient({
  lessons: initialLessons = [],
}: LessonHistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessons = useMemo(
    () => (initialLessons.length > 0 ? initialLessons : listGuestHistoryItems()),
    [initialLessons]
  );

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  const updateURLParams = (search: string, start: string, end: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (start) params.set('startDate', start);
    if (end) params.set('endDate', end);

    const queryString = params.toString();
    router.push(
      queryString ? `/lessons/history?${queryString}` : '/lessons/history',
      { scroll: false }
    );
  };

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = lesson.title.toLowerCase().includes(query);
        const topicMatch =
          lesson.metadata_json?.topic?.toLowerCase().includes(query) || false;

        if (!titleMatch && !topicMatch) {
          return false;
        }
      }

      const lessonDate = new Date(lesson.created_at);

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (lessonDate < start) {
          return false;
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (lessonDate > end) {
          return false;
        }
      }

      return true;
    });
  }, [endDate, lessons, searchQuery, startDate]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    updateURLParams(value, startDate, endDate);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    updateURLParams(searchQuery, value, endDate);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    updateURLParams(searchQuery, startDate, value);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    router.push('/lessons/history', { scroll: false });
  };

  const hasActiveFilters = searchQuery || startDate || endDate;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {lessons.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by topic or title..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {hasActiveFilters ? (
              <span>
                Showing {filteredLessons.length} of {lessons.length} lessons
              </span>
            ) : (
              <span>{lessons.length} total lessons</span>
            )}
          </div>
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
            <svg
              className="w-8 h-8 text-zinc-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50 mb-2">
            No lessons yet
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Complete your first lesson to see it here
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start a Lesson
          </Link>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
            <svg
              className="w-8 h-8 text-zinc-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50 mb-2">
            No lessons found
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Try adjusting your search or filter criteria
          </p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => {
            const metadata = lesson.metadata_json || {};
            const completionPercentage = metadata.completion_percentage || 100;
            const duration = metadata.duration
              ? Math.round(metadata.duration / 60)
              : null;
            const milestonesCovered = metadata.milestones_covered || 0;
            const totalMilestones = metadata.total_milestones || 0;
            const difficulty = metadata.difficulty || 'Intermediate';
            const firstImageUrl = metadata.first_image_url;

            const date = new Date(lesson.created_at);
            const formattedDate = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <Link
                key={lesson.id}
                href={`/lessons/article/${lesson.id}`}
                className="group bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-zinc-800 dark:to-zinc-900 relative overflow-hidden">
                  {firstImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageSrc(firstImageUrl)}
                      alt={lesson.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-indigo-300 dark:text-zinc-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {lesson.title}
                  </h3>

                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    {formattedDate}
                  </p>

                  <div className="space-y-2">
                    {duration !== null && (
                      <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{duration} min</span>
                      </div>
                    )}

                    {totalMilestones > 0 && (
                      <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          {milestonesCovered}/{totalMilestones} milestones
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {difficulty}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {completionPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
