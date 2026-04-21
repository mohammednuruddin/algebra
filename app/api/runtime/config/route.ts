import { NextResponse } from 'next/server';

import { resolveTtsRuntimeConfig } from '@/lib/tts/config';

export const fetchCache = 'force-no-store';

export async function GET() {
  const assemblyAiKey =
    process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLY_AI_KEY;
  const ttsConfig = resolveTtsRuntimeConfig();

  return NextResponse.json(
    {
      voiceEnabled: ttsConfig.voiceEnabled,
      teacherVoiceId: ttsConfig.teacherVoiceId,
      ttsProvider: ttsConfig.provider,
      ttsModelId: ttsConfig.ttsModelId,
      speechToTextEnabled: Boolean(assemblyAiKey),
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
