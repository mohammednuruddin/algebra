import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mockRange = vi.fn();
const mockOr = vi.fn(() => ({ range: mockRange }));
const mockOrder = vi.fn(() => ({ range: mockRange, or: mockOr }));
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: mockSelect,
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('GET /api/lesson/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest('http://localhost:3000/api/lesson/history');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns paginated lesson history for the authenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockRange.mockResolvedValue({
      data: [
        {
          id: 'article-1',
          title: 'Photosynthesis',
          created_at: '2026-01-15T10:00:00Z',
          metadata_json: { topic: 'Photosynthesis' },
        },
      ],
      error: null,
      count: 1,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/lesson/history?page=2&pageSize=5'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('lesson_articles');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, title, created_at, metadata_json',
      { count: 'exact' }
    );
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockRange).toHaveBeenCalledWith(5, 9);
    expect(data.lessons).toHaveLength(1);
    expect(data.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    });
  });

  it('applies search filter when provided', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/lesson/history?search=photo'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockOr).toHaveBeenCalledWith('title.ilike.%photo%');
  });
});
