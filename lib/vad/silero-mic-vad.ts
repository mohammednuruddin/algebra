import { MicVAD, type FrameProcessorOptions } from '@ricky0123/vad-web';

const SILERO_VAD_BASE_ASSET_PATH = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/';
const ONNX_WASM_BASE_PATH = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';

const DEFAULT_THRESHOLDS: Partial<FrameProcessorOptions> = {
  positiveSpeechThreshold: 0.3,
  negativeSpeechThreshold: 0.25,
  redemptionMs: 1400,
  preSpeechPadMs: 800,
  minSpeechMs: 400,
};

const TUTOR_SPEAKING_THRESHOLDS: Partial<FrameProcessorOptions> = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  redemptionMs: 500,
  preSpeechPadMs: 30,
  minSpeechMs: 250,
};

export class SileroMicVadController {
  private vad: MicVAD | null = null;
  private currentStream: MediaStream | null = null;
  private speechStartHandler: (() => void) | null = null;
  private speechEndHandler: ((audio: Float32Array) => void | Promise<void>) | null = null;
  private vadMisfireHandler: (() => void | Promise<void>) | null = null;

  async start(
    stream: MediaStream,
    onSpeechStart: () => void,
    onSpeechEnd?: (audio: Float32Array) => void | Promise<void>,
    onVADMisfire?: () => void | Promise<void>
  ) {
    this.currentStream = stream;
    this.speechStartHandler = onSpeechStart;
    this.speechEndHandler = onSpeechEnd ?? null;
    this.vadMisfireHandler = onVADMisfire ?? null;

    if (!this.vad) {
      this.vad = await MicVAD.new({
        startOnLoad: false,
        model: 'v5',
        baseAssetPath: SILERO_VAD_BASE_ASSET_PATH,
        onnxWASMBasePath: ONNX_WASM_BASE_PATH,
        getStream: async () => this.requireStream(),
        resumeStream: async () => this.requireStream(),
        pauseStream: async () => {
          // The live tutor dock owns the microphone lifecycle.
        },
        onSpeechStart: () => {
          this.speechStartHandler?.();
        },
        onSpeechEnd: (audio) => {
          void this.speechEndHandler?.(audio);
        },
        onSpeechRealStart: () => {
          // The live tutor dock uses onSpeechStart for immediate provisional pause.
        },
        onVADMisfire: () => {
          void this.vadMisfireHandler?.();
        },
        onFrameProcessed: () => {
          // No-op for now.
        },
      });
    }

    this.vad.setOptions(DEFAULT_THRESHOLDS);

    await this.vad.start();
  }

  setTeacherSpeaking(teacherSpeaking: boolean) {
    this.vad?.setOptions(
      teacherSpeaking ? TUTOR_SPEAKING_THRESHOLDS : DEFAULT_THRESHOLDS
    );
  }

  async pause() {
    if (!this.vad?.listening) {
      return;
    }

    await this.vad.pause();
  }

  async destroy() {
    if (!this.vad) {
      return;
    }

    await this.vad.destroy();
    this.vad = null;
    this.currentStream = null;
    this.speechStartHandler = null;
    this.speechEndHandler = null;
    this.vadMisfireHandler = null;
  }

  private requireStream() {
    if (!this.currentStream) {
      throw new Error('Silero VAD stream unavailable');
    }

    return this.currentStream;
  }
}
