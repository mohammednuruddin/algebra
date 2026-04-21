import { NextRequest, NextResponse } from 'next/server';
import { buildOpenRouterRequest } from '@/lib/ai/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const outbound = buildOpenRouterRequest(body);
    const model =
      typeof outbound.body.model === 'string' ? outbound.body.model : 'unknown-model';

    const response = await fetch(outbound.url, {
      method: 'POST',
      headers: outbound.headers,
      body: JSON.stringify(outbound.body),
    });

    const text = await response.text();
    const preview = text.length > 1200 ? `${text.slice(0, 1200)}...` : text;

    try {
      JSON.parse(text);
    } catch (error) {
      console.error('[api/ai/chat] Upstream returned invalid JSON', {
        model,
        status: response.status,
        error: error instanceof Error ? error.message : String(error),
        preview,
      });

      return NextResponse.json(
        {
          error: 'OpenRouter returned invalid JSON',
          model,
          upstreamStatus: response.status,
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[api/ai/chat] Upstream request failed', {
        model,
        status: response.status,
        preview,
      });
    }

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to contact OpenRouter',
      },
      { status: 500 }
    );
  }
}
