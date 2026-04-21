import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceInput } from './voice-input';

const mockStart = vi.fn();
const mockPause = vi.fn();
const mockEncodeWav = vi.fn(() => new ArrayBuffer(8));

let mockVadState = {
  loading: false,
  listening: false,
  userSpeaking: false,
  start: mockStart,
  pause: mockPause,
};

let capturedOptions:
  | {
      onSpeechStart?: () => void;
      onSpeechEnd?: (audio: Float32Array) => Promise<void>;
    }
  | undefined;

vi.mock('@ricky0123/vad-react', () => ({
  useMicVAD: vi.fn((options) => {
    capturedOptions = options;
    return mockVadState;
  }),
}));

vi.mock('@ricky0123/vad-web', () => ({
  utils: {
    encodeWAV: () => mockEncodeWav(),
  },
}));

describe('VoiceInput', () => {
  const mockOnTranscript = vi.fn();
  const mockOnPartialTranscript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = undefined;
    mockVadState = {
      loading: false,
      listening: false,
      userSpeaking: false,
      start: mockStart,
      pause: mockPause,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: 'learner transcript' }),
    }) as typeof global.fetch;
  });

  it('renders a microphone button for the AssemblyAI + VAD flow', () => {
    render(<VoiceInput onTranscript={mockOnTranscript} />);

    expect(
      screen.getByRole('button', { name: /start microphone/i })
    ).toBeDefined();
    expect(screen.getByText(/status:\s*idle/i)).toBeDefined();
  });

  it('disables the microphone button when disabled is true', () => {
    render(<VoiceInput onTranscript={mockOnTranscript} disabled={true} />);

    expect(
      screen.getByRole('button', { name: /start microphone/i })
    ).toBeDisabled();
  });

  it('starts listening when the learner taps the microphone', async () => {
    render(<VoiceInput onTranscript={mockOnTranscript} />);

    fireEvent.click(screen.getByRole('button', { name: /start microphone/i }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  it('transcribes a completed speech segment and forwards the transcript', async () => {
    render(
      <VoiceInput
        onTranscript={mockOnTranscript}
        onPartialTranscript={mockOnPartialTranscript}
      />
    );

    capturedOptions?.onSpeechStart?.();
    await capturedOptions?.onSpeechEnd?.(new Float32Array([0.1, 0.2, 0.3]));

    await waitFor(() => {
      expect(mockEncodeWav).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assemblyai/transcribe',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(mockOnTranscript).toHaveBeenCalledWith('learner transcript');
    });

    expect(mockOnPartialTranscript).toHaveBeenNthCalledWith(1, 'Listening...');
    expect(mockOnPartialTranscript).toHaveBeenNthCalledWith(2, 'Transcribing...');
    expect(mockOnPartialTranscript).toHaveBeenNthCalledWith(3, '');
    expect(screen.getByText('learner transcript')).toBeDefined();
  });
});
