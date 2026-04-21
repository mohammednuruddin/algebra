import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateRequest, verifySessionOwnership } from './api-auth';
import { NextResponse } from 'next/server';
import { AuthError } from '@supabase/auth-js';
import { PostgrestError } from '@supabase/postgrest-js';
import { createClient } from '@/lib/supabase/server';

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const mockClient = (client: unknown) => client as SupabaseServerClient;

describe('authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user when authentication succeeds', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as unknown as SupabaseServerClient);

    const result = await authenticateRequest();

    expect(result.user).toEqual(mockUser);
    expect(result.error).toBeNull();
  });

  it('should return error response when authentication fails', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthError('Invalid token', 401, 'invalid_token'),
        }),
      },
    } as unknown as SupabaseServerClient);

    const result = await authenticateRequest();

    expect(result.user).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
  });

  it('should return error response when user is null', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as SupabaseServerClient);

    const result = await authenticateRequest();

    expect(result.user).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
  });
});

describe('verifySessionOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return authorized when user owns the session', async () => {
    const sessionId = 'session-123';
    const userId = 'user-123';
    vi.mocked(createClient).mockResolvedValue(mockClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: userId },
              error: null,
            }),
          }),
        }),
      }),
    }));

    const result = await verifySessionOwnership(sessionId, userId);

    expect(result.authorized).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should return error when session not found', async () => {
    const sessionId = 'session-123';
    const userId = 'user-123';
    vi.mocked(createClient).mockResolvedValue(mockClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new PostgrestError({
                message: 'Not found',
                details: 'Session not found',
                hint: '',
                code: 'PGRST116',
              }),
            }),
          }),
        }),
      }),
    }));

    const result = await verifySessionOwnership(sessionId, userId);

    expect(result.authorized).toBe(false);
    expect(result.error).toBeInstanceOf(NextResponse);
  });

  it('should return error when user does not own the session', async () => {
    const sessionId = 'session-123';
    const userId = 'user-123';
    const differentUserId = 'user-456';
    vi.mocked(createClient).mockResolvedValue(mockClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: differentUserId },
              error: null,
            }),
          }),
        }),
      }),
    }));

    const result = await verifySessionOwnership(sessionId, userId);

    expect(result.authorized).toBe(false);
    expect(result.error).toBeInstanceOf(NextResponse);
  });
});
