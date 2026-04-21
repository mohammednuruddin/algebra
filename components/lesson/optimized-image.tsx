'use client';

import Image from 'next/image';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { mediaCache, optimizeImageUrl } from '../../lib/utils/media-loader';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Optimized image component with lazy loading and caching
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  quality = 85,
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(priority ? src : null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadImage = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);

      // Optimize URL
      const optimizedUrl = optimizeImageUrl(src, {
        width,
        height,
        quality,
        format: 'webp',
      });

      // Get from cache or fetch
      const cachedUrl = await mediaCache.get(optimizedUrl);
      setImageSrc(cachedUrl);
      
      onLoad?.();
    } catch (error) {
      console.error('Image load error:', error);
      setHasError(true);
      onError?.(error instanceof Error ? error : new Error('Failed to load image'));
    } finally {
      setIsLoading(false);
    }
  }, [src, width, height, quality, onLoad, onError]);

  useEffect(() => {
    if (priority) {
      const loadTimer = window.setTimeout(() => {
        void loadImage();
      }, 0);

      return () => window.clearTimeout(loadTimer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void loadImage();
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [loadImage, priority]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && !imageSrc && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded" />
      )}

      {hasError ? (
        <div className="flex items-center justify-center bg-gray-100 rounded p-4 text-gray-400">
          Failed to load image
        </div>
      ) : (
        <Image
          ref={imgRef}
          src={imageSrc || src}
          alt={alt}
          width={width || 800}
          height={height || 600}
          quality={quality}
          unoptimized
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={() => setIsLoading(false)}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
    </div>
  );
}
