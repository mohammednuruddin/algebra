/**
 * Audio buffering and streaming utilities
 * Optimizes audio performance with buffering and preloading
 */

interface AudioBufferItem {
  url: string;
  buffer: ArrayBuffer;
  timestamp: number;
}

type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

class AudioBufferCache {
  private cache = new Map<string, AudioBufferItem>();
  private maxAge = 1000 * 60 * 10; // 10 minutes
  private maxSize = 20; // Maximum number of cached audio buffers

  /**
   * Get audio buffer from cache or fetch
   */
  async get(url: string): Promise<ArrayBuffer> {
    const cached = this.cache.get(url);
    
    // Return cached if valid
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.buffer;
    }

    // Fetch and cache
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch audio');
    
    const buffer = await response.arrayBuffer();
    
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
    
    this.cache.set(url, { url, buffer, timestamp: Date.now() });
    return buffer;
  }

  /**
   * Preload audio
   */
  async preload(url: string): Promise<void> {
    await this.get(url);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
}

export const audioBufferCache = new AudioBufferCache();

/**
 * Streaming audio player with buffering
 */
export class StreamingAudioPlayer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const AudioContextConstructor =
        window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;
      this.audioContext = new AudioContextConstructor!();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  /**
   * Play audio from URL with buffering
   */
  async play(url: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;

    // Stop current playback
    this.stop();

    try {
      // Get buffered audio
      const arrayBuffer = await audioBufferCache.get(url);
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Create and connect source
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = audioBuffer;
      this.sourceNode.connect(this.gainNode);

      // Play
      this.sourceNode.start(0, this.pauseTime);
      this.startTime = this.audioContext.currentTime - this.pauseTime;
      this.isPlaying = true;
    } catch (error) {
      console.error('Audio playback error:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.audioContext || !this.sourceNode || !this.isPlaying) return;

    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.sourceNode.stop();
    this.isPlaying = false;
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
    this.startTime = 0;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get playing state
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
