import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type LessonSessionOwnershipRow = {
  user_id: string;
};

type LessonSessionsTable = {
  select(columns: 'user_id'): {
    eq(column: 'id', value: string): {
      single(): Promise<{
        data: LessonSessionOwnershipRow | null;
        error: unknown;
      }>;
    };
  };
};

function lessonSessionsTable(supabase: SupabaseServerClient) {
  return supabase.from('lesson_sessions') as unknown as LessonSessionsTable;
}

/**
 * Authenticates API requests and returns the authenticated user.
 * Returns an error response if authentication fails.
 */
export async function authenticateRequest() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Verifies that the authenticated user owns the specified session.
 * Returns an error response if ownership verification fails.
 */
export async function verifySessionOwnership(sessionId: string, userId: string) {
  const supabase = await createClient();

  const lessonSessions = lessonSessionsTable(supabase);

  const { data: session, error } = await lessonSessions
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      ),
    };
  }

  if (session.user_id !== userId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, error: null };
}
