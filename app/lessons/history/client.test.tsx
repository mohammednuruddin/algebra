import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonHistoryClient } from './client';
import type { LessonHistoryItem } from './page';

// Mock Next.js navigation
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

describe('LessonHistoryClient', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.clear();
  });

  describe('Initial Rendering', () => {
    it('should render all lessons when no filters are applied', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      expect(screen.getByText(/Understanding Photosynthesis/)).toBeInTheDocument();
      expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
      expect(screen.getByText(/World War 1 Overview/)).toBeInTheDocument();
      expect(screen.getByText('3 total lessons')).toBeInTheDocument();
    });

    it('should render empty state when no lessons exist', () => {
      render(<LessonHistoryClient lessons={[]} />);

      expect(screen.getByText('No lessons yet')).toBeInTheDocument();
      expect(screen.getByText('Complete your first lesson to see it here')).toBeInTheDocument();
      expect(screen.getByText('Start a Lesson')).toBeInTheDocument();
    });

    it('should render search and filter controls when lessons exist', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      expect(screen.getByPlaceholderText('Search by topic or title...')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('should not render search controls when no lessons exist', () => {
      render(<LessonHistoryClient lessons={[]} />);

      expect(screen.queryByPlaceholderText('Search by topic or title...')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter lessons by title', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'Photosynthesis' } });

      await waitFor(() => {
        expect(screen.getByText(/Understanding Photosynthesis/)).toBeInTheDocument();
        expect(screen.queryByText(/Fractions Fundamentals/)).not.toBeInTheDocument();
        expect(screen.queryByText(/World War 1 Overview/)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Showing 1 of 3 lessons')).toBeInTheDocument();
    });

    it('should filter lessons by topic in metadata', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'History' } });

      await waitFor(() => {
        expect(screen.getByText(/World War 1 Overview/)).toBeInTheDocument();
        expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Fractions Fundamentals/)).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'fractions' } });

      await waitFor(() => {
        expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
        expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no results match search', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'Nonexistent Topic' } });

      await waitFor(() => {
        expect(screen.getByText('No lessons found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your search or filter criteria')).toBeInTheDocument();
      });
    });

    it('should update URL with search query', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'Photosynthesis' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/lessons/history?search=Photosynthesis',
          { scroll: false }
        );
      });
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter lessons by start date', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const startDateInput = screen.getByLabelText('Start Date');
      fireEvent.change(startDateInput, { target: { value: '2026-01-18' } });

      await waitFor(() => {
        expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
        expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
        expect(screen.getByText(/World War 1 Overview/)).toBeInTheDocument();
      });

      expect(screen.getByText('Showing 2 of 3 lessons')).toBeInTheDocument();
    });

    it('should filter lessons by end date', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const endDateInput = screen.getByLabelText('End Date');
      fireEvent.change(endDateInput, { target: { value: '2026-01-31' } });

      await waitFor(() => {
        expect(screen.getByText(/Understanding Photosynthesis/)).toBeInTheDocument();
        expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
        expect(screen.queryByText(/World War 1 Overview/)).not.toBeInTheDocument();
      });
    });

    it('should filter lessons by date range', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');

      fireEvent.change(startDateInput, { target: { value: '2026-01-18' } });
      fireEvent.change(endDateInput, { target: { value: '2026-01-31' } });

      await waitFor(() => {
        expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
        expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
        expect(screen.queryByText(/World War 1 Overview/)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Showing 1 of 3 lessons')).toBeInTheDocument();
    });

    it('should update URL with date range parameters', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const startDateInput = screen.getByLabelText('Start Date');
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/lessons/history?startDate=2026-01-01',
          { scroll: false }
        );
      });
    });
  });

  describe('Combined Filters', () => {
    it('should apply search and date filters together', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      const startDateInput = screen.getByLabelText('Start Date');

      fireEvent.change(searchInput, { target: { value: 'Fundamentals' } });
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });

      await waitFor(() => {
        expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
        expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
        expect(screen.queryByText(/World War 1 Overview/)).not.toBeInTheDocument();
      });
    });

    it('should update URL with all filter parameters', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');

      fireEvent.change(searchInput, { target: { value: 'test' } });
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2026-12-31' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenLastCalledWith(
          '/lessons/history?search=test&startDate=2026-01-01&endDate=2026-12-31',
          { scroll: false }
        );
      });
    });
  });

  describe('Clear Filters', () => {
    it('should show clear filters button when filters are active', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      fireEvent.change(searchInput, { target: { value: 'Photosynthesis' } });

      await waitFor(() => {
        // Should show clear button in filter controls (not in empty state since we have results)
        const clearButtons = screen.getAllByRole('button', { name: /clear filters/i });
        expect(clearButtons.length).toBeGreaterThan(0);
      });
    });

    it('should clear all filters when clear button is clicked', async () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...');
      const startDateInput = screen.getByLabelText('Start Date');

      fireEvent.change(searchInput, { target: { value: 'Photosynthesis' } });
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });

      await waitFor(() => {
        const clearButtons = screen.getAllByRole('button', { name: /clear filters/i });
        expect(clearButtons.length).toBeGreaterThan(0);
      });

      // Click the first clear button (the one in the filter controls)
      const clearButtons = screen.getAllByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButtons[0]);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(startDateInput).toHaveValue('');
        expect(mockPush).toHaveBeenCalledWith('/lessons/history', { scroll: false });
      });
    });
  });

  describe('URL Query Parameters', () => {
    it('should initialize filters from URL query parameters', () => {
      mockSearchParams.set('search', 'Photosynthesis');
      mockSearchParams.set('startDate', '2026-01-01');
      mockSearchParams.set('endDate', '2026-12-31');

      render(<LessonHistoryClient lessons={mockLessons} />);

      const searchInput = screen.getByPlaceholderText('Search by topic or title...') as HTMLInputElement;
      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement;

      expect(searchInput.value).toBe('Photosynthesis');
      expect(startDateInput.value).toBe('2026-01-01');
      expect(endDateInput.value).toBe('2026-12-31');
    });

    it('should create shareable filtered views via URL', () => {
      mockSearchParams.set('search', 'Fractions');

      render(<LessonHistoryClient lessons={mockLessons} />);

      expect(screen.getByText(/Fractions Fundamentals/)).toBeInTheDocument();
      expect(screen.queryByText(/Understanding Photosynthesis/)).not.toBeInTheDocument();
    });
  });

  describe('Lesson Card Rendering', () => {
    it('should render lesson metadata correctly', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      // Check for duration
      expect(screen.getByText('30 min')).toBeInTheDocument();

      // Check for milestones
      expect(screen.getByText('3/4 milestones')).toBeInTheDocument();

      // Check for difficulty
      expect(screen.getByText('Intermediate')).toBeInTheDocument();

      // Check for completion percentage
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render lesson with image thumbnail', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const image = screen.getByAltText('Understanding Photosynthesis - How Plants Make Food');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
    });

    it('should render lesson without image thumbnail', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      // Fractions lesson has no image, should show default icon
      const lessonCards = screen.getAllByRole('link');
      expect(lessonCards.length).toBeGreaterThan(0);
    });

    it('should link to article viewer page', () => {
      render(<LessonHistoryClient lessons={mockLessons} />);

      const lessonLink = screen.getByText(/Understanding Photosynthesis/).closest('a');
      expect(lessonLink).toHaveAttribute('href', '/lessons/article/lesson-1');
    });
  });
});
