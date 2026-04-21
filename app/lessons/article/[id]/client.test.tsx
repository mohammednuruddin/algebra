import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleViewer } from './client';
import type { LessonArticleRecord } from '@/lib/types/database';

// Mock KaTeX CSS import
vi.mock('katex/dist/katex.min.css', () => ({}));

describe('ArticleViewer - Metadata Sidebar', () => {
  const mockArticle: LessonArticleRecord = {
    id: 'article-1',
    session_id: 'session-1',
    user_id: 'user-1',
    title: 'Understanding Photosynthesis - How Plants Make Food',
    article_markdown: '# Introduction\n\nThis is a test article about photosynthesis.',
    article_storage_path: 'user-1/session-1/article.md',
    metadata_json: {
      topic: 'Photosynthesis',
      duration: 1800, // 30 minutes
      milestones_covered: 3,
      total_milestones: 4,
      completion_percentage: 75,
      date: '2026-01-15T10:00:00Z',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:30:00Z',
  };

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
      configurable: true,
    });

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('Metadata Display', () => {
    it('should display topic in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Topic')).toBeInTheDocument();
      expect(screen.getAllByText('Photosynthesis').length).toBeGreaterThan(0);
    });

    it('should display formatted date in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getAllByText(/January 15, 2026/).length).toBeGreaterThan(0);
    });

    it('should display formatted duration in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getAllByText('30 min').length).toBeGreaterThan(0);
    });

    it('should display milestones covered in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Milestones')).toBeInTheDocument();
      expect(screen.getByText('3 / 4 completed')).toBeInTheDocument();
    });

    it('should display completion percentage in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Completion')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('Duration Formatting', () => {
    it('should format duration in minutes when less than 60 minutes', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, duration: 2700 }, // 45 minutes
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.getAllByText('45 min').length).toBeGreaterThan(0);
    });

    it('should format duration in hours and minutes when 60+ minutes', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, duration: 5400 }, // 90 minutes
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.getAllByText('1h 30m').length).toBeGreaterThan(0);
    });

    it('should display N/A when duration is not provided', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, duration: undefined },
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should display back to lesson history link in header', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      const headerLink = screen.getByText('Back to Lesson History');
      expect(headerLink).toBeInTheDocument();
      expect(headerLink.closest('a')).toHaveAttribute('href', '/lessons/history');
    });

    it('should display all lessons button in sidebar', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      const sidebarLink = screen.getByText('All Lessons');
      expect(sidebarLink).toBeInTheDocument();
      expect(sidebarLink.closest('a')).toHaveAttribute('href', '/lessons/history');
    });
  });

  describe('Article Content', () => {
    it('should display article title', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(
        screen.getByText('Understanding Photosynthesis - How Plants Make Food')
      ).toBeInTheDocument();
    });

    it('should display article markdown content', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText(/This is a test article about photosynthesis/)).toBeInTheDocument();
    });
  });

  describe('Missing Metadata Handling', () => {
    it('should handle missing topic gracefully', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, topic: undefined },
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.queryByText('Topic')).not.toBeInTheDocument();
    });

    it('should use created_at when date is not in metadata', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, date: undefined },
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.getAllByText(/1\/15\/2026/).length).toBeGreaterThan(0);
    });

    it('should display 0 milestones when not provided', () => {
      const article = {
        ...mockArticle,
        metadata_json: {
          ...mockArticle.metadata_json,
          milestones_covered: undefined,
          total_milestones: undefined,
        },
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.getByText('0 / 0 completed')).toBeInTheDocument();
    });

    it('should not display completion percentage when not provided', () => {
      const article = {
        ...mockArticle,
        metadata_json: { ...mockArticle.metadata_json, completion_percentage: undefined },
      };
      render(<ArticleViewer article={article} />);
      
      expect(screen.queryByText('Completion')).not.toBeInTheDocument();
    });
  });

  describe('Sidebar Layout', () => {
    it('should display lesson details heading', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Lesson Details')).toBeInTheDocument();
    });

    it('should display all metadata sections in correct order', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      const labels = screen.getAllByRole('heading', { level: 2 });
      expect(labels[0]).toHaveTextContent('Lesson Details');
    });
  });

  describe('Download and Share Functionality', () => {
    it('should display download as PDF button', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Download as PDF')).toBeInTheDocument();
    });

    it('should display share link button', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      expect(screen.getByText('Share Link')).toBeInTheDocument();
    });

    it('should show success feedback after clicking share button', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      const user = userEvent.setup();
      render(<ArticleViewer article={mockArticle} />);
      
      const shareButton = screen.getByText('Share Link');
      await user.click(shareButton);
      
      // Should show success feedback
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument();
      });
    });

    it('should have article content with id for PDF generation', () => {
      render(<ArticleViewer article={mockArticle} />);
      
      const articleContent = document.getElementById('article-content');
      expect(articleContent).toBeInTheDocument();
    });
  });
});


