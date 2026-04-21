import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtectedRoute } from './protected-route';
import { createClient } from '@/lib/supabase/server';

// Mock Next.js redirect
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}));

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user is authenticated', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const TestChild = () => <div>Protected Content</div>;
    
    // Since this is a server component, we test the logic directly
    const result = await ProtectedRoute({ children: <TestChild /> });
    
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should redirect to login when user is not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const TestChild = () => <div>Protected Content</div>;
    
    try {
      await ProtectedRoute({ children: <TestChild /> });
    } catch {
      // redirect throws an error in Next.js
    }
    
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to login when authentication error occurs', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const TestChild = () => <div>Protected Content</div>;
    
    try {
      await ProtectedRoute({ children: <TestChild /> });
    } catch {
      // redirect throws an error in Next.js
    }
    
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
