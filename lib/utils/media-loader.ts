/**
 * Media loading and caching utilities
 * Implements lazy loading, caching, and optimization strategies for media assets
 */

interface CachedMedia {
  url: string;
  blob: Blob;
  timestamp: number;
}

class MediaCache {
  private cache = new Map<string, CachedMedia>();
  private maxAge = 1000 * 60 * 30; // 30 minutes
  private maxSize = 50; // Maximum number of cached items

  /**
   * Get media from cache or fetch if not cached
   */
  async get(url: string): Promise<string> {
    const cached = this.cache.get(url);
    
    // Return cached if valid
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return URL.createObjectURL(cached.blob);
    }

    // Fetch and cache
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch media');
      
      const blob = await response.blob();
      
      // Evict oldest if cache is full
      if (this.cache.size >= this.maxSize) {
        const oldest = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        this.cache.delete(oldest[0]);
      }
      
      this.cache.set(url, { url, blob, timestamp: Date.now() });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Media fetch error:', error);
      return url; // Fallback to original URL
    }
  }

  /**
   * Preload media assets
   */
  async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map(url => this.get(url)));
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove specific item from cache
   */
  remove(url: string): void {
    this.cache.delete(url);
  }
}

// Singleton instance
export const mediaCache = new MediaCache();

/**
 * Lazy load image with intersection observer
 */
export function useLazyImage(
  ref: React.RefObject<HTMLImageElement>,
  src: string,
  options?: IntersectionObserverInit
): (() => void) | void {
  if (typeof window === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting && ref.current) {
        const cachedUrl = await mediaCache.get(src);
        ref.current.src = cachedUrl;
        observer.disconnect();
      }
    });
  }, options);

  if (ref.current) {
    observer.observe(ref.current);
  }

  return () => observer.disconnect();
}

/**
 * Optimize image URL with size and format parameters
 */
export function optimizeImageUrl(
  url: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  }
): string {
  // For Supabase Storage URLs, add transformation parameters
  if (url.includes('supabase')) {
    const params = new URLSearchParams();
    if (options?.width) params.set('width', options.width.toString());
    if (options?.height) params.set('height', options.height.toString());
    if (options?.quality) params.set('quality', options.quality.toString());
    if (options?.format) params.set('format', options.format);
    
    const separator = url.includes('?') ? '&' : '?';
    return params.toString() ? `${url}${separator}${params.toString()}` : url;
  }
  
  return url;
}

/**
 * Preload critical media assets
 */
export async function preloadCriticalMedia(urls: string[]): Promise<void> {
  await mediaCache.preload(urls);
}
