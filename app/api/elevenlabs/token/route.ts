import { NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

/**
 * Generate a single-use token for ElevenLabs Scribe (Speech-to-Text)
 * This endpoint is protected and requires authentication
 */
export async function GET() {
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

    // Create ElevenLabs client and generate single-use token
    const elevenlabs = new ElevenLabsClient({ apiKey });
    const token = await elevenlabs.tokens.singleUse.create('realtime_scribe');

    return NextResponse.json({ token: token.token });
  } catch (error) {
    console.error('Error generating ElevenLabs token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
