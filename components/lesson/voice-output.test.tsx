import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceOutput } from './voice-output';

// Mock Audio API
class MockAudio {
  static lastInstance: MockAudio | null = null;
  src = '';
  volume = 1;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src?: string) {
    if (src) this.src = src;
    MockAudio.lastInstance = this;
  }

  play() {
    this.onplay?.();
    return Promise.resolve();
  }

  pause() {
    this.onpause?.();
  }
}

global.Audio = MockAudio as unknown as typeof Audio;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock fetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(global.fetch);

const blobResponse = (blob: Blob, init?: ResponseInit) =>
  ({
    ok: init?.status ? init.status < 400 : true,
    status: init?.status ?? 200,
    blob: async () => blob,
  } as unknown as Response);

const errorResponse = (status = 500) =>
  ({
    ok: false,
    status,
  } as unknown as Response);

describe('VoiceOutput', () => {
  const mockOnComplete = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    MockAudio.lastInstance = null;
    
    // Mock successful TTS response
    mockFetch.mockResolvedValue(
      blobResponse(new Blob(['mock-audio-data'], { type: 'audio/mpeg' }))
    );
  });

  it('generates audio when text is provided', async () => {
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/elevenlabs/tts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Hello world'),
        })
      );
    });
  });

  it('renders play button', async () => {
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /play/i });
      expect(button).toBeDefined();
    });
  });

  it('renders mute button', async () => {
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /mute/i });
      expect(button).toBeDefined();
    });
  });

  it('auto-plays audio when autoPlay is true', async () => {
    const playSpy = vi.spyOn(MockAudio.prototype, 'play');
    
    render(<VoiceOutput text="Hello world" autoPlay={true} />);
    
    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });
  });

  it('does not auto-play when autoPlay is false', async () => {
    const playSpy = vi.spyOn(MockAudio.prototype, 'play');
    
    render(<VoiceOutput text="Hello world" autoPlay={false} />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    
    // Wait a bit to ensure play is not called
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('calls onComplete when audio finishes playing', async () => {
    render(<VoiceOutput text="Hello world" onComplete={mockOnComplete} autoPlay={true} />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(MockAudio.lastInstance).not.toBeNull();
    });
    
    // Simulate audio ending
    MockAudio.lastInstance?.onended?.();
    
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('calls onError when audio generation fails', async () => {
    mockFetch.mockResolvedValue(errorResponse());
    
    render(<VoiceOutput text="Hello world" onError={mockOnError} />);
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('displays error message when generation fails', async () => {
    mockFetch.mockResolvedValue(errorResponse());
    
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to generate speech/i)).toBeDefined();
    });
  });

  it('uses custom voiceId when provided', async () => {
    render(<VoiceOutput text="Hello world" voiceId="custom-voice-id" />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/elevenlabs/tts',
        expect.objectContaining({
          body: expect.stringContaining('custom-voice-id'),
        })
      );
    });
  });

  it('toggles mute state when mute button is clicked', async () => {
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      const muteButton = screen.getByRole('button', { name: /mute/i });
      expect(muteButton).toBeDefined();
    });
    
    const muteButton = screen.getByRole('button', { name: /mute/i });
    await userEvent.click(muteButton);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unmute/i })).toBeDefined();
    });
  });

  it('creates object URL for audio blob', async () => {
    render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('revokes object URL on unmount', async () => {
    const { unmount } = render(<VoiceOutput text="Hello world" />);
    
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    
    unmount();
    
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('does not render when text is empty', () => {
    const { container } = render(<VoiceOutput text="" />);
    expect(container.firstChild).toBeNull();
  });
});
