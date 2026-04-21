import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('GET /api/lesson/article/[id]', () => {
  const mockArticle = {
    id: 'article-123',
    session_id: 'session-456',
    user_id: 'user-789',
    title: 'Test Article - January 15, 2026',
    article_markdown: '# Test Article\n\nThis is a test.\n\n![Test Image](user-789/session-456/image.png)',
    article_storage_path: 'user-789/session-456/article.md',
    metadata_json: {
      topic: 'Test Topic',
      duration: 1800,
      milestones_covered: 3,
      total_milestones: 3,
      completion_percentage: 100,
      date: '2026-01-15',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:30:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return article data for authenticated user who owns the article', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-789' } },
      error: null,
    });

    // Mock article fetch
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockArticle,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    // Mock storage URL generation
    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed-url' },
      error: null,
    });

    mockSupabase.storage.from.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/lesson/article/article-123');
    const params = Promise.resolve({ id: 'article-123' });

    // Call endpoint
    const response = await GET(request, { params });
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.article).toEqual(mockArticle);
    expect(data.mediaUrls).toHaveProperty('user-789/session-456/image.png');
    expect(mockSupabase.from).toHaveBeenCalledWith('lesson_articles');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('id', 'article-123');
  });

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/article/article-123');
    const params = Promise.resolve({ id: 'article-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when article does not exist', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-789' } },
      error: null,
    });

    // Mock article not found
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/article/nonexistent');
    const params = Promise.resolve({ id: 'nonexistent' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('should return 403 when user does not own the article', async () => {
    // Mock authentication with different user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'different-user' } },
      error: null,
    });

    // Mock article fetch
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockArticle,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/article/article-123');
    const params = Promise.resolve({ id: 'article-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should handle articles without media references', async () => {
    const articleWithoutMedia = {
      ...mockArticle,
      article_markdown: '# Test Article\n\nThis is a test without images.',
    };

    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-789' } },
      error: null,
    });

    // Mock article fetch
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: articleWithoutMedia,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/article/article-123');
    const params = Promise.resolve({ id: 'article-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.article).toEqual(articleWithoutMedia);
    expect(data.mediaUrls).toEqual({});
  });

  it('should skip external URLs when generating media URLs', async () => {
    const articleWithExternalMedia = {
      ...mockArticle,
      article_markdown: '# Test\n\n![External](https://example.com/image.png)\n![Internal](user-789/session-456/image.png)',
    };

    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-789' } },
      error: null,
    });

    // Mock article fetch
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: articleWithExternalMedia,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    // Mock storage URL generation
    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed-url' },
      error: null,
    });

    mockSupabase.storage.from.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/article/article-123');
    const params = Promise.resolve({ id: 'article-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mediaUrls).toHaveProperty('user-789/session-456/image.png');
    expect(data.mediaUrls).not.toHaveProperty('https://example.com/image.png');
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });
});
