import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorMediaAsset } from '@/lib/types/tutor';

type SerperImageResult = {
  title?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailUrl?: string;
  source?: string;
  domain?: string;
  link?: string;
  position?: number;
};

type SerperResponse = {
  images?: SerperImageResult[];
};

type ImageDescription = {
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

function safeJsonParse<T>(value: string): T {
  return JSON.parse(value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()) as T;
}

function previewJsonForLogs(content: string, limit = 1200) {
  return content.length > limit ? `${content.slice(0, limit)}...` : content;
}

async function describeImage(imageUrl: string, topic: string) {
  const model = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-lite';
  const prompt =
    `Describe this image for a tutor teaching ${topic}. ` +
    'Return strict JSON only with keys summary,imageKind,showsProcess,keyObjects,keyRegions,teachingValueScore,childFriendlinessScore,clutterScore,suggestedUse,tutorGuidance. ' +
    'Keep arrays short and concise. keyRegions must be short phrases, not coordinate objects. tutorGuidance must be short action prompts the tutor can say.';

  const outbound = buildOpenRouterRequest({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are helping an educational tutor understand a teaching image. Return strict JSON only.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'auto',
            },
          },
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
    throw new Error(`OpenRouter image description failed with status ${response.status}`);
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
    throw new Error('OpenRouter image description returned no content');
  }

  const parse = (value: string) => safeJsonParse<ImageDescription>(value);

  try {
    return parse(content);
  } catch (error) {
    console.error('[lesson/image-search] Failed to parse image description JSON', {
      topic,
      imageUrl,
      error: error instanceof Error ? error.message : String(error),
      preview: previewJsonForLogs(content),
    });
    throw error;
  }
}

async function fetchSerperImages(query: string) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not configured');
  }

  const response = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    throw new Error(`Serper image search failed with status ${response.status}`);
  }

  return (await response.json()) as SerperResponse;
}

function filterImageCandidates(images: SerperImageResult[]) {
  return images
    .filter((image) => image.imageUrl && image.title && image.domain)
    .filter((image) => (image.imageWidth || 0) >= 300 && (image.imageHeight || 0) >= 300)
    .filter((image) => !/pinterest|facebook|instagram|tiktok/i.test(image.domain || ''))
    .slice(0, 6);
}

export async function searchLessonImages(input: {
  topic: string;
  searchQuery?: string;
  desiredCount?: number;
}) {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('topic is required');
  }

  const desiredCount = Math.max(0, Math.min(input.desiredCount || 0, 4));
  if (desiredCount === 0) {
    return { assets: [] as TutorMediaAsset[], candidatesConsidered: 0 };
  }

  const searchQuery = input.searchQuery?.trim() || topic;
  const serper = await fetchSerperImages(searchQuery);
  const candidates = filterImageCandidates(serper.images || []);
  const described: Array<{ candidate: SerperImageResult; description: ImageDescription }> = [];

  for (const candidate of candidates) {
    try {
      const description = await describeImage(candidate.imageUrl!, topic);
      described.push({ candidate, description });
    } catch (error) {
      console.warn('[lesson/image-search] Image description failed', {
        imageUrl: candidate.imageUrl,
        title: candidate.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const assets = described
    .sort((left, right) => {
      const leftScore =
        (left.description.teachingValueScore || 0) -
        (left.description.clutterScore || 0) * 0.5;
      const rightScore =
        (right.description.teachingValueScore || 0) -
        (right.description.clutterScore || 0) * 0.5;
      return rightScore - leftScore;
    })
    .slice(0, desiredCount)
    .map(({ candidate, description }, index): TutorMediaAsset => ({
      id: `media_${index + 1}_${Date.now()}`,
      url: candidate.imageUrl!,
      altText: candidate.title || description.summary,
      description: description.summary,
      thumbnailUrl: candidate.thumbnailUrl,
      source: candidate.source,
      domain: candidate.domain,
      metadata: {
        imageKind: description.imageKind,
        showsProcess: description.showsProcess,
        keyObjects: description.keyObjects,
        keyRegions: description.keyRegions,
        suggestedUse: description.suggestedUse,
        tutorGuidance: description.tutorGuidance,
        teachingValueScore: description.teachingValueScore,
        childFriendlinessScore: description.childFriendlinessScore,
        clutterScore: description.clutterScore,
      },
    }));

  return {
    assets,
    candidatesConsidered: candidates.length,
  };
}
