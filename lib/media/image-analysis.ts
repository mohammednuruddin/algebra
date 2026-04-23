import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorGeneratedImageEdits, TutorGeneratedImageVerifiedEdits } from '@/lib/types/tutor';

export type TeachingImageDescription = {
  summary: string;
  imageKind: string;
  showsProcess: boolean;
  keyObjects: string[];
  keyRegions: string[];
  teachingValueScore: number;
  childFriendlinessScore: number;
  clutterScore: number;
  suggestedUse: string;
  tutorGuidance: string[];
};

export type EditableImageInventory = {
  summary: string;
  visibleLabels: string[];
  keyItems: string[];
};

export type VerifiedEditedImageChanges = TutorGeneratedImageVerifiedEdits & {
  summary: string;
  suggestedUse: string;
  tutorGuidance: string[];
};

function safeJsonParse<T>(value: string): T {
  return JSON.parse(value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()) as T;
}

function previewJsonForLogs(content: string, limit = 1200) {
  return content.length > limit ? `${content.slice(0, limit)}...` : content;
}

async function callImageAnalysisModel<T>(args: {
  system: string;
  prompt: string;
  imageUrls: string[];
  logLabel: string;
}) {
  const model = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-lite';
  const outbound = buildOpenRouterRequest({
    model,
    messages: [
      {
        role: 'system',
        content: args.system,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: args.prompt },
          ...args.imageUrls.map((url) => ({
            type: 'image_url' as const,
            image_url: {
              url,
              detail: 'auto' as const,
            },
          })),
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0,
  });

  const response = await fetch(outbound.url, {
    method: 'POST',
    headers: outbound.headers,
    body: JSON.stringify(outbound.body),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter ${args.logLabel} failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`OpenRouter ${args.logLabel} returned no content`);
  }

  try {
    return safeJsonParse<T>(content);
  } catch (error) {
    console.error(`[image-analysis] Failed to parse ${args.logLabel} JSON`, {
      error: error instanceof Error ? error.message : String(error),
      preview: previewJsonForLogs(content),
    });
    throw error;
  }
}

export async function describeTeachingImage(args: { imageUrl: string; topic: string }) {
  return callImageAnalysisModel<TeachingImageDescription>({
    system:
      'You are helping an educational tutor understand a teaching image. Return strict JSON only.',
    prompt:
      `Describe this image for a tutor teaching ${args.topic}. ` +
      'Return strict JSON only with keys summary,imageKind,showsProcess,keyObjects,keyRegions,teachingValueScore,childFriendlinessScore,clutterScore,suggestedUse,tutorGuidance. ' +
      'Keep arrays short and concise. keyRegions must be short phrases, not coordinate objects. tutorGuidance must be short action prompts the tutor can say.',
    imageUrls: [args.imageUrl],
    logLabel: 'image description',
  });
}

export async function extractEditableImageInventory(args: { imageUrl: string; topic: string }) {
  return callImageAnalysisModel<EditableImageInventory>({
    system:
      'Extract exact visible labels and key items from this educational image. Return strict JSON only.',
    prompt:
      `List the exact visible labels and key items in this ${args.topic} image. ` +
      'Return strict JSON only with keys summary,visibleLabels,keyItems. visibleLabels must be exact text seen in the image. keyItems must be concise noun phrases for important editable objects.',
    imageUrls: [args.imageUrl],
    logLabel: 'editable image inventory',
  });
}

export async function verifyEditedImageChanges(args: {
  originalImageUrl: string;
  editedImageUrl: string;
  requestedEdits: TutorGeneratedImageEdits;
  topic: string;
}) {
  const requestedRemove = args.requestedEdits.remove.join(', ') || 'none';
  const requestedSwap =
    args.requestedEdits.swap.map((entry) => `${entry.from} -> ${entry.to}`).join(', ') || 'none';

  return callImageAnalysisModel<VerifiedEditedImageChanges>({
    system: 'Compare the original and edited educational images. Return strict JSON only.',
    prompt:
      `Compare the original and edited ${args.topic} images. ` +
      `Requested remove labels: ${requestedRemove}. ` +
      `Requested swaps: ${requestedSwap}. ` +
      'Return strict JSON only with keys removedLabelsVerified,swappedLabelsVerified,summary,suggestedUse,tutorGuidance.',
    imageUrls: [args.originalImageUrl, args.editedImageUrl],
    logLabel: 'edited image verification',
  });
}
