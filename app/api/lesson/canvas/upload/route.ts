import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LessonSessionRecord } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: 'Missing file or sessionId' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();
    const sessionRecord = session as Pick<
      LessonSessionRecord,
      'id' | 'user_id'
    > | null;

    if (sessionError || !sessionRecord || sessionRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 404 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileName = `${user.id}/${sessionId}/snapshot-${timestamp}.png`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('canvas-snapshots')
      .upload(fileName, file, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload snapshot' },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('canvas-snapshots').getPublicUrl(fileName);

    return NextResponse.json({
      url: publicUrl,
      path: uploadData.path,
    });
  } catch (error) {
    console.error('Canvas upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
