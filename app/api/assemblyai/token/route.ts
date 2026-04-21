import { NextResponse } from 'next/server';

export const fetchCache = 'force-no-store';

export async function GET() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLY_AI_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ASSEMBLYAI_API_KEY or ASSEMBLY_AI_KEY is not configured' },
      { status: 500 }
    );
  }

  const response = await fetch(
    'https://streaming.assemblyai.com/v3/token?expires_in_seconds=600&max_session_duration_seconds=1800',
    {
      headers: {
        Authorization: apiKey,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to create AssemblyAI streaming token (${response.status})` },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as {
    token?: string;
    expires_in_seconds?: number;
  };

  if (!payload.token) {
    return NextResponse.json(
      { error: 'AssemblyAI returned no streaming token' },
      { status: 502 }
    );
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    },
  });
}
