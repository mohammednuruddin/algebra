import { NextRequest, NextResponse } from 'next/server';

const ASSEMBLY_BASE_URL = 'https://api.assemblyai.com';

type TranscriptResponse = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string | null;
  error?: string | null;
};

async function uploadAudio(apiKey: string, file: Blob) {
  const response = await fetch(`${ASSEMBLY_BASE_URL}/v2/upload`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { upload_url?: string };

  if (!payload.upload_url) {
    throw new Error('AssemblyAI upload returned no upload_url');
  }

  return payload.upload_url;
}

async function createTranscript(apiKey: string, audioUrl: string) {
  const response = await fetch(`${ASSEMBLY_BASE_URL}/v2/transcript`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_models: ['universal-3-pro', 'universal-2'],
      language_detection: true,
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI transcript creation failed with status ${response.status}`);
  }

  return (await response.json()) as TranscriptResponse;
}

async function pollTranscript(apiKey: string, transcriptId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${ASSEMBLY_BASE_URL}/v2/transcript/${transcriptId}`, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI transcript poll failed with status ${response.status}`);
    }

    const payload = (await response.json()) as TranscriptResponse;

    if (payload.status === 'completed') {
      return payload.text?.trim() || '';
    }

    if (payload.status === 'error') {
      throw new Error(payload.error || 'AssemblyAI transcript failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error('AssemblyAI transcript timed out');
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLY_AI_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ASSEMBLYAI_API_KEY or ASSEMBLY_AI_KEY is not configured' },
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

    const uploadUrl = await uploadAudio(apiKey, audio);
    const transcript = await createTranscript(apiKey, uploadUrl);
    const text = await pollTranscript(apiKey, transcript.id);

    return NextResponse.json({
      transcript: text,
    });
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