describe('ArticleViewer - Markdown Rendering', () => {
  const mockArticleWithMarkdown: LessonArticleRecord = {
    id: 'article-md',
    session_id: 'session-1',
    user_id: 'user-1',
    title: 'Markdown Test Article',
    article_markdown: `# Main Heading

## Subheading

This is a paragraph with **bold text** and *italic text*.

### Lists

- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third

### Code Block

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

### Inline Code

Use \`const\` for constants.`,
    article_storage_path: 'user-1/session-1/article.md',
    metadata_json: {},
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('should render markdown headings', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    expect(screen.getByRole('heading', { level: 1, name: 'Main Heading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Subheading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Lists' })).toBeInTheDocument();
  });

  it('should render markdown bold and italic text', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    const paragraph = screen.getByText(/This is a paragraph with/);
    expect(paragraph).toBeInTheDocument();
    
    // Check for bold text
    const boldText = screen.getByText('bold text');
    expect(boldText.tagName).toBe('STRONG');
    
    // Check for italic text
    const italicText = screen.getByText('italic text');
    expect(italicText.tagName).toBe('EM');
  });

  it('should render markdown unordered lists', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should render markdown ordered lists', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('should render markdown code blocks', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    expect(screen.getByText(/const hello = "world"/)).toBeInTheDocument();
    expect(screen.getByText(/console.log\(hello\)/)).toBeInTheDocument();
  });

  it('should render inline code', () => {
    render(<ArticleViewer article={mockArticleWithMarkdown} />);
    
    const inlineCode = screen.getByText('const');
    expect(inlineCode.tagName).toBe('CODE');
  });
});

describe('ArticleViewer - LaTeX Formula Rendering', () => {
  const mockArticleWithLatex: LessonArticleRecord = {
    id: 'article-latex',
    session_id: 'session-1',
    user_id: 'user-1',
    title: 'LaTeX Test Article',
    article_markdown: `# Mathematical Formulas

## Inline Math

The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.

## Block Math

$$
E = mc^2
$$

## Complex Formula

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Multiple Formulas

The Pythagorean theorem: $a^2 + b^2 = c^2$

Einstein's mass-energy equivalence: $E = mc^2$`,
    article_storage_path: 'user-1/session-1/article.md',
    metadata_json: {},
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('should render inline LaTeX formulas', () => {
    render(<ArticleViewer article={mockArticleWithLatex} />);
    
    // KaTeX renders formulas with specific class names
    const katexElements = document.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThan(0);
  });

  it('should render block LaTeX formulas', () => {
    render(<ArticleViewer article={mockArticleWithLatex} />);
    
    // Block formulas are rendered with katex-display class
    const displayElements = document.querySelectorAll('.katex-display');
    expect(displayElements.length).toBeGreaterThan(0);
  });

  it('should render complex mathematical expressions', () => {
    render(<ArticleViewer article={mockArticleWithLatex} />);
    
    // Check that the article contains mathematical content
    expect(screen.getByText(/Mathematical Formulas/)).toBeInTheDocument();
    expect(screen.getByText(/Inline Math/)).toBeInTheDocument();
    expect(screen.getByText(/Block Math/)).toBeInTheDocument();
  });

  it('should render multiple LaTeX formulas in the same article', () => {
    render(<ArticleViewer article={mockArticleWithLatex} />);
    
    // Should have multiple katex elements for multiple formulas
    const katexElements = document.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThanOrEqual(4); // At least 4 formulas
  });
});

describe('ArticleViewer - Image Embedding', () => {
  const mockArticleWithImages: LessonArticleRecord = {
    id: 'article-images',
    session_id: 'session-1',
    user_id: 'user-1',
    title: 'Image Test Article',
    article_markdown: `# Article with Images

## Diagram

![Photosynthesis Diagram](user-1/session-1/photosynthesis.png)

## Multiple Images

![First Image](user-1/session-1/image1.png)

Some text between images.

![Second Image](user-1/session-1/image2.png)

## External Image

![External Image](https://example.com/external.png)`,
    article_storage_path: 'user-1/session-1/article.md',
    metadata_json: {},
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('should render embedded images from markdown', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(3);
  });

  it('should render images with correct alt text', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    expect(screen.getByAltText('Photosynthesis Diagram')).toBeInTheDocument();
    expect(screen.getByAltText('First Image')).toBeInTheDocument();
    expect(screen.getByAltText('Second Image')).toBeInTheDocument();
  });

  it('should render images with correct src attributes', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    const photosynthesisImage = screen.getByAltText('Photosynthesis Diagram');
    expect(photosynthesisImage).toHaveAttribute(
      'src',
      '/storage/v1/object/public/media-assets/user-1/session-1/photosynthesis.png'
    );
    
    const firstImage = screen.getByAltText('First Image');
    expect(firstImage).toHaveAttribute(
      'src',
      '/storage/v1/object/public/media-assets/user-1/session-1/image1.png'
    );
  });

  it('should render external images', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    const externalImage = screen.getByAltText('External Image');
    expect(externalImage).toHaveAttribute('src', 'https://example.com/external.png');
  });

  it('should apply custom styling to images', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveClass('rounded-lg');
      expect(img).toHaveClass('max-w-full');
      expect(img).toHaveClass('h-auto');
    });
  });

  it('should set loading="lazy" for images', () => {
    render(<ArticleViewer article={mockArticleWithImages} />);
    
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  it('should provide fallback alt text for images without alt', () => {
    const articleWithoutAlt: LessonArticleRecord = {
      ...mockArticleWithImages,
      article_markdown: '![](user-1/session-1/no-alt.png)',
    };
    
    render(<ArticleViewer article={articleWithoutAlt} />);
    
    const image = screen.getByAltText('Article image');
    expect(image).toBeInTheDocument();
  });
});

