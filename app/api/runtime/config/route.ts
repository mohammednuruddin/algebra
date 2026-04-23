import { NextResponse } from 'next/server';

import { resolveTtsRuntimeConfig } from '@/lib/tts/config';

export const fetchCache = 'force-no-store';

export async function GET() {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const ttsConfig = resolveTtsRuntimeConfig();

  return NextResponse.json(
    {
      voiceEnabled: ttsConfig.voiceEnabled,
      teacherVoiceId: ttsConfig.teacherVoiceId,
      ttsProvider: ttsConfig.provider,
      ttsModelId: ttsConfig.ttsModelId,
      speechToTextEnabled: Boolean(elevenLabsKey),
      imageSearchEnabled: Boolean(process.env.SERPER_API_KEY),
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    }
  );
}
