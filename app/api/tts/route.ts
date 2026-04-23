import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import { coerceTtsProvider, resolveTtsRuntimeConfig } from '@/lib/tts/config';

interface TTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  provider?: 'elevenlabs';
  optimizeStreamingLatency?: number;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

async function synthesizeWithElevenLabs(body: Required<Pick<TTSRequest, 'text'>> & TTSRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const elevenlabs = new ElevenLabsClient({ apiKey });
  const audioStream = await elevenlabs.textToSpeech.convert(body.voiceId!, {
    text: body.text,
    modelId: body.modelId,
    optimizeStreamingLatency: body.optimizeStreamingLatency,
    voiceSettings: {
      stability: body.voiceSettings?.stability,
      similarityBoost: body.voiceSettings?.similarityBoost,
      style: body.voiceSettings?.style,
      useSpeakerBoost: body.voiceSettings?.useSpeakerBoost,
    },
  });

  const chunks: Uint8Array[] = [];
  const reader = audioStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    audioBuffer: Buffer.concat(chunks),
    contentType: 'audio/mpeg',
  };
}

export async function POST(request: NextRequest) {
  try {
    const runtimeConfig = resolveTtsRuntimeConfig();
    const body = (await request.json()) as TTSRequest;

    const text = body.text?.trim() || '';
    if (!text) {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 }
      );
    }

    const provider = coerceTtsProvider(body.provider) || runtimeConfig.provider;
    const voiceId = body.voiceId?.trim() || runtimeConfig.teacherVoiceId;
    const modelId = body.modelId?.trim() || runtimeConfig.ttsModelId;
    const result = await synthesizeWithElevenLabs({
      ...body,
      text,
      voiceId,
      modelId,
      provider,
    });

    return new NextResponse(result.audioBuffer, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length.toString(),
        'X-TTS-Provider': provider,
        'X-TTS-Voice': voiceId,
        'X-TTS-Model': modelId,
      },
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
