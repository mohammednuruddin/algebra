import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { LessonArticleRecord } from '@/lib/types/database';

const MEDIA_ASSETS_BUCKET = 'media-assets';

function normalizeMediaStoragePath(source: string) {
  if (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('/')
  ) {
    return null;
  }

  return source.replace(/^\/+/, '');
}

/**
 * GET /api/lesson/article/[id]
 * 
 * Fetches article markdown and metadata from database.
 * Verifies user ownership or sharing permissions.
 * Returns article data with storage URLs for media.
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing article ID
 * @returns Article data with metadata and storage URLs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify authentication
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

    // Fetch article data
    const { data: article, error: articleError } = await supabase
      .from('lesson_articles')
      .select('*')
      .eq('id', id)
      .single() as {
      data: LessonArticleRecord | null;
      error: { message?: string } | null;
    };

    if (articleError || !article) {
      console.error('Error fetching article:', articleError);
      return NextResponse.json(
        { error: 'Not found', message: 'Article not found' },
        { status: 404 }
      );
    }

    // Verify user ownership
    // TODO: Add sharing permissions check when sharing feature is implemented
    if (article.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to access this article' },
        { status: 403 }
      );
    }

    // Get storage URLs for media assets referenced in the article
    const mediaUrls: Record<string, string> = {};
    
    // Extract media references from article markdown
    // Pattern: ![alt text](storage-path) or ![alt text](user_id/session_id/filename)
    const mediaPattern = /!\[.*?\]\((.*?)\)/g;
    const matches = article.article_markdown.matchAll(mediaPattern);
    
    for (const match of matches) {
      const storagePath = normalizeMediaStoragePath(match[1]);

      if (!storagePath) {
        continue;
      }

      // Generate signed URL for storage path
      const { data: urlData } = await supabase.storage
        .from(MEDIA_ASSETS_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (urlData?.signedUrl) {
        mediaUrls[storagePath] = urlData.signedUrl;
      }
    }

    // Return article data with media URLs
    return NextResponse.json({
      article: {
        id: article.id,
        session_id: article.session_id,
        user_id: article.user_id,
        title: article.title,
        article_markdown: article.article_markdown,
        article_storage_path: article.article_storage_path,
        metadata_json: article.metadata_json,
        created_at: article.created_at,
        updated_at: article.updated_at,
      },
      mediaUrls,
    });
  } catch (error) {
    console.error('Error in article fetch API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
