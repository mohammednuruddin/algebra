import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ArticleViewer, GuestArticlePage } from './client';
import { saveGuestLesson, type GuestLessonRecord } from '@/lib/guest/guest-lesson-store';

vi.mock('katex/dist/katex.min.css', () => ({}));

function buildArticle() {
  return {
    id: 'article-1',
    session_id: 'session-1',
    user_id: 'guest',
    title: 'Understanding Photosynthesis - How Plants Make Food',
    article_markdown:
      '# Introduction\n\nThis is a test article about photosynthesis.\n\n![Leaf diagram](leaf.png)',
    article_storage_path: '',
    metadata_json: {
      topic: 'Photosynthesis',
      duration: 1800,
      milestones_covered: 3,
      total_milestones: 4,
      completion_percentage: 75,
      date: '2026-01-15T10:00:00Z',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:30:00Z',
  };
}

function buildLesson(
  overrides: Partial<GuestLessonRecord> = {}
): GuestLessonRecord {
  return {
    id: 'session-1',
    guestId: 'guest-1',
    topicPrompt: 'photosynthesis',
    title: 'photosynthesis',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:30:00Z',
    status: 'complete',
    lessonPlan: null,
    mediaAssets: [],
    activeImageId: null,
    currentMilestoneId: null,
    lastResponse: null,
    turns: [],
    summary: null,
    article: buildArticle(),
    continuationContext: null,
    ...overrides,
  };
}

describe('ArticleViewer', () => {
  beforeEach(() => {
    window.localStorage.clear();

    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders article metadata and body content', () => {
    render(<ArticleViewer article={buildArticle()} />);

    expect(screen.getByText('Photosynthesis')).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Understanding Photosynthesis - How Plants Make Food')).toBeInTheDocument();
    expect(screen.getByText('30 min read')).toBeInTheDocument();
    expect(screen.getByText('3 / 4 milestones')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/test article about photosynthesis/i)).toBeInTheDocument();
  });

  it('renders a continue lesson link when a continuation href is provided', () => {
    render(
      <ArticleViewer
        article={buildArticle()}
        continueHref="/?continue=article-1"
      />
    );

    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute(
      'href',
      '/?continue=article-1'
    );
  });

  it('copies the share URL and shows copied feedback', async () => {
    const user = userEvent.setup();
    render(<ArticleViewer article={buildArticle()} />);

    await user.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('rewrites storage-relative markdown image URLs to the media bucket path', () => {
    render(<ArticleViewer article={buildArticle()} />);

    const image = screen.getByRole('img', { name: /leaf diagram/i });
    expect(image).toHaveAttribute(
      'src',
      '/storage/v1/object/public/media-assets/leaf.png'
    );
  });
});

describe('GuestArticlePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows continue lesson when hidden continuation context exists for the article', () => {
    saveGuestLesson(
      buildLesson({
        continuationContext: {
          sourceSessionId: 'session-1',
          sourceArticleId: 'article-1',
          topic: 'Photosynthesis',
          learnerLevel: 'beginner',
          outline: ['Review chlorophyll.', 'Practice the glucose equation.'],
          turns: [],
          mediaAssets: [],
          activeImageId: null,
          canvasSummary: 'No board task remained active.',
          canvas: {
            mode: 'distribution',
            headline: 'Tutor workspace',
            instruction: 'Listen and respond.',
            tokens: [],
            zones: [],
            equation: null,
            fillBlank: null,
            codeBlock: null,
            multipleChoice: null,
            numberLine: null,
            tableGrid: null,
            graphPlot: null,
            matchingPairs: null,
            ordering: null,
            textResponse: null,
            drawing: null,
          },
          strengths: ['Knows the sunlight part already.'],
          weaknesses: ['Still mixes up glucose and chlorophyll.'],
          recommendedNextSteps: ['Resume with one quick contrast drill.'],
          resumeHint: 'Continue from the glucose-vs-chlorophyll confusion.',
          completedAt: '2026-01-15T10:30:00Z',
        },
      })
    );

    render(<GuestArticlePage articleId="article-1" />);

    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute(
      'href',
      '/?continue=article-1'
    );
  });

  it('renders not-found state when the article does not exist', () => {
    render(<GuestArticlePage articleId="missing-article" />);

    expect(screen.getByText('Article not found')).toBeInTheDocument();
  });
});
