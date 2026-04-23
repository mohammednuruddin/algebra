import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof Blob)) {
      return NextResponse.json(
        { error: 'Audio blob is required' },
        { status: 400 }
      );
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });
    const transcriptResult = await elevenlabs.speechToText.convert({
      file: audio,
      modelId: 'scribe_v2',
    });

    return NextResponse.json(
      {
        transcript: transcriptResult.text?.trim() || '',
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to transcribe learner audio',
      },
      { status: 500 }
    );
  }
}
