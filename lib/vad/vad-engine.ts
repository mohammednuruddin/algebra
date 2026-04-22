/**
 * Energy-based Voice Activity Detector with echo suppression.
 *
 * Ported from zo's VadService (Dart) to TypeScript for the web.
 * Monitors smoothed audio levels and fires speech-start / speech-end
 * callbacks when sustained speech is detected or silence follows speech.
 *
 * During TTS playback the detector enters echo-suppressed mode: the
 * speech-onset threshold is raised so only genuine user speech (not
 * loudspeaker bleed) triggers a barge-in event.
 */

export interface VadEngineConfig {
  /** Minimum smoothed level to consider speech when NOT echo-suppressed. */
  speechThreshold?: number;
  /** Level below which the detector considers the user silent. */
  silenceThreshold?: number;
  /** Minimum smoothed level to consider speech DURING TTS playback. */
  echoSuppressedThreshold?: number;
  /** How long (ms) the level must stay above threshold before speech is confirmed. */
  speechOnsetMs?: number;
  /** How long (ms) the level must stay below threshold before silence is confirmed. */
  silenceOffsetMs?: number;
  /** Grace period (ms) after TTS stops before lowering threshold back to normal. */
  postTtsCooldownMs?: number;
}

export type VadCallback = () => void;

const DEFAULTS = {
  speechThreshold: 0.18,
  silenceThreshold: 0.08,
  echoSuppressedThreshold: 0.30,
  speechOnsetMs: 180,
  silenceOffsetMs: 300,
  postTtsCooldownMs: 350,
} as const;

export class VadEngine {
  onSpeechStart: VadCallback | null = null;
  onSpeechEnd: VadCallback | null = null;

  private readonly _speechThreshold: number;
  private readonly _silenceThreshold: number;
  private readonly _echoSuppressedThreshold: number;
  private readonly _speechOnsetMs: number;
  private readonly _silenceOffsetMs: number;
  private readonly _postTtsCooldownMs: number;

  private _isSpeaking = false;
  private _echoSuppressed = false;
  private _ttsStoppedAt: number | null = null;
  private _speechOnsetStartedAt: number | null = null;
  private _silenceOnsetStartedAt: number | null = null;

  constructor(config: VadEngineConfig = {}) {
    this._speechThreshold = config.speechThreshold ?? DEFAULTS.speechThreshold;
    this._silenceThreshold = config.silenceThreshold ?? DEFAULTS.silenceThreshold;
    this._echoSuppressedThreshold = config.echoSuppressedThreshold ?? DEFAULTS.echoSuppressedThreshold;
    this._speechOnsetMs = config.speechOnsetMs ?? DEFAULTS.speechOnsetMs;
    this._silenceOffsetMs = config.silenceOffsetMs ?? DEFAULTS.silenceOffsetMs;
    this._postTtsCooldownMs = config.postTtsCooldownMs ?? DEFAULTS.postTtsCooldownMs;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  get isEchoSuppressed(): boolean {
    if (this._echoSuppressed) return true;
    if (this._ttsStoppedAt === null) return false;
    return Date.now() - this._ttsStoppedAt < this._postTtsCooldownMs;
  }

  notifyTtsStarted(): void {
    this._echoSuppressed = true;
    this._ttsStoppedAt = null;
  }

  notifyTtsStopped(): void {
    this._echoSuppressed = false;
    this._ttsStoppedAt = Date.now();
  }

  feedLevel(level: number): void {
    const now = Date.now();
    const effectiveThreshold = this.isEchoSuppressed
      ? this._echoSuppressedThreshold
      : this._speechThreshold;

    if (level >= effectiveThreshold) {
      this._silenceOnsetStartedAt = null;

      if (!this._isSpeaking) {
        if (this._speechOnsetStartedAt === null) {
          this._speechOnsetStartedAt = now;
        }
        if (now - this._speechOnsetStartedAt >= this._speechOnsetMs) {
          this._isSpeaking = true;
          this._speechOnsetStartedAt = null;
          this.onSpeechStart?.();
        }
      }
    } else if (level < this._silenceThreshold) {
      this._speechOnsetStartedAt = null;

      if (this._isSpeaking) {
        if (this._silenceOnsetStartedAt === null) {
          this._silenceOnsetStartedAt = now;
        }
        if (now - this._silenceOnsetStartedAt >= this._silenceOffsetMs) {
          this._isSpeaking = false;
          this._silenceOnsetStartedAt = null;
          this.onSpeechEnd?.();
        }
      }
    }
  }

  reset(): void {
    this._isSpeaking = false;
    this._echoSuppressed = false;
    this._ttsStoppedAt = null;
    this._speechOnsetStartedAt = null;
    this._silenceOnsetStartedAt = null;
  }
}
