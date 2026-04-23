import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

interface TTSRequest {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

/**
 * Text-to-Speech endpoint using ElevenLabs TTS API
 * Converts text to natural speech audio
 */
export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not configured');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: TTSRequest = await request.json();
    const { 
      text, 
      voiceId, 
      modelId = 'eleven_flash_v2_5',
      voiceSettings = {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true,
      }
    } = body;

    if (!text || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required fields: text and voiceId' },
        { status: 400 }
      );
    }

    // Create ElevenLabs client and generate speech
    const elevenlabs = new ElevenLabsClient({ apiKey });
    
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId,
      voiceSettings: {
        stability: voiceSettings.stability,
        similarityBoost: voiceSettings.similarityBoost,
        style: voiceSettings.style,
        useSpeakerBoost: voiceSettings.useSpeakerBoost,
      },
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = audioStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const audioBuffer = Buffer.concat(chunks);

    // Return audio as MP3
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
