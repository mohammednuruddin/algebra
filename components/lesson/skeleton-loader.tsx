'use client';

import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'image' | 'card' | 'action';
  className?: string;
  count?: number;
}

/**
 * Skeleton loader component for async operations
 */
export function SkeletonLoader({ 
  variant = 'text', 
  className = '',
  count = 1 
}: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'text':
        return (
          <div className={`space-y-2 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 rounded animate-pulse"
                style={{ width: `${Math.random() * 30 + 70}%` }}
              />
            ))}
          </div>
        );

      case 'image':
        return (
          <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`}>
            <div className="aspect-video w-full" />
          </div>
        );

      case 'card':
        return (
          <div className={`bg-white rounded-2xl border border-gray-100 p-6 space-y-4 ${className}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-5/6" />
            </div>
          </div>
        );

      case 'action':
        return (
          <div className={`bg-gray-50 rounded-2xl p-6 space-y-4 ${className}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return <>{renderSkeleton()}</>;
}

/**
 * Teaching response skeleton loader
 */
export function TeachingResponseSkeleton() {
  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto space-y-8 py-6">
      {/* Header skeleton */}
      <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-gray-100 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
          </div>
        </div>
      </div>

      {/* Action skeletons */}
      <SkeletonLoader variant="action" />
      <SkeletonLoader variant="image" />
      <SkeletonLoader variant="action" />
    </div>
  );
}

/**
 * Lesson board skeleton loader
 */
export function LessonBoardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
      
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <SkeletonLoader variant="image" />
    </div>
  );
}
