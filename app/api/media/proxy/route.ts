import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const targetUrl = request.nextUrl.searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.json(
        { error: 'Only http and https URLs are allowed' },
        { status: 400 }
      );
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AI-Teaching-Platform/1.0',
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Image proxy upstream failed with status ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to proxy lesson image',
      },
      { status: 500 }
    );
  }
}
