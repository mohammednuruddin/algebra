import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LessonHistoryClient } from './client';
import type { LessonHistoryItem } from './page';

const mockPush = vi.fn();
const mockSearchParams = new Map<string, string>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
  }),
}));

const mockLessons: LessonHistoryItem[] = [
  {
    id: 'lesson-1',
    title: 'Understanding Photosynthesis - How Plants Make Food',
    created_at: '2026-01-15T10:00:00Z',
    metadata_json: {
      topic: 'Photosynthesis',
      duration: 1800,
      milestones_covered: 3,
      total_milestones: 4,
      completion_percentage: 75,
      difficulty: 'Intermediate',
      first_image_url: 'https://example.com/image1.jpg',
    },
  },
  {
    id: 'lesson-2',
    title: 'Fractions Fundamentals - Halves and Quarters',
    created_at: '2026-01-20T14:30:00Z',
    metadata_json: {
      topic: 'Fractions',
      duration: 2400,
      milestones_covered: 5,
      total_milestones: 5,
      completion_percentage: 100,
      difficulty: 'Beginner',
    },
  },
  {
    id: 'lesson-3',
    title: 'World War 1 Overview - Causes and Major Events',
    created_at: '2026-02-05T09:15:00Z',
    metadata_json: {
      topic: 'History',
      duration: 3000,
      milestones_covered: 4,
      total_milestones: 6,
      completion_percentage: 67,
      difficulty: 'Advanced',
    },
  },
];

describe('LessonHistoryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.clear();
  });

  it('renders lesson cards and the total lesson count', () => {
    render(<LessonHistoryClient lessons={mockLessons} />);

    expect(screen.getByText('3 total lessons')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Understanding Photosynthesis - How Plants Make Food/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Fractions Fundamentals - Halves and Quarters/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/World War 1 Overview - Causes and Major Events/i).length
    ).toBeGreaterThan(0);
  });

  it('renders the current empty state when there are no lessons', () => {
    render(<LessonHistoryClient lessons={[]} />);

    expect(screen.getByText('Your Learning Journey Begins')).toBeInTheDocument();
    expect(
      screen.getByText(/You haven't completed any lessons yet/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a lesson/i })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('filters lessons by search query and updates the URL', async () => {
    render(<LessonHistoryClient lessons={mockLessons} />);

    fireEvent.change(screen.getByPlaceholderText('Search by topic or title...'), {
      target: { value: 'History' },
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/World War 1 Overview - Causes and Major Events/i).length
      ).toBeGreaterThan(0);
      expect(
        screen.queryAllByText(/Understanding Photosynthesis - How Plants Make Food/i)
      ).toHaveLength(0);
    });

    expect(mockPush).toHaveBeenCalledWith('/lessons/history?search=History', {
      scroll: false,
    });
    expect(screen.getByText('Showing 1 of 3 lessons')).toBeInTheDocument();
  });

  it('filters lessons by date range', async () => {
    render(<LessonHistoryClient lessons={mockLessons} />);

    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-01-18' },
    });
    fireEvent.change(screen.getByLabelText('End Date'), {
      target: { value: '2026-01-31' },
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Fractions Fundamentals - Halves and Quarters/i).length
      ).toBeGreaterThan(0);
      expect(
        screen.queryAllByText(/Understanding Photosynthesis - How Plants Make Food/i)
      ).toHaveLength(0);
      expect(
        screen.queryAllByText(/World War 1 Overview - Causes and Major Events/i)
      ).toHaveLength(0);
    });
  });

  it('clears filters and resets the URL', async () => {
    render(<LessonHistoryClient lessons={mockLessons} />);

    fireEvent.change(screen.getByPlaceholderText('Search by topic or title...'), {
      target: { value: 'Fractions' },
    });

    await waitFor(() => {
      expect(screen.getByTitle('Clear filters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Clear filters'));

    await waitFor(() => {
      expect(
        screen.getAllByText(/Understanding Photosynthesis - How Plants Make Food/i).length
      ).toBeGreaterThan(0);
    });

    expect(mockPush).toHaveBeenCalledWith('/lessons/history', { scroll: false });
  });

  it('initializes filter controls from URL search params', () => {
    mockSearchParams.set('search', 'Photosynthesis');
    mockSearchParams.set('startDate', '2026-01-01');
    mockSearchParams.set('endDate', '2026-12-31');

    render(<LessonHistoryClient lessons={mockLessons} />);

    expect(
      screen.getByPlaceholderText('Search by topic or title...')
    ).toHaveValue('Photosynthesis');
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('End Date')).toHaveValue('2026-12-31');
  });

  it('renders lesson card metadata and thumbnail links', () => {
    render(<LessonHistoryClient lessons={mockLessons} />);

    expect(screen.getByAltText('Understanding Photosynthesis - How Plants Make Food')).toHaveAttribute(
      'src',
      'https://example.com/image1.jpg'
    );
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    const lessonLinks = screen.getAllByRole('link');
    expect(
      lessonLinks.some((link) => link.getAttribute('href') === '/lessons/article/lesson-1')
    ).toBe(true);
  });
});
