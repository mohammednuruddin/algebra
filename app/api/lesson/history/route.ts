import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get('page'), DEFAULT_PAGE);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const search = searchParams.get('search')?.trim().toLowerCase() ?? '';

    let query = supabase
      .from('lesson_articles')
      .select('id, title, created_at, metadata_json', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch lesson history', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lessons: data ?? [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
