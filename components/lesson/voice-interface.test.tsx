import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoiceInterface } from './voice-interface';

type VoiceInputMockProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

type VoiceOutputMockProps = {
  text: string;
  voiceId?: string;
  autoPlay?: boolean;
};

// Mock child components
vi.mock('./voice-input', () => ({
  VoiceInput: ({ onTranscript, disabled }: VoiceInputMockProps) => (
    <div data-testid="voice-input">
      <button onClick={() => onTranscript('test transcript')} disabled={disabled}>
        Mock Voice Input
      </button>
    </div>
  ),
}));

vi.mock('./voice-output', () => ({
  VoiceOutput: ({ text, voiceId, autoPlay }: VoiceOutputMockProps) => (
    <div data-testid="voice-output">
      Mock Voice Output: {text}
      {voiceId && ` (Voice: ${voiceId})`}
      {autoPlay && ' (Auto-play)'}
    </div>
  ),
}));

describe('VoiceInterface', () => {
  const mockOnUserSpeech = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders voice input section', () => {
    render(<VoiceInterface onUserSpeech={mockOnUserSpeech} />);
    
    expect(screen.getByText(/your response/i)).toBeDefined();
    expect(screen.getByTestId('voice-input')).toBeDefined();
  });

  it('renders voice output section when teacher response is provided', () => {
    render(
      <VoiceInterface 
        onUserSpeech={mockOnUserSpeech} 
        teacherResponse="Hello student"
      />
    );
    
    expect(screen.getByText(/teacher response/i)).toBeDefined();
    expect(screen.getByTestId('voice-output')).toBeDefined();
    expect(screen.getAllByText(/hello student/i).length).toBeGreaterThan(0);
  });

  it('does not render voice output section when no teacher response', () => {
    render(<VoiceInterface onUserSpeech={mockOnUserSpeech} />);
    
    expect(screen.queryByText(/teacher response/i)).toBeNull();
    expect(screen.queryByTestId('voice-output')).toBeNull();
  });

  it('passes disabled prop to voice input', () => {
    render(<VoiceInterface onUserSpeech={mockOnUserSpeech} disabled={true} />);
    
    const button = screen.getByText('Mock Voice Input');
    expect(button).toBeDisabled();
  });

  it('passes voiceId to voice output', () => {
    render(
      <VoiceInterface 
        onUserSpeech={mockOnUserSpeech} 
        teacherResponse="Hello"
        voiceId="custom-voice"
      />
    );
    
    expect(screen.getByText(/voice: custom-voice/i)).toBeDefined();
  });

  it('passes autoPlayResponse to voice output', () => {
    render(
      <VoiceInterface 
        onUserSpeech={mockOnUserSpeech} 
        teacherResponse="Hello"
        autoPlayResponse={true}
      />
    );
    
    expect(screen.getByText(/auto-play/i)).toBeDefined();
  });

  it('displays transcript after user speaks', async () => {
    const { findByText } = render(<VoiceInterface onUserSpeech={mockOnUserSpeech} />);
    
    const button = screen.getByText('Mock Voice Input');
    button.click();
    
    const transcriptElement = await findByText(/you said:/i);
    expect(transcriptElement).toBeDefined();
  });

  it('calls onUserSpeech when transcript is received', () => {
    render(<VoiceInterface onUserSpeech={mockOnUserSpeech} />);
    
    const button = screen.getByText('Mock Voice Input');
    button.click();
    
    expect(mockOnUserSpeech).toHaveBeenCalledWith('test transcript');
  });
});