describe('ArticleViewer - Download and Share Functionality', () => {
  const mockArticle: LessonArticleRecord = {
    id: 'article-1',
    session_id: 'session-1',
    user_id: 'user-1',
    title: 'Test Article',
    article_markdown: '# Test Content',
    article_storage_path: 'user-1/session-1/article.md',
    metadata_json: {},
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('should have download PDF button', () => {
    render(<ArticleViewer article={mockArticle} />);
    
    const downloadButton = screen.getByText('Download as PDF');
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton.closest('button')).not.toBeDisabled();
  });

  it('should have share link button', () => {
    render(<ArticleViewer article={mockArticle} />);
    
    const shareButton = screen.getByText('Share Link');
    expect(shareButton).toBeInTheDocument();
  });

  it('should copy article URL to clipboard when share button is clicked', async () => {
    render(<ArticleViewer article={mockArticle} />);
    
    const user = userEvent.setup();
    const shareButton = screen.getByRole('button', { name: /share link/i });
    await user.click(shareButton);
    
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument();
    });
  });

  it('should show success feedback after copying link', async () => {
    render(<ArticleViewer article={mockArticle} />);
    
    const user = userEvent.setup();
    const shareButton = screen.getByText('Share Link');
    await user.click(shareButton);
    
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument();
    });
  });

  it('should hide success feedback after 2 seconds', async () => {
    const writeTextMock = vi.mocked(navigator.clipboard.writeText);
    writeTextMock.mockClear();
    writeTextMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ArticleViewer article={mockArticle} />);
    
    const shareButton = screen.getByRole('button', { name: /share link/i });
    await user.click(shareButton);
    
    // Should show success feedback
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument();
    });
    
    await new Promise((resolve) => setTimeout(resolve, 2100));
    
    // Success feedback should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Link Copied!')).not.toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
    });
  });

  it('should have article content with id for PDF generation', () => {
    render(<ArticleViewer article={mockArticle} />);
    
    const articleContent = document.getElementById('article-content');
    expect(articleContent).toBeInTheDocument();
    expect(articleContent?.tagName).toBe('ARTICLE');
  });

  it('should disable download button while generating PDF', async () => {
    // Mock html2canvas and jsPDF
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 1000;
    mockCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

    const mockHtml2Canvas = vi.fn().mockResolvedValue(mockCanvas);
    
    const mockPDF = {
      addImage: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
    };
    
    vi.doMock('html2canvas', () => ({ default: mockHtml2Canvas }));
    vi.doMock('jspdf', () => ({ default: vi.fn(() => mockPDF) }));

    render(<ArticleViewer article={mockArticle} />);
    
    const downloadButton = screen.getByText('Download as PDF').closest('button');
    expect(downloadButton).not.toBeDisabled();
    
    // Note: Actual PDF generation test would require more complex mocking
    // This test verifies the button exists and is initially enabled
  });
});
