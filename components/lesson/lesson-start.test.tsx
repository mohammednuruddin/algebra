import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonStart } from './lesson-start';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon">Loading</div>,
  Sparkles: () => <div data-testid="sparkles-icon">Sparkles</div>,
  CheckCircle2: () => <div data-testid="check-icon">Done</div>,
}));

describe('LessonStart', () => {
  it('renders the lesson start form', () => {
    const mockOnStartLesson = vi.fn();
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    expect(screen.getByText('Start a New Lesson')).toBeTruthy();
    expect(screen.getByLabelText('What would you like to learn?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeTruthy();
  });

  it('updates topic input value when typing', () => {
    const mockOnStartLesson = vi.fn();
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const input = screen.getByLabelText('What would you like to learn?') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Photosynthesis' } });

    expect(input.value).toBe('Photosynthesis');
  });

  it('shows error when submitting empty topic', async () => {
    const mockOnStartLesson = vi.fn();
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const button = screen.getByRole('button', { name: /start lesson/i });
    
    // Button should be disabled when empty
    expect((button as HTMLButtonElement).disabled).toBe(true);
    
    expect(mockOnStartLesson).not.toHaveBeenCalled();
  });

  it('calls onStartLesson with topic when form is submitted', async () => {
    const mockOnStartLesson = vi
      .fn<(topic: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const input = screen.getByLabelText('What would you like to learn?');
    fireEvent.change(input, { target: { value: 'Photosynthesis' } });

    const button = screen.getByRole('button', { name: /start lesson/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnStartLesson).toHaveBeenCalledWith('Photosynthesis');
    });
  });

  it('shows loading state during lesson creation', async () => {
    const mockOnStartLesson = vi.fn<(topic: string) => Promise<void>>(
      () => new Promise(() => {})
    );
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const input = screen.getByLabelText('What would you like to learn?');
    fireEvent.change(input, { target: { value: 'Photosynthesis' } });

    const button = screen.getByRole('button', { name: /start lesson/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Creating your lesson...')).toBeTruthy();
      expect(screen.getByText('Starting preparation...')).toBeTruthy();
      expect(screen.getByText('Preparation Log')).toBeTruthy();
    });
  });

  it('shows error message when lesson creation fails', async () => {
    const mockOnStartLesson = vi
      .fn<(topic: string) => Promise<void>>()
      .mockRejectedValue(new Error('Network error'));
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const input = screen.getByLabelText('What would you like to learn?');
    fireEvent.change(input, { target: { value: 'Photosynthesis' } });

    const button = screen.getByRole('button', { name: /start lesson/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('disables submit button when topic is empty', () => {
    const mockOnStartLesson = vi.fn();
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const button = screen.getByRole('button', { name: /start lesson/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables submit button when topic is entered', () => {
    const mockOnStartLesson = vi.fn();
    render(<LessonStart onStartLesson={mockOnStartLesson} />);

    const input = screen.getByLabelText('What would you like to learn?');
    fireEvent.change(input, { target: { value: 'Photosynthesis' } });

    const button = screen.getByRole('button', { name: /start lesson/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
