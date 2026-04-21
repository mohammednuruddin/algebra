import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonBoard } from './lesson-board';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => <div data-testid="check-icon">✓</div>,
  Circle: () => <div data-testid="circle-icon">○</div>,
  XCircle: () => <div data-testid="x-icon">✗</div>,
}));

describe('LessonBoard', () => {
  const mockMilestones = [
    {
      id: '1',
      title: 'Introduction',
      description: 'Learn the basics',
      status: 'completed' as const,
    },
    {
      id: '2',
      title: 'Core Concepts',
      description: 'Understand key ideas',
      status: 'in_progress' as const,
    },
    {
      id: '3',
      title: 'Advanced Topics',
      description: 'Deep dive',
      status: 'not_started' as const,
    },
  ];

  const mockMediaAssets = [
    {
      id: 'asset1',
      url: 'https://example.com/image1.jpg',
      type: 'image',
      caption: 'Test diagram',
    },
  ];

  it('renders lesson board with topic and milestones', () => {
    const mockOnEndLesson = vi.fn();
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    expect(screen.getByText('Photosynthesis')).toBeTruthy();
    expect(screen.getAllByText('Introduction').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Core Concepts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Advanced Topics').length).toBeGreaterThan(0);
  });

  it('displays current milestone in header', () => {
    const mockOnEndLesson = vi.fn();
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    expect(screen.getByText(/Current:/)).toBeTruthy();
    expect(screen.getAllByText('Core Concepts').length).toBeGreaterThan(0);
  });

  it('renders media assets with captions', () => {
    const mockOnEndLesson = vi.fn();
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    const image = screen.getByAltText('Test diagram') as HTMLImageElement;
    expect(image.src).toBe('https://example.com/image1.jpg');
    expect(screen.getByText('Test diagram')).toBeTruthy();
  });

  it('shows progress summary with correct counts', () => {
    const mockOnEndLesson = vi.fn();
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    expect(screen.getByText('1 / 3')).toBeTruthy(); // 1 completed out of 3
  });

  it('calls onEndLesson when end button is clicked', async () => {
    const mockOnEndLesson = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    const endButton = screen.getByRole('button', { name: /end lesson/i });
    fireEvent.click(endButton);

    await waitFor(() => {
      expect(mockOnEndLesson).toHaveBeenCalled();
    });
  });

  it('shows loading state when ending lesson', async () => {
    const mockOnEndLesson = vi.fn<() => Promise<void>>(
      () => new Promise(() => {})
    );
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    const endButton = screen.getByRole('button', { name: /end lesson/i });
    fireEvent.click(endButton);

    await waitFor(() => {
      expect(screen.getByText('Ending...')).toBeTruthy();
    });
  });

  it('highlights current milestone differently', () => {
    const mockOnEndLesson = vi.fn();
    const { container } = render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    // Find the milestone containers
    const milestoneElements = container.querySelectorAll('[class*="border-"]');
    const currentMilestone = Array.from(milestoneElements).find(
      el => el.textContent?.includes('Core Concepts')
    );

    expect(currentMilestone?.className).toContain('border-indigo-500');
  });

  it('renders empty state when no media assets', () => {
    const mockOnEndLesson = vi.fn();
    render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={[]}
        onEndLesson={mockOnEndLesson}
      />
    );

    expect(screen.getByText('Teaching interactions will appear here')).toBeTruthy();
  });

  it('calculates progress percentage correctly', () => {
    const mockOnEndLesson = vi.fn();
    const { container } = render(
      <LessonBoard
        sessionId="session1"
        topic="Photosynthesis"
        milestones={mockMilestones}
        currentMilestoneId="2"
        mediaAssets={mockMediaAssets}
        onEndLesson={mockOnEndLesson}
      />
    );

    // Find progress bar
    const progressBar = container.querySelector('[class*="bg-indigo-600"]');
    expect(progressBar?.getAttribute('style')).toContain('33.33'); // 1/3 = 33.33%
  });
});
