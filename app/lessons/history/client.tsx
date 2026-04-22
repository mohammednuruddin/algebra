'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Calendar, Clock, Target, CheckCircle2, BookOpen, X, ChevronRight, ArrowLeft } from 'lucide-react';
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

// Generate consistent beautiful gradients based on string hash
function getGradientFromId(id: string) {
  const gradients = [
    'from-indigo-400 to-purple-400',
    'from-blue-400 to-cyan-400',
    'from-emerald-400 to-teal-400',
    'from-rose-400 to-orange-400',
    'from-fuchsia-400 to-pink-400',
    'from-violet-400 to-indigo-400',
    'from-amber-400 to-red-400',
    'from-sky-400 to-blue-500'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
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
    <main className="max-w-7xl mx-auto px-6 py-12 lg:py-16 min-h-screen bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="mb-8 max-w-4xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Home
        </Link>
      </div>
      
      {lessons.length > 0 && (
        <div className="mb-12">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3 sm:p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 sm:items-center w-full max-w-4xl mx-auto">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search by topic or title..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="block w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-none rounded-2xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
              />
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 px-2 sm:px-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="block w-[140px] pl-9 pr-3 py-3 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  aria-label="Start Date"
                />
              </div>
              <span className="text-zinc-300 dark:text-zinc-700 font-medium">-</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="block w-[140px] pl-9 pr-3 py-3 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  aria-label="End Date"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors shrink-0"
                title="Clear filters"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="text-center mt-6">
            <span className="inline-block px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">
              {hasActiveFilters ? (
                <>Showing {filteredLessons.length} of {lessons.length} lessons</>
              ) : (
                <>{lessons.length} total lessons</>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Empty States */}
      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto">
          <div className="w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-indigo-500" />
            </div>
          </div>
          <h2 className="text-3xl font-serif text-zinc-900 dark:text-zinc-50 mb-4">
            Your Learning Journey Begins
          </h2>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed">
            You haven't completed any lessons yet. Dive into your first topic and start building your knowledge base.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full font-semibold hover:scale-105 transition-transform shadow-lg shadow-zinc-200 dark:shadow-none"
          >
            Start a Lesson <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
            <Search className="w-8 h-8 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-serif text-zinc-900 dark:text-zinc-50 mb-3">
            No lessons found
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md">
            We couldn't find any lessons matching your search criteria. Try adjusting your filters or search terms.
          </p>
          <button
            onClick={clearFilters}
            className="px-6 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-semibold rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
              month: 'long',
              day: 'numeric',
            });
            
            const gradientClass = getGradientFromId(lesson.id);

            return (
              <Link
                key={lesson.id}
                href={`/lessons/article/${lesson.id}`}
                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 ease-out"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 p-2">
                  <div className={`w-full h-full rounded-3xl overflow-hidden relative ${!firstImageUrl ? `bg-gradient-to-br ${gradientClass}` : ''}`}>
                    {firstImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageSrc(firstImageUrl)}
                        alt={lesson.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-white relative">
                         {/* Abstract shapes for visual interest */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl transform -translate-x-1/2 translate-y-1/2" />
                        
                        <BookOpen className="w-12 h-12 mb-4 opacity-90 drop-shadow-md group-hover:scale-110 transition-transform duration-500" />
                        <p className="text-center font-serif text-xl font-bold opacity-90 drop-shadow-sm leading-tight line-clamp-3">
                          {lesson.title}
                        </p>
                      </div>
                    )}
                    
                    {/* Badge Overlay */}
                    {metadata?.topic && (
                      <div className="absolute top-4 left-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-xs font-semibold text-white tracking-wide shadow-sm border border-white/20">
                          {metadata.topic}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formattedDate}
                    </p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {difficulty}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-serif font-medium text-zinc-900 dark:text-zinc-50 mb-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                    {lesson.title}
                  </h3>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      {duration !== null && (
                        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                          <Clock className="w-4 h-4" />
                          <span>{duration}m</span>
                        </div>
                      )}
                      
                      {totalMilestones > 0 && (
                        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                          <Target className="w-4 h-4" />
                          <span>{milestonesCovered}/{totalMilestones}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-zinc-500 font-medium">Completion</span>
                        <span className="text-zinc-900 dark:text-zinc-50 font-bold">{completionPercentage}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
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
